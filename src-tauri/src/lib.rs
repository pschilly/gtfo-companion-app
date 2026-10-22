use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use futures_util::StreamExt;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct PreviewImage {
    pub label: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct AssetItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    #[serde(alias = "aircraft")]
    pub aircraft_or_module: String,
    pub version: String,
    pub author: String,
    #[serde(alias = "thumbnailUrl")]
    pub image_preview_url: String,
    pub preview_gallery: Option<Vec<PreviewImage>>,
    #[serde(alias = "target_folder")]
    pub target_folder: String,
    #[serde(alias = "install_folder_name")]
    pub install_folder_name: String,
    #[serde(alias = "github_repo")]
    pub github_repo: Option<String>,
    #[serde(alias = "github_branch")]
    pub github_branch: Option<String>,
    #[serde(alias = "github_path_prefixes")]
    pub github_path_prefixes: Option<Vec<String>>,
    #[serde(alias = "file_count")]
    pub file_count: Option<u32>,
    #[serde(alias = "required_tier")]
    pub required_tier: String,
    #[serde(alias = "requirement_level")]
    pub requirement_level: Option<String>,
    #[serde(alias = "download_url")]
    pub download_url: String,
    #[serde(alias = "archive_subfolder", alias = "archivePathPrefix", alias = "archive_path_prefix", alias = "zip_subfolder", alias = "zipSubfolder")]
    pub archive_subfolder: Option<String>,
    pub sha256: String,
    #[serde(alias = "file_size_bytes")]
    pub file_size_bytes: u64,
    #[serde(alias = "releasedAt", alias = "released_at")]
    pub updated_at: String,
    pub changelog: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub featured: Option<bool>,
    #[serde(alias = "is_external", alias = "isExternal")]
    pub is_external: Option<bool>,
    #[serde(alias = "external_url", alias = "externalUrl")]
    pub external_url: Option<String>,
    #[serde(alias = "detection_path", alias = "detectionPath")]
    pub detection_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Announcement {
    pub title: String,
    pub message: String,
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct AssetManifest {
    pub schema_version: u32,
    pub community_name: String,
    pub manifest_version: String,
    pub generated_at: String,
    pub announcement: Option<Announcement>,
    #[serde(alias = "packages")]
    pub assets: Vec<AssetItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledAssetRecord {
    pub asset_id: String,
    pub name: String,
    pub category: String,
    pub aircraft_or_module: String,
    pub installed_version: String,
    pub target_folder: String,
    pub install_folder_name: String,
    pub installed_path: String,
    pub installed_at: String,
    pub sha256: String,
    pub extracted_files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DcsPathCandidate {
    pub label: String,
    pub path: String,
    pub exists: bool,
    pub variant: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DcsEnvironmentInfo {
    pub active_saved_games_path: String,
    pub detected_candidates: Vec<DcsPathCandidate>,
    pub saved_games_root: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressEvent {
    pub asset_id: String,
    pub stage: String,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub percent: u8,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityResult {
    pub valid: bool,
    pub missing_files: Vec<String>,
    pub modified_files: Vec<String>,
    pub checked_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiscordUserSession {
    pub id: String,
    pub username: String,
    pub global_name: String,
    pub discriminator: String,
    pub avatar_url: Option<String>,
    pub guild_id: String,
    pub is_guild_member: bool,
    pub role_ids: Vec<String>,
    pub tier: String,
    pub access_token: Option<String>,
    pub server_nickname: Option<String>,
    pub authenticated_at: String,
}

#[derive(Debug, Deserialize)]
struct GitTreeResponse {
    tree: Vec<GitTreeNode>,
}

#[derive(Debug, Deserialize)]
struct GitTreeNode {
    path: String,
    #[serde(rename = "type")]
    node_type: String,
    sha: String,
    size: Option<u64>,
}

fn get_portable_data_dir() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let portable_dir = exe_dir.join("gtfo_portable_data");
            if fs::create_dir_all(&portable_dir).is_ok() {
                return portable_dir;
            }
        }
    }
    let fallback = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("GTFO_Companion_App");
    let _ = fs::create_dir_all(&fallback);
    fallback
}

fn get_installed_state_file() -> PathBuf {
    get_portable_data_dir().join("installed_assets.json")
}

fn load_installed_records() -> Vec<InstalledAssetRecord> {
    let path = get_installed_state_file();
    if let Ok(data) = fs::read_to_string(path) {
        if let Ok(records) = serde_json::from_str::<Vec<InstalledAssetRecord>>(&data) {
            return records;
        }
    }
    Vec::new()
}

fn save_installed_records(records: &[InstalledAssetRecord]) -> Result<(), String> {
    let path = get_installed_state_file();
    let json = serde_json::to_string_pretty(records).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn compute_git_blob_sha1(path: &Path, expected_size: u64) -> Option<String> {
    let metadata = fs::metadata(path).ok()?;
    if metadata.len() != expected_size {
        return None;
    }
    let mut file = File::open(path).ok()?;
    let mut hasher = Sha1::new();
    let header = format!("blob {}\0", expected_size);
    hasher.update(header.as_bytes());

    let mut buffer = [0u8; 65536];
    loop {
        let n = file.read(&mut buffer).ok()?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Some(hex::encode(hasher.finalize()))
}

#[tauri::command]
fn detect_dcs_paths(custom_override: Option<String>) -> Result<DcsEnvironmentInfo, String> {
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".into());
    let saved_games_root = PathBuf::from(&user_profile).join("Saved Games");

    let dcs_path = saved_games_root.join("DCS");
    let openbeta_path = saved_games_root.join("DCS.openbeta");

    let dcs_exists = dcs_path.exists();
    let openbeta_exists = openbeta_path.exists();

    let mut candidates = vec![
        DcsPathCandidate {
            label: "DCS (Saved Games)".to_string(),
            path: dcs_path.to_string_lossy().to_string(),
            exists: dcs_exists,
            variant: "release".to_string(),
        },
    ];

    if openbeta_exists {
        candidates.push(DcsPathCandidate {
            label: "DCS.openbeta (Legacy)".to_string(),
            path: openbeta_path.to_string_lossy().to_string(),
            exists: true,
            variant: "openbeta".to_string(),
        });
    }

    let active_path = if let Some(custom) = custom_override {
        if !custom.trim().is_empty() {
            custom
        } else if dcs_exists {
            dcs_path.to_string_lossy().to_string()
        } else if openbeta_exists {
            openbeta_path.to_string_lossy().to_string()
        } else {
            dcs_path.to_string_lossy().to_string()
        }
    } else if dcs_exists {
        dcs_path.to_string_lossy().to_string()
    } else if openbeta_exists {
        openbeta_path.to_string_lossy().to_string()
    } else {
        dcs_path.to_string_lossy().to_string()
    };

    Ok(DcsEnvironmentInfo {
        active_saved_games_path: active_path,
        detected_candidates: candidates,
        saved_games_root: saved_games_root.to_string_lossy().to_string(),
    })
}

#[tauri::command]
async fn fetch_remote_manifest(
    manifest_url: String,
    access_token: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("GTFO-Companion-App")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client
        .get(&manifest_url)
        .header("Accept", "application/json");

    if let Some(token) = access_token {
        if !token.trim().is_empty() {
            req = req.bearer_auth(token.trim());
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Failed to reach manifest URL: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Manifest server returned HTTP {}", resp.status()));
    }

    let manifest_json = resp
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Invalid manifest JSON response: {}", e))?;

    let cache_path = get_portable_data_dir().join("cached_manifest.json");
    if let Ok(serialized) = serde_json::to_string_pretty(&manifest_json) {
        let _ = fs::write(cache_path, serialized);
    }

    Ok(manifest_json)
}

#[tauri::command]
async fn fetch_remote_member_profile(
    endpoint_url: String,
    access_token: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("GTFO-Companion-App")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client
        .get(&endpoint_url)
        .header("Accept", "application/json");

    if let Some(token) = access_token {
        if !token.trim().is_empty() {
            req = req.bearer_auth(token.trim());
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Failed to reach member portal endpoint: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Member portal returned HTTP {}", resp.status()));
    }

    resp.json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Invalid member profile JSON: {}", e))
}

#[tauri::command]
fn get_installed_assets() -> Result<Vec<InstalledAssetRecord>, String> {
    Ok(load_installed_records())
}

fn collect_files_recursively(dir: &Path, out: &mut Vec<String>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                collect_files_recursively(&p, out);
            } else if p.is_file() {
                out.push(p.to_string_lossy().to_string());
            }
        }
    }
}

/// Scans the user's local DCS Saved Games directory against the manifest to detect
/// liveries and mods that were already installed (via install.bat, PowerShell scripts, or manually).
#[tauri::command]
fn scan_existing_installations(
    dcs_saved_games_path: String,
    assets: Vec<AssetItem>,
) -> Result<Vec<InstalledAssetRecord>, String> {
    let base_dcs = PathBuf::from(&dcs_saved_games_path);
    if !base_dcs.exists() {
        return Ok(load_installed_records());
    }

    let mut records = load_installed_records();

    // Prune any cached records whose folders were deleted or that are no longer in the live manifest
    records.retain(|rec| {
        let p = Path::new(&rec.installed_path);
        if !p.exists() {
            return false;
        }
        if let Some(matching_asset) = assets.iter().find(|a| a.id == rec.asset_id) {
            if let Some(det_path) = &matching_asset.detection_path {
                if !det_path.trim().is_empty() {
                    let clean_det = det_path.trim_matches(|c| c == '/' || c == '\\').replace('/', "\\");
                    return base_dcs.join(&clean_det).exists();
                }
            }
            if p.to_string_lossy().trim_end_matches(['/', '\\']).eq_ignore_ascii_case(
                base_dcs.to_string_lossy().trim_end_matches(['/', '\\'])
            ) {
                return false;
            }
            true
        } else {
            false
        }
    });

    for asset in assets {
        // Handle external tools with detection_path (e.g. DCS-SRS hook)
        if let Some(det_path) = &asset.detection_path {
            if !det_path.trim().is_empty() {
                let clean_det = det_path.trim_matches(|c| c == '/' || c == '\\').replace('/', "\\");
                let hook_file = base_dcs.join(&clean_det);
                if hook_file.exists() {
                    let installed_path = hook_file.to_string_lossy().to_string();
                    let found_files = vec![installed_path.clone()];
                    if let Some(existing_rec) = records.iter_mut().find(|r| r.asset_id == asset.id) {
                        existing_rec.installed_path = installed_path;
                        existing_rec.extracted_files = found_files;
                        existing_rec.installed_version = asset.version.clone();
                    } else {
                        records.push(InstalledAssetRecord {
                            asset_id: asset.id.clone(),
                            name: asset.name.clone(),
                            category: asset.category.clone(),
                            aircraft_or_module: asset.aircraft_or_module.clone(),
                            installed_version: asset.version.clone(),
                            target_folder: asset.target_folder.clone(),
                            install_folder_name: asset.install_folder_name.clone(),
                            installed_path,
                            installed_at: chrono::Utc::now().to_rfc3339(),
                            sha256: asset.sha256.clone(),
                            extracted_files: found_files,
                        });
                    }
                }
                continue;
            }
        }

        // Avoid checking root Saved Games\DCS when target_folder and install_folder_name are empty
        if asset.target_folder.trim().is_empty()
            && asset.install_folder_name.trim().is_empty()
            && asset.github_path_prefixes.is_none()
        {
            continue;
        }

        let target_rel = asset
            .target_folder
            .trim_matches(|c| c == '/' || c == '\\')
            .replace('/', "\\");
        let check_dir = if asset.install_folder_name.is_empty() {
            base_dcs.join(&target_rel)
        } else {
            base_dcs.join(&target_rel).join(&asset.install_folder_name)
        };

        if !check_dir.exists() {
            continue;
        }

        // For multi-prefix packs (or the full bundle), check that all prefixes exist locally
        if let Some(prefixes) = &asset.github_path_prefixes {
            if asset.install_folder_name.is_empty() {
                // Full bundle: only mark installed if the root Liveries/.gtfo-version exists
                // or if A-10CII, F-16C_50, FA-18C_hornet, and F-14A-135-GR all exist
                let has_bundle_marker = check_dir.join(".gtfo-version").exists();
                let has_core_folders = base_dcs.join("Liveries\\F-16C_50\\507thFS").exists()
                    && base_dcs.join("Liveries\\FA-18C_hornet\\449thTFS").exists()
                    && base_dcs.join("Liveries\\A-10CII\\191st Grey").exists()
                    && base_dcs.join("Liveries\\C-130J-30\\Global Task Force Overlord").exists();
                if !has_bundle_marker && !has_core_folders {
                    continue;
                }
            } else if prefixes.len() > 1 {
                let all_present = prefixes.iter().all(|pref| {
                    let rel = pref.trim_end_matches('/').replace('/', "\\");
                    base_dcs.join(rel).exists()
                });
                if !all_present {
                    continue;
                }
            }
        }

        // Collect existing files inside the asset folder
        let mut found_files = Vec::new();
        if let Some(prefixes) = &asset.github_path_prefixes {
            if prefixes.len() > 1 && !asset.install_folder_name.is_empty() {
                for pref in prefixes {
                    let rel = pref.trim_end_matches('/').replace('/', "\\");
                    collect_files_recursively(&base_dcs.join(rel), &mut found_files);
                }
            } else {
                collect_files_recursively(&check_dir, &mut found_files);
            }
        } else {
            collect_files_recursively(&check_dir, &mut found_files);
        }

        if found_files.is_empty() {
            continue;
        }

        // Read version from .gtfo-version or .gtfo-airfield-lighting-version if present
        let version_file_1 = check_dir.join(".gtfo-version");
        let version_file_2 = check_dir.join(".gtfo-airfield-lighting-version");
        let root_liveries_version = base_dcs.join("Liveries").join(".gtfo-version");

        let detected_version = if let Ok(v) = fs::read_to_string(&version_file_1) {
            v.trim().to_string()
        } else if let Ok(v) = fs::read_to_string(&version_file_2) {
            v.trim().to_string()
        } else if asset.category == "livery" && root_liveries_version.exists() {
            // If installed via install-gtfo-liveries.ps1 which writes Liveries\.gtfo-version
            if let Some(expected_count) = asset.file_count {
                if found_files.len() >= expected_count as usize {
                    asset.version.clone()
                } else {
                    "partial".to_string()
                }
            } else {
                asset.version.clone()
            }
        } else if let Some(expected_count) = asset.file_count {
            if found_files.len() >= expected_count as usize {
                asset.version.clone()
            } else {
                "outdated".to_string()
            }
        } else {
            asset.version.clone()
        };

        if let Some(existing_rec) = records.iter_mut().find(|r| r.asset_id == asset.id) {
            if existing_rec.extracted_files.len() < found_files.len() {
                existing_rec.extracted_files = found_files;
            }
            existing_rec.installed_path = check_dir.to_string_lossy().to_string();
        } else {
            records.push(InstalledAssetRecord {
                asset_id: asset.id.clone(),
                name: asset.name.clone(),
                category: asset.category.clone(),
                aircraft_or_module: asset.aircraft_or_module.clone(),
                installed_version: detected_version,
                target_folder: asset.target_folder.clone(),
                install_folder_name: asset.install_folder_name.clone(),
                installed_path: check_dir.to_string_lossy().to_string(),
                installed_at: chrono::Utc::now().to_rfc3339(),
                sha256: asset.sha256.clone(),
                extracted_files: found_files,
            });
        }
    }

    let _ = save_installed_records(&records);
    Ok(records)
}

#[tauri::command]
async fn install_asset(
    app: AppHandle,
    asset: AssetItem,
    dcs_saved_games_path: String,
    verify_hash: bool,
) -> Result<InstalledAssetRecord, String> {
    let base_dcs = PathBuf::from(&dcs_saved_games_path);
    let target_rel = asset
        .target_folder
        .trim_matches(|c| c == '/' || c == '\\')
        .replace('/', "\\");
    let destination_dir = if asset.install_folder_name.is_empty() {
        base_dcs.join(&target_rel)
    } else {
        base_dcs.join(&target_rel).join(&asset.install_folder_name)
    };

    fs::create_dir_all(&destination_dir)
        .map_err(|e| format!("Failed to create destination folder {:?}: {}", destination_dir, e))?;

    let mut extracted_files: Vec<String> = Vec::new();

    if let Some(repo) = &asset.github_repo {
        let branch = asset.github_branch.clone().unwrap_or_else(|| "main".to_string());
        let prefixes = asset.github_path_prefixes.clone().unwrap_or_default();

        let _ = app.emit(
            "asset-download-progress",
            DownloadProgressEvent {
                asset_id: asset.id.clone(),
                stage: "connecting".into(),
                bytes_downloaded: 0,
                total_bytes: asset.file_size_bytes,
                percent: 2,
                message: format!("Querying GitHub tree for {} ({})...", repo, branch),
            },
        );

        let client = reqwest::Client::builder()
            .user_agent("GTFO-Companion-App")
            .build()
            .map_err(|e| e.to_string())?;

        let tree_url = format!(
            "https://api.github.com/repos/{}/git/trees/{}?recursive=1",
            repo, branch
        );
        let tree_resp = client
            .get(&tree_url)
            .send()
            .await
            .map_err(|e| format!("Failed to query GitHub tree {}: {}", tree_url, e))?;

        if !tree_resp.status().is_success() {
            return Err(format!(
                "GitHub API returned HTTP {} for {}",
                tree_resp.status(),
                tree_url
            ));
        }

        let tree_data: GitTreeResponse = tree_resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse GitHub tree JSON: {}", e))?;

        let matching_blobs: Vec<GitTreeNode> = tree_data
            .tree
            .into_iter()
            .filter(|node| {
                node.node_type == "blob"
                    && (prefixes.is_empty()
                        || prefixes.iter().any(|pref| node.path.starts_with(pref)))
            })
            .collect();

        if matching_blobs.is_empty() {
            return Err(format!("No matching files found in GitHub repository {}", repo));
        }

        let total_files = matching_blobs.len();
        let mut bytes_processed: u64 = 0;
        let total_bytes: u64 = matching_blobs
            .iter()
            .map(|b| b.size.unwrap_or(0))
            .sum::<u64>()
            .max(1);

        let mut skipped_count = 0usize;
        let mut downloaded_count = 0usize;

        for (idx, blob) in matching_blobs.iter().enumerate() {
            let rel_windows = blob.path.replace('/', "\\");
            let local_file_path = base_dcs.join(&rel_windows);
            let file_size = blob.size.unwrap_or(0);

            let pct = (((idx + 1) as f64 / total_files as f64) * 95.0).min(95.0) as u8;
            let short_name = blob.path.split('/').last().unwrap_or(&blob.path);

            let is_up_to_date = if verify_hash && local_file_path.exists() {
                compute_git_blob_sha1(&local_file_path, file_size)
                    .map(|h| h.eq_ignore_ascii_case(&blob.sha))
                    .unwrap_or(false)
            } else {
                false
            };

            if is_up_to_date {
                skipped_count += 1;
                bytes_processed += file_size;
                extracted_files.push(local_file_path.to_string_lossy().to_string());
                let _ = app.emit(
                    "asset-download-progress",
                    DownloadProgressEvent {
                        asset_id: asset.id.clone(),
                        stage: "verifying".into(),
                        bytes_downloaded: bytes_processed,
                        total_bytes,
                        percent: pct.max(5),
                        message: format!(
                            "[{}/{}] Up-to-date (SHA-1 verified): {}",
                            idx + 1,
                            total_files,
                            short_name
                        ),
                    },
                );
                continue;
            }

            let _ = app.emit(
                "asset-download-progress",
                DownloadProgressEvent {
                    asset_id: asset.id.clone(),
                    stage: "downloading".into(),
                    bytes_downloaded: bytes_processed,
                    total_bytes,
                    percent: pct.max(5),
                    message: format!(
                        "[{}/{}] Downloading {} ({:.1} MB)...",
                        idx + 1,
                        total_files,
                        short_name,
                        file_size as f64 / 1_048_576.0
                    ),
                },
            );

            if let Some(parent) = local_file_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }

            let encoded_path = blob
                .path
                .split('/')
                .map(|seg| urlencoding::encode(seg).into_owned())
                .collect::<Vec<_>>()
                .join("/");

            let raw_url = format!(
                "https://raw.githubusercontent.com/{}/{}/{}",
                repo, branch, encoded_path
            );

            let file_resp = client
                .get(&raw_url)
                .send()
                .await
                .map_err(|e| format!("Failed downloading {}: {}", short_name, e))?;

            if !file_resp.status().is_success() {
                return Err(format!(
                    "HTTP {} downloading {}",
                    file_resp.status(),
                    raw_url
                ));
            }

            let mut out_file = File::create(&local_file_path)
                .map_err(|e| format!("Failed to create {:?}: {}", local_file_path, e))?;

            let mut stream = file_resp.bytes_stream();
            while let Some(chunk_res) = stream.next().await {
                let chunk = chunk_res.map_err(|e| e.to_string())?;
                out_file.write_all(&chunk).map_err(|e| e.to_string())?;
                bytes_processed += chunk.len() as u64;
            }
            out_file.flush().map_err(|e| e.to_string())?;
            downloaded_count += 1;
            extracted_files.push(local_file_path.to_string_lossy().to_string());
        }

        let version_marker = destination_dir.join(".gtfo-version");
        let _ = fs::write(&version_marker, &asset.version);
        extracted_files.push(version_marker.to_string_lossy().to_string());

        let _ = app.emit(
            "asset-download-progress",
            DownloadProgressEvent {
                asset_id: asset.id.clone(),
                stage: "completed".into(),
                bytes_downloaded: total_bytes,
                total_bytes,
                percent: 100,
                message: format!(
                    "Sync complete: {} downloaded, {} already current.",
                    downloaded_count, skipped_count
                ),
            },
        );
    } else {
        let client = reqwest::Client::builder()
            .user_agent("GTFO-Companion-App/1.0 (Windows NT 10.0; Win64; x64)")
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        let resp = client
            .get(&asset.download_url)
            .send()
            .await
            .map_err(|e| format!("Download request failed: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Server returned HTTP {}", resp.status()));
        }

        let total_size = resp.content_length().unwrap_or(asset.file_size_bytes.max(1));
        let temp_zip_path = get_portable_data_dir().join(format!("{}.tmp.zip", asset.id));

        let mut file = File::create(&temp_zip_path)
            .map_err(|e| format!("Failed to create temporary archive: {}", e))?;

        let mut downloaded: u64 = 0;
        let mut hasher = Sha256::new();
        let mut stream = resp.bytes_stream();

        while let Some(chunk_res) = stream.next().await {
            let chunk = chunk_res.map_err(|e| format!("Download stream error: {}", e))?;
            file.write_all(&chunk)
                .map_err(|e| format!("Disk write error: {}", e))?;
            hasher.update(&chunk);
            downloaded += chunk.len() as u64;

            let pct = ((downloaded as f64 / total_size as f64) * 90.0).min(90.0) as u8;
            let _ = app.emit(
                "asset-download-progress",
                DownloadProgressEvent {
                    asset_id: asset.id.clone(),
                    stage: "downloading".into(),
                    bytes_downloaded: downloaded,
                    total_bytes: total_size,
                    percent: pct.max(5),
                    message: format!(
                        "Downloading archive ({:.1} MB)...",
                        downloaded as f64 / 1_048_576.0
                    ),
                },
            );
        }
        file.flush().map_err(|e| e.to_string())?;
        drop(file);

        let computed_hash = hex::encode(hasher.finalize());
        if verify_hash
            && !asset.sha256.is_empty()
            && asset.sha256.len() == 64
            && !computed_hash.eq_ignore_ascii_case(&asset.sha256)
        {
            let _ = fs::remove_file(&temp_zip_path);
            return Err(format!(
                "SHA-256 checksum mismatch! Expected {}, got {}",
                asset.sha256, computed_hash
            ));
        }

        let mut zip_file = File::open(&temp_zip_path).map_err(|e| e.to_string())?;
        let file_len = zip_file.metadata().map(|m| m.len()).unwrap_or(0);

        if file_len == 0 {
            let _ = fs::remove_file(&temp_zip_path);
            return Err("Downloaded archive is 0 bytes (empty file). Please verify the asset download URL.".to_string());
        }

        // Validate magic header bytes to give pilots actionable error messages
        let mut header = [0u8; 16];
        let bytes_read = zip_file.read(&mut header).unwrap_or(0);
        let _ = zip_file.seek(SeekFrom::Start(0));

        if bytes_read >= 4 && &header[0..4] == b"Rar!" {
            let _ = fs::remove_file(&temp_zip_path);
            return Err("The downloaded file is a RAR archive (.rar), not a ZIP archive. Please repackage the mod as a .zip.".to_string());
        }
        if bytes_read >= 6 && &header[0..6] == b"7z\xbc\xaf\x27\x1c" {
            let _ = fs::remove_file(&temp_zip_path);
            return Err("The downloaded file is a 7-Zip archive (.7z), not a ZIP archive. Please repackage the mod as a .zip.".to_string());
        }
        if bytes_read >= 1 && (header[0] == b'<' || header[0] == b'{') {
            let mut text_buf = vec![0u8; 256];
            let n = zip_file.read(&mut text_buf).unwrap_or(0);
            let snippet = String::from_utf8_lossy(&text_buf[..n]);
            let _ = fs::remove_file(&temp_zip_path);
            return Err(format!(
                "The server returned an HTML/API response instead of a ZIP file (size: {} bytes). Response: {}",
                file_len,
                snippet.trim().replace('\n', " ").chars().take(120).collect::<String>()
            ));
        }

        let mut archive =
            zip::ZipArchive::new(zip_file).map_err(|e| format!("Invalid ZIP archive: {}", e))?;

        let explicit_prefix = asset.archive_subfolder.as_ref().map(|s| {
            s.trim_matches(|c| c == '/' || c == '\\').replace('\\', "/")
        });

        // 1. Detect if the zip archive is OvGME / DCS-Root formatted (direct or 1-level folder wrapped)
        let mut ovgme_strip_prefix: Option<String> = None;
        if explicit_prefix.is_none() {
            let dcs_roots = ["Mods/", "Liveries/", "Scripts/", "Bazar/", "Kneeboard/", "Config/"];
            for i in 0..archive.len() {
                if let Ok(entry) = archive.by_index(i) {
                    let name = entry.name().replace('\\', "/");
                    // Direct layout: Mods/..., Liveries/..., etc.
                    if dcs_roots.iter().any(|r| name.starts_with(r)) {
                        ovgme_strip_prefix = Some(String::new());
                        break;
                    }
                    // 1-level wrapped layout: <ModNameFolder>/Mods/..., <ModNameFolder>/Liveries/..., etc.
                    for r in &dcs_roots {
                        let search = format!("/{}", r);
                        if let Some(pos) = name.find(&search) {
                            let prefix = &name[..=pos]; // includes the trailing slash
                            if prefix.trim_end_matches('/').chars().filter(|&c| c == '/').count() == 0 {
                                ovgme_strip_prefix = Some(prefix.to_string());
                                break;
                            }
                        }
                    }
                    if ovgme_strip_prefix.is_some() {
                        break;
                    }
                }
            }
        }

        // 2. Extract archive entries
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            let Some(enclosed_path) = entry.enclosed_name().map(|p| p.to_owned()) else {
                continue;
            };

            let path_str = enclosed_path.to_string_lossy().replace('\\', "/");

            let outpath = if let Some(prefix) = &explicit_prefix {
                if !path_str.starts_with(prefix) {
                    continue;
                }
                let rel = path_str[prefix.len()..].trim_start_matches('/').to_string();
                if rel.is_empty() {
                    continue;
                }
                destination_dir.join(rel)
            } else if let Some(strip_prefix) = &ovgme_strip_prefix {
                // If the archive has a top-level wrapper folder, strip it
                let dcs_rel_path = if strip_prefix.is_empty() {
                    path_str.clone()
                } else if path_str.starts_with(strip_prefix) {
                    path_str[strip_prefix.len()..].to_string()
                } else {
                    // Skip loose files outside the main mod folder
                    continue;
                };

                let is_dcs_content = dcs_rel_path.starts_with("Mods/")
                    || dcs_rel_path.starts_with("Liveries/")
                    || dcs_rel_path.starts_with("Scripts/")
                    || dcs_rel_path.starts_with("Bazar/")
                    || dcs_rel_path.starts_with("Kneeboard/")
                    || dcs_rel_path.starts_with("Config/");

                if !is_dcs_content {
                    // Skip loose root documentation files so they don't pollute Saved Games root
                    continue;
                }

                base_dcs.join(Path::new(&dcs_rel_path))
            } else {
                destination_dir.join(enclosed_path)
            };

            if entry.name().ends_with('/') {
                fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
            } else {
                if let Some(parent) = outpath.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
                io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
                extracted_files.push(outpath.to_string_lossy().to_string());
            }
        }

        let _ = fs::remove_file(&temp_zip_path);
    }

    let actual_installed_path = if !asset.install_folder_name.is_empty() {
        destination_dir.clone()
    } else if let Some(first_file) = extracted_files.iter().find(|f| {
        f.contains("Mods\\aircraft\\") || f.contains("Mods/aircraft/")
            || f.contains("Mods\\tech\\") || f.contains("Mods/tech/")
    }) {
        let p = Path::new(first_file);
        let mut found = p.to_path_buf();
        let mut cursor = p;
        while let Some(parent) = cursor.parent() {
            if parent.ends_with("Mods\\aircraft") || parent.ends_with("Mods/aircraft")
                || parent.ends_with("Mods\\tech") || parent.ends_with("Mods/tech")
            {
                found = parent.join(cursor.file_name().unwrap_or_default());
                break;
            }
            cursor = parent;
        }
        found
    } else {
        destination_dir.clone()
    };

    let record = InstalledAssetRecord {
        asset_id: asset.id.clone(),
        name: asset.name.clone(),
        category: asset.category.clone(),
        aircraft_or_module: asset.aircraft_or_module.clone(),
        installed_version: asset.version.clone(),
        target_folder: asset.target_folder.clone(),
        install_folder_name: asset.install_folder_name.clone(),
        installed_path: actual_installed_path.to_string_lossy().to_string(),
        installed_at: chrono::Utc::now().to_rfc3339(),
        sha256: asset.sha256.clone(),
        extracted_files,
    };

    let mut existing = load_installed_records();
    existing.retain(|r| r.asset_id != asset.id);
    existing.push(record.clone());
    save_installed_records(&existing)?;

    Ok(record)
}

#[tauri::command]
fn uninstall_asset(
    asset_id: String,
    installed_path: String,
    _dcs_saved_games_path: String,
) -> Result<(), String> {
    let mut existing = load_installed_records();
    if let Some(rec) = existing.iter().find(|r| r.asset_id == asset_id) {
        for f in &rec.extracted_files {
            let p = Path::new(f);
            if p.exists() && p.is_file() {
                let _ = fs::remove_file(p);
            }
        }
    }

    let target_dir = PathBuf::from(&installed_path);
    if target_dir.is_file() {
        let _ = fs::remove_file(&target_dir);
    } else if target_dir.is_dir()
        && target_dir
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| {
                !s.eq_ignore_ascii_case("Liveries")
                    && !s.eq_ignore_ascii_case("tech")
                    && !s.eq_ignore_ascii_case("aircraft")
                    && !s.eq_ignore_ascii_case("Mods")
                    && !s.eq_ignore_ascii_case("DCS")
                    && !s.eq_ignore_ascii_case("Scripts")
                    && !s.eq_ignore_ascii_case("Hooks")
            })
            .unwrap_or(false)
    {
        let _ = fs::remove_dir_all(&target_dir);
    }

    existing.retain(|r| r.asset_id != asset_id);
    save_installed_records(&existing)?;

    Ok(())
}

#[tauri::command]
async fn verify_asset_integrity(
    installed_path: String,
    extracted_files: Vec<String>,
    asset: Option<AssetItem>,
    dcs_saved_games_path: Option<String>,
) -> Result<IntegrityResult, String> {
    let base = Path::new(&installed_path);
    if !base.exists() {
        return Ok(IntegrityResult {
            valid: false,
            missing_files: vec![installed_path],
            modified_files: Vec::new(),
            checked_count: 0,
        });
    }

    if let (Some(asset_item), Some(dcs_root)) = (&asset, &dcs_saved_games_path) {
        if let Some(repo) = &asset_item.github_repo {
            if !repo.trim().is_empty() {
                let branch = asset_item
                    .github_branch
                    .clone()
                    .unwrap_or_else(|| "main".to_string());
                let prefixes = asset_item.github_path_prefixes.clone().unwrap_or_default();
                let tree_url = format!(
                    "https://api.github.com/repos/{}/git/trees/{}?recursive=1",
                    repo, branch
                );

                if let Ok(client) = reqwest::Client::builder()
                    .user_agent("GTFO-Companion-App")
                    .timeout(std::time::Duration::from_secs(10))
                    .build()
                {
                    if let Ok(resp) = client.get(&tree_url).send().await {
                        if resp.status().is_success() {
                            if let Ok(tree_data) = resp.json::<GitTreeResponse>().await {
                                let matching_blobs: Vec<GitTreeNode> = tree_data
                                    .tree
                                    .into_iter()
                                    .filter(|node| {
                                        node.node_type == "blob"
                                            && (prefixes.is_empty()
                                                || prefixes
                                                    .iter()
                                                    .any(|pref| node.path.starts_with(pref)))
                                    })
                                    .collect();

                                if !matching_blobs.is_empty() {
                                    let base_dcs = PathBuf::from(dcs_root);
                                    let mut missing = Vec::new();
                                    let mut modified = Vec::new();
                                    let mut canonical_files = Vec::new();

                                    for blob in &matching_blobs {
                                        let rel_windows = blob.path.replace('/', "\\");
                                        let local_file_path = base_dcs.join(&rel_windows);
                                        canonical_files
                                            .push(local_file_path.to_string_lossy().to_string());

                                        if !local_file_path.exists() {
                                            missing.push(blob.path.clone());
                                        } else {
                                            let expected_size = blob.size.unwrap_or(0);
                                            let matches_sha =
                                                compute_git_blob_sha1(&local_file_path, expected_size)
                                                    .map(|h| h.eq_ignore_ascii_case(&blob.sha))
                                                    .unwrap_or(false);
                                            if !matches_sha {
                                                modified.push(blob.path.clone());
                                            }
                                        }
                                    }

                                    let mut records = load_installed_records();
                                    if let Some(rec) =
                                        records.iter_mut().find(|r| r.asset_id == asset_item.id)
                                    {
                                        rec.extracted_files = canonical_files;
                                        let _ = save_installed_records(&records);
                                    }

                                    return Ok(IntegrityResult {
                                        valid: missing.is_empty() && modified.is_empty(),
                                        missing_files: missing,
                                        modified_files: modified,
                                        checked_count: matching_blobs.len(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let mut missing = Vec::new();
    for file_str in &extracted_files {
        if !Path::new(file_str).exists() {
            missing.push(file_str.clone());
        }
    }

    if let Some(asset_item) = &asset {
        if let Some(expected_count) = asset_item.file_count {
            let mut disk_files = Vec::new();
            collect_files_recursively(base, &mut disk_files);
            let actual_count = disk_files
                .iter()
                .filter(|f| {
                    !f.ends_with(".gtfo-version")
                        && !f.ends_with(".gtfo-airfield-lighting-version")
                })
                .count();
            if actual_count < expected_count as usize && missing.is_empty() {
                missing.push(format!(
                    "{} file(s) missing from package directory (found {}, expected {})",
                    expected_count as usize - actual_count,
                    actual_count,
                    expected_count
                ));
            }
        }
    }

    Ok(IntegrityResult {
        valid: missing.is_empty(),
        missing_files: missing,
        modified_files: Vec::new(),
        checked_count: extracted_files.len(),
    })
}

#[tauri::command]
async fn verify_discord_token(
    access_token: String,
    guild_id: String,
    core_role_id: String,
    community_role_id: String,
) -> Result<DiscordUserSession, String> {
    fetch_discord_profile_and_guild(&access_token, &guild_id, &core_role_id, &community_role_id)
        .await
}

async fn fetch_discord_profile_and_guild(
    access_token: &str,
    guild_id: &str,
    core_role_id: &str,
    community_role_id: &str,
) -> Result<DiscordUserSession, String> {
    let client = reqwest::Client::new();

    let user_resp = client
        .get("https://discord.com/api/v10/users/@me")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Discord API request failed: {}", e))?;

    if !user_resp.status().is_success() {
        return Err(format!(
            "Discord /users/@me returned HTTP {}",
            user_resp.status()
        ));
    }

    let user_json: serde_json::Value = user_resp.json().await.map_err(|e| e.to_string())?;
    let user_id = user_json["id"].as_str().unwrap_or_default().to_string();
    let username = user_json["username"]
        .as_str()
        .unwrap_or("pilot")
        .to_string();
    let global_name = user_json["global_name"]
        .as_str()
        .unwrap_or(&username)
        .to_string();
    let discriminator = user_json["discriminator"]
        .as_str()
        .unwrap_or("0")
        .to_string();
    let avatar_url = user_json["avatar"].as_str().map(|hash| {
        format!(
            "https://cdn.discordapp.com/avatars/{}/{}.png?size=128",
            user_id, hash
        )
    });

    let member_url = format!(
        "https://discord.com/api/v10/users/@me/guilds/{}/member",
        guild_id
    );
    let member_resp = client
        .get(&member_url)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Discord guild member query failed: {}", e))?;

    let mut is_guild_member = false;
    let mut role_ids: Vec<String> = Vec::new();
    let mut server_nickname: Option<String> = None;

    if member_resp.status().is_success() {
        is_guild_member = true;
        if let Ok(member_json) = member_resp.json::<serde_json::Value>().await {
            if let Some(nick) = member_json["nick"].as_str() {
                if !nick.trim().is_empty() {
                    server_nickname = Some(nick.trim().to_string());
                }
            }
            if let Some(arr) = member_json["roles"].as_array() {
                for r in arr {
                    if let Some(s) = r.as_str() {
                        role_ids.push(s.to_string());
                    }
                }
            }
        }
    }

    let has_core_role = role_ids.iter().any(|r| r == core_role_id);
    let has_community_role = role_ids.iter().any(|r| r == community_role_id);

    let tier = if has_core_role {
        "core"
    } else if has_community_role {
        "community"
    } else {
        "guest"
    };

    Ok(DiscordUserSession {
        id: user_id,
        username,
        global_name,
        discriminator,
        avatar_url,
        guild_id: guild_id.to_string(),
        is_guild_member,
        role_ids,
        tier: tier.to_string(),
        access_token: Some(access_token.to_string()),
        server_nickname,
        authenticated_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
async fn start_discord_oauth(
    client_id: String,
    guild_id: String,
    core_role_id: String,
    community_role_id: String,
    redirect_port: u16,
) -> Result<DiscordUserSession, String> {
    let mut random_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut random_bytes);
    let code_verifier = URL_SAFE_NO_PAD.encode(random_bytes);

    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());

    let redirect_uri = format!("http://127.0.0.1:{}/callback", redirect_port);
    let encoded_redirect = urlencoding::encode(&redirect_uri);

    let auth_url = format!(
        "https://discord.com/oauth2/authorize?client_id={}&response_type=code&redirect_uri={}&scope=identify%20guilds%20guilds.members.read&code_challenge={}&code_challenge_method=S256",
        client_id, encoded_redirect, code_challenge
    );

    let bind_addr = format!("127.0.0.1:{}", redirect_port);
    let listener = TcpListener::bind(&bind_addr).await.map_err(|e| {
        format!(
            "Failed to bind local OAuth callback port {}: {}",
            redirect_port, e
        )
    })?;

    open::that(&auth_url).map_err(|e| format!("Failed to open browser: {}", e))?;

    let (mut stream, _) = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        listener.accept(),
    )
    .await
    .map_err(|_| "Discord OAuth2 timed out waiting for browser callback.".to_string())?
    .map_err(|e| e.to_string())?;

    let mut buffer = [0u8; 4096];
    let bytes_read = stream.read(&mut buffer).await.map_err(|e| e.to_string())?;
    let request_str = String::from_utf8_lossy(&buffer[..bytes_read]);

    let first_line = request_str.lines().next().unwrap_or("");
    let code = first_line
        .split_whitespace()
        .nth(1)
        .and_then(|path| path.split('?').nth(1))
        .and_then(|query| {
            query.split('&').find_map(|pair| {
                let mut kv = pair.splitn(2, '=');
                if kv.next() == Some("code") {
                    kv.next().map(|v| v.to_string())
                } else {
                    None
                }
            })
        });

    let html_response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<!DOCTYPE html><html><head><title>GTFO Companion App // Auth Complete</title></head><body style='background:#0c0a09;color:#e7e5e4;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;'><div style='padding:36px;border:1px solid #f59e0b;border-radius:12px;background:#1c1917;text-align:center;max-width:460px;'><h2 style='color:#fbbf24;margin-top:0;letter-spacing:0.05em;'>GLOBAL TASK FORCE OVERLORD</h2><p style='color:#a8a29e;line-height:1.6;'>Your Discord clearance has been verified and transmitted to the <strong style='color:#f5f5f4;'>GTFO Companion App</strong>. You may close this browser tab.</p></div></body></html>";
    let _ = stream.write_all(html_response.as_bytes()).await;
    let _ = stream.flush().await;

    let auth_code = code.ok_or_else(|| "No authorization code received from Discord callback.".to_string())?;

    let client = reqwest::Client::new();
    let params = [
        ("client_id", client_id.as_str()),
        ("grant_type", "authorization_code"),
        ("code", auth_code.as_str()),
        ("redirect_uri", redirect_uri.as_str()),
        ("code_verifier", code_verifier.as_str()),
    ];

    let token_resp = client
        .post("https://discord.com/api/v10/oauth2/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token exchange request failed: {}", e))?;

    if !token_resp.status().is_success() {
        let body = token_resp.text().await.unwrap_or_default();
        return Err(format!(
            "Discord token exchange failed (Ensure http://127.0.0.1:{}/callback is added to Redirects in Discord Developer Portal): {}",
            redirect_port, body
        ));
    }

    let token_json: serde_json::Value = token_resp.json().await.map_err(|e| e.to_string())?;
    let access_token = token_json["access_token"]
        .as_str()
        .ok_or_else(|| "Missing access_token in Discord response".to_string())?;

    fetch_discord_profile_and_guild(access_token, &guild_id, &core_role_id, &community_role_id)
        .await
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RoutePresetManifestInfo {
    pub file_path: String,
    pub exists: bool,
    pub preset_names: Vec<String>,
    pub raw_content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RoutePresetMergeResult {
    pub file_path: String,
    pub action: String,
    pub preset_names: Vec<String>,
    pub raw_content: String,
}

fn extract_top_level_preset_names(lua_content: &str) -> Vec<String> {
    let mut names = Vec::new();
    let mut depth: i32 = 0;

    for line in lua_content.lines() {
        let trimmed = line.trim();
        // At depth 1 (inside `presets = { ... }`), look for `["Preset Name"] =`
        if depth == 1 && trimmed.starts_with("[\"") {
            if let Some(end_idx) = trimmed[2..].find("\"]") {
                let name = &trimmed[2..2 + end_idx];
                if !names.iter().any(|n| n == name) {
                    names.push(name.to_string());
                }
            }
        }
        for ch in trimmed.chars() {
            if ch == '{' {
                depth += 1;
            } else if ch == '}' {
                depth = (depth - 1).max(0);
            }
        }
    }

    names
}

fn merge_lua_preset_into_manifest(
    existing_lua: Option<&str>,
    preset_name: &str,
    lua_snippet: &str,
) -> (String, String) {
    let formatted_snippet: String = lua_snippet
        .lines()
        .map(|l| format!("    {}", l))
        .collect::<Vec<_>>()
        .join("\n");

    let Some(raw) = existing_lua else {
        let created = format!(
            "presets = \n{{\n{}\n}} -- end of presets\n",
            formatted_snippet
        );
        return (created, "created".to_string());
    };

    if !raw.contains("presets") || !raw.contains('{') {
        let created = format!(
            "presets = \n{{\n{}\n}} -- end of presets\n",
            formatted_snippet
        );
        return (created, "created".to_string());
    }

    let target_key = format!("[\"{}\"]", preset_name);
    let lines: Vec<&str> = raw.lines().collect();

    // Check if preset_name already exists at top-level of `presets`
    let mut depth: i32 = 0;
    let mut block_start: Option<usize> = None;
    let mut block_end: Option<usize> = None;
    let mut block_brace_seen = false;

    for (idx, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if block_start.is_none() && depth == 1 && trimmed.starts_with(&target_key) {
            block_start = Some(idx);
        }

        for ch in trimmed.chars() {
            if ch == '{' {
                depth += 1;
                if block_start.is_some() && depth >= 2 {
                    block_brace_seen = true;
                }
            } else if ch == '}' {
                depth = (depth - 1).max(0);
                if block_start.is_some() && block_brace_seen && depth == 1 {
                    block_end = Some(idx);
                    break;
                }
            }
        }

        if block_end.is_some() {
            break;
        }
    }

    if let (Some(start), Some(end)) = (block_start, block_end) {
        let mut updated_lines: Vec<String> = Vec::new();
        for l in &lines[..start] {
            updated_lines.push((*l).to_string());
        }
        updated_lines.push(formatted_snippet);
        for l in &lines[end + 1..] {
            updated_lines.push((*l).to_string());
        }
        return (updated_lines.join("\n") + "\n", "updated".to_string());
    }

    // Otherwise append right before the final closing `}` of `presets`
    if let Some(last_close_idx) = lines.iter().rposition(|l| l.trim().starts_with('}')) {
        let mut appended_lines: Vec<String> = Vec::new();
        for l in &lines[..last_close_idx] {
            appended_lines.push((*l).to_string());
        }
        appended_lines.push(formatted_snippet);
        for l in &lines[last_close_idx..] {
            appended_lines.push((*l).to_string());
        }
        return (appended_lines.join("\n") + "\n", "appended".to_string());
    }

    let fallback = format!(
        "presets = \n{{\n{}\n}} -- end of presets\n",
        formatted_snippet
    );
    (fallback, "created".to_string())
}

#[tauri::command]
fn install_dtc_file(
    dcs_saved_games_path: String,
    target_sub_folder: String,
    file_name: String,
    content: String,
) -> Result<String, String> {
    let base_dcs = PathBuf::from(&dcs_saved_games_path);
    let clean_sub = target_sub_folder.replace('/', "\\");
    let target_dir = base_dcs.join(clean_sub);

    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create DTC directory {:?}: {}", target_dir, e))?;

    let target_file = target_dir.join(&file_name);
    fs::write(&target_file, content.as_bytes())
        .map_err(|e| format!("Failed to write DTC file {:?}: {}", target_file, e))?;

    Ok(target_file.to_string_lossy().to_string())
}

#[tauri::command]
fn inspect_route_tool_presets(
    dcs_saved_games_path: String,
    theatre_file_name: String,
) -> Result<RoutePresetManifestInfo, String> {
    let base_dcs = PathBuf::from(&dcs_saved_games_path);
    let preset_file = base_dcs
        .join("Config")
        .join("RouteToolPresets")
        .join(&theatre_file_name);

    if !preset_file.exists() {
        return Ok(RoutePresetManifestInfo {
            file_path: preset_file.to_string_lossy().to_string(),
            exists: false,
            preset_names: Vec::new(),
            raw_content: String::new(),
        });
    }

    let raw_content = fs::read_to_string(&preset_file)
        .map_err(|e| format!("Failed reading {:?}: {}", preset_file, e))?;
    let preset_names = extract_top_level_preset_names(&raw_content);

    Ok(RoutePresetManifestInfo {
        file_path: preset_file.to_string_lossy().to_string(),
        exists: true,
        preset_names,
        raw_content,
    })
}

#[tauri::command]
fn merge_route_tool_preset(
    dcs_saved_games_path: String,
    theatre_file_name: String,
    preset_name: String,
    lua_snippet: String,
) -> Result<RoutePresetMergeResult, String> {
    let base_dcs = PathBuf::from(&dcs_saved_games_path);
    let presets_dir = base_dcs.join("Config").join("RouteToolPresets");

    fs::create_dir_all(&presets_dir).map_err(|e| {
        format!(
            "Failed to create Config\\RouteToolPresets directory {:?}: {}",
            presets_dir, e
        )
    })?;

    let preset_file = presets_dir.join(&theatre_file_name);
    let existing_content = if preset_file.exists() {
        fs::read_to_string(&preset_file).ok()
    } else {
        None
    };

    let (merged_content, action) = merge_lua_preset_into_manifest(
        existing_content.as_deref(),
        &preset_name,
        &lua_snippet,
    );

    fs::write(&preset_file, merged_content.as_bytes()).map_err(|e| {
        format!(
            "Failed to write RouteToolPresets manifest {:?}: {}",
            preset_file, e
        )
    })?;

    let preset_names = extract_top_level_preset_names(&merged_content);

    Ok(RoutePresetMergeResult {
        file_path: preset_file.to_string_lossy().to_string(),
        action,
        preset_names,
        raw_content: merged_content,
    })
}

#[tauri::command]
fn install_atc_kneeboard(
    dcs_saved_games_path: String,
    target_folder: String,
    file_name: String,
    svg_content: String,
) -> Result<String, String> {
    let base_dcs = PathBuf::from(&dcs_saved_games_path);
    let clean_sub = target_folder.replace('/', "\\");
    let target_dir = base_dcs.join(clean_sub);

    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create Kneeboard directory {:?}: {}", target_dir, e))?;

    let target_file = target_dir.join(&file_name);
    fs::write(&target_file, svg_content.as_bytes())
        .map_err(|e| format!("Failed to write Kneeboard file {:?}: {}", target_file, e))?;

    Ok(target_file.to_string_lossy().to_string())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Only http/https URLs are permitted.".to_string());
    }
    open::that(&url).map_err(|e| format!("Failed to open browser for {}: {}", url, e))
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DcsNicknameInfo {
    pub current_nickname: Option<String>,
    pub nicknames: Vec<String>,
    pub file_path: String,
    pub file_exists: bool,
}

fn parse_nicknames_lua(content: &str) -> Vec<(usize, String)> {
    let mut entries = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with('[') {
            continue;
        }
        if let Some(close_bracket) = trimmed.find(']') {
            let idx_str = trimmed[1..close_bracket].trim();
            if let Ok(idx) = idx_str.parse::<usize>() {
                if let Some(eq_pos) = trimmed[close_bracket..].find('=') {
                    let after_eq = trimmed[close_bracket + eq_pos + 1..].trim();
                    let quote_char = if after_eq.starts_with('"') {
                        Some('"')
                    } else if after_eq.starts_with('\'') {
                        Some('\'')
                    } else {
                        None
                    };
                    if let Some(q) = quote_char {
                        let rest = &after_eq[1..];
                        if let Some(end_quote) = rest.find(q) {
                            let name = &rest[..end_quote];
                            entries.push((idx, name.to_string()));
                        }
                    }
                }
            }
        }
    }
    entries.sort_by_key(|&(idx, _)| idx);
    entries
}

fn serialize_nicknames_lua(names: &[String]) -> String {
    let mut out = String::from("nicknames = \r\n{\r\n");
    for (i, name) in names.iter().enumerate() {
        let safe_name = name.replace('\\', "\\\\").replace('"', "\\\"");
        out.push_str(&format!("\t[{}] = \"{}\",\r\n", i + 1, safe_name));
    }
    out.push_str("} -- end of nicknames\r\n");
    out
}

fn resolve_nicknames_file(dcs_saved_games_path: &str) -> (PathBuf, Option<PathBuf>) {
    let base_dcs = PathBuf::from(dcs_saved_games_path);
    let config_file = base_dcs.join("Config").join("nicknames.lua");
    let mission_file = base_dcs.join("MissionEditor").join("nicknames.lua");

    if config_file.exists() && mission_file.exists() {
        (config_file, Some(mission_file))
    } else if config_file.exists() {
        (config_file, None)
    } else if mission_file.exists() {
        (mission_file, None)
    } else {
        (config_file, None)
    }
}

#[tauri::command]
fn get_dcs_nickname(dcs_saved_games_path: String) -> Result<DcsNicknameInfo, String> {
    let (primary_path, _) = resolve_nicknames_file(&dcs_saved_games_path);
    if !primary_path.exists() {
        return Ok(DcsNicknameInfo {
            current_nickname: None,
            nicknames: Vec::new(),
            file_path: primary_path.to_string_lossy().to_string(),
            file_exists: false,
        });
    }

    let content = fs::read_to_string(&primary_path)
        .map_err(|e| format!("Failed to read {:?}: {}", primary_path, e))?;

    let entries = parse_nicknames_lua(&content);
    let nicknames: Vec<String> = entries.into_iter().map(|(_, n)| n).collect();
    let current_nickname = nicknames.first().cloned();

    Ok(DcsNicknameInfo {
        current_nickname,
        nicknames,
        file_path: primary_path.to_string_lossy().to_string(),
        file_exists: true,
    })
}

#[tauri::command]
fn update_dcs_nickname(
    dcs_saved_games_path: String,
    new_nickname: String,
) -> Result<DcsNicknameInfo, String> {
    let trimmed = new_nickname.trim();
    if trimmed.is_empty() {
        return Err("Nickname cannot be empty.".to_string());
    }

    let (primary_path, secondary_path) = resolve_nicknames_file(&dcs_saved_games_path);

    let mut existing_nicknames = Vec::new();
    if primary_path.exists() {
        if let Ok(content) = fs::read_to_string(&primary_path) {
            let entries = parse_nicknames_lua(&content);
            existing_nicknames = entries.into_iter().map(|(_, n)| n).collect();
        }
    }

    // Remove any existing occurrences of trimmed to avoid duplicates
    existing_nicknames.retain(|n| n != trimmed);

    // Prepend to slot 1
    existing_nicknames.insert(0, trimmed.to_string());

    let formatted_lua = serialize_nicknames_lua(&existing_nicknames);

    if let Some(parent) = primary_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {:?}: {}", parent, e))?;
    }
    fs::write(&primary_path, formatted_lua.as_bytes())
        .map_err(|e| format!("Failed to write to {:?}: {}", primary_path, e))?;

    if let Some(sec) = secondary_path {
        if let Some(parent) = sec.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(&sec, formatted_lua.as_bytes());
    }

    Ok(DcsNicknameInfo {
        current_nickname: Some(trimmed.to_string()),
        nicknames: existing_nicknames,
        file_path: primary_path.to_string_lossy().to_string(),
        file_exists: true,
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct WindowPreferences {
    pub start_minimized: bool,
    pub minimize_to_tray: bool,
    pub close_to_tray: bool,
}

impl Default for WindowPreferences {
    fn default() -> Self {
        Self {
            start_minimized: false,
            minimize_to_tray: true,
            close_to_tray: true,
        }
    }
}

fn get_window_prefs_file() -> PathBuf {
    get_portable_data_dir().join("window_preferences.json")
}

fn load_window_preferences() -> WindowPreferences {
    let p = get_window_prefs_file();
    if let Ok(data) = fs::read_to_string(p) {
        if let Ok(prefs) = serde_json::from_str::<WindowPreferences>(&data) {
            return prefs;
        }
    }
    WindowPreferences::default()
}

fn save_window_preferences_file(prefs: &WindowPreferences) -> Result<(), String> {
    let p = get_window_prefs_file();
    let data = serde_json::to_string_pretty(prefs).map_err(|e| e.to_string())?;
    fs::write(p, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_window_preferences() -> Result<WindowPreferences, String> {
    Ok(load_window_preferences())
}

#[tauri::command]
fn set_window_preferences(preferences: WindowPreferences) -> Result<(), String> {
    save_window_preferences_file(&preferences)
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn hide_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    Ok(())
}

#[tauri::command]
fn minimize_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let prefs = load_window_preferences();
        if prefs.minimize_to_tray {
            let _ = window.hide();
        } else {
            let _ = window.minimize();
        }
    }
    Ok(())
}

fn create_badged_tray_icon(base: &tauri::image::Image) -> tauri::image::Image<'static> {
    let mut rgba = base.rgba().to_vec();
    let width = base.width();
    let height = base.height();

    // Scale badge radius and position to icon dimensions
    let r = (width as f32 * 0.22).round() as i32;
    let cx = width as i32 - r - 1;
    let cy = r + 1;

    for y in (cy - r - 2)..=(cy + r + 2) {
        for x in (cx - r - 2)..=(cx + r + 2) {
            if x >= 0 && x < width as i32 && y >= 0 && y < height as i32 {
                let dist_sq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
                let idx = ((y as usize * width as usize) + x as usize) * 4;
                if dist_sq <= r * r {
                    // Vibrant Amber notification badge: #F59E0B (245, 158, 11)
                    rgba[idx] = 245;
                    rgba[idx + 1] = 158;
                    rgba[idx + 2] = 11;
                    rgba[idx + 3] = 255;
                } else if dist_sq <= (r + 2) * (r + 2) {
                    // Contrast border: #0C0A09 (12, 10, 9)
                    rgba[idx] = 12;
                    rgba[idx + 1] = 10;
                    rgba[idx + 2] = 9;
                    rgba[idx + 3] = 255;
                }
            }
        }
    }

    tauri::image::Image::new_owned(rgba, width, height)
}

#[tauri::command]
fn update_tray_notification_badge(app: AppHandle, unread_count: u32) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        if unread_count > 0 {
            // Set informative tooltip
            let tooltip_text = format!(
                "GTFO Companion App ({} unread notification{})",
                unread_count,
                if unread_count > 1 { "s" } else { "" }
            );
            let _ = tray.set_tooltip(Some(tooltip_text));

            // Set badged tray icon
            if let Some(default_icon) = app.default_window_icon() {
                let badged = create_badged_tray_icon(default_icon);
                let _ = tray.set_icon(Some(badged));
            }

            // Rebuild context menu with prominent notification item at top
            let notif_label = format!(
                "🔔 {} New Notification{}",
                unread_count,
                if unread_count > 1 { "s" } else { "" }
            );
            let notif_i = MenuItem::with_id(&app, "open_notifications", &notif_label, true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let show_i = MenuItem::with_id(&app, "show", "Show GTFO Companion App", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let updates_i = MenuItem::with_id(&app, "check_updates", "Check for Updates...", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let quit_i = MenuItem::with_id(&app, "quit", "Quit", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let menu = Menu::with_items(&app, &[&notif_i, &show_i, &updates_i, &quit_i])
                .map_err(|e| e.to_string())?;
            let _ = tray.set_menu(Some(menu));
        } else {
            // Reset tooltip
            let _ = tray.set_tooltip(Some("GTFO Companion App"));

            // Reset icon
            if let Some(default_icon) = app.default_window_icon() {
                let _ = tray.set_icon(Some(default_icon.clone()));
            }

            // Standard menu
            let show_i = MenuItem::with_id(&app, "show", "Show GTFO Companion App", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let updates_i = MenuItem::with_id(&app, "check_updates", "Check for Updates...", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let quit_i = MenuItem::with_id(&app, "quit", "Quit", true, None::<&str>)
                .map_err(|e| e.to_string())?;
            let menu = Menu::with_items(&app, &[&show_i, &updates_i, &quit_i])
                .map_err(|e| e.to_string())?;
            let _ = tray.set_menu(Some(menu));
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let show_i = MenuItem::with_id(app, "show", "Show GTFO Companion App", true, None::<&str>)?;
            let updates_i = MenuItem::with_id(app, "check_updates", "Check for Updates...", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &updates_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .tooltip("GTFO Companion App")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "open_notifications" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                                let _ = window.emit("open-notifications", ());
                            }
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "check_updates" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                                let _ = window.emit("trigger-check-updates", ());
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder.build(app)?;

            let prefs = load_window_preferences();
            if let Some(window) = app.get_webview_window("main") {
                if prefs.start_minimized {
                    if prefs.minimize_to_tray {
                        let _ = window.hide();
                    } else {
                        let _ = window.minimize();
                    }
                }

                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            let current_prefs = load_window_preferences();
                            if current_prefs.close_to_tray {
                                api.prevent_close();
                                let _ = window_clone.hide();
                            }
                        }
                        tauri::WindowEvent::Resized(_) => {
                            let current_prefs = load_window_preferences();
                            if current_prefs.minimize_to_tray && window_clone.is_minimized().unwrap_or(false) {
                                let _ = window_clone.hide();
                            }
                        }
                        tauri::WindowEvent::Focused(focused) => {
                            if !focused {
                                let current_prefs = load_window_preferences();
                                if current_prefs.minimize_to_tray && window_clone.is_minimized().unwrap_or(false) {
                                    let _ = window_clone.hide();
                                }
                            }
                        }
                        _ => {}
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_dcs_paths,
            fetch_remote_manifest,
            fetch_remote_member_profile,
            get_installed_assets,
            scan_existing_installations,
            install_asset,
            uninstall_asset,
            verify_asset_integrity,
            start_discord_oauth,
            verify_discord_token,
            install_dtc_file,
            inspect_route_tool_presets,
            merge_route_tool_preset,
            install_atc_kneeboard,
            open_external_url,
            get_dcs_nickname,
            update_dcs_nickname,
            get_window_preferences,
            set_window_preferences,
            show_main_window,
            hide_main_window,
            minimize_main_window,
            update_tray_notification_badge
        ])
        .run(tauri::generate_context!())
        .expect("error while running GTFO Companion App");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_nicknames_lua() {
        let sample = r#"
nicknames = 
{
	[1] = "GTFO | Schilly",
	[2] = "GTFO | Test",
	[3] = "Logan 2 | GTFO | Schilly",
} -- end of nicknames
"#;
        let entries = parse_nicknames_lua(sample);
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0], (1, "GTFO | Schilly".to_string()));
        assert_eq!(entries[1], (2, "GTFO | Test".to_string()));
        assert_eq!(entries[2], (3, "Logan 2 | GTFO | Schilly".to_string()));
    }

    #[test]
    fn test_serialize_nicknames_lua() {
        let names = vec![
            "GTFO | Schilly".to_string(),
            "GTFO | Test".to_string(),
            "Logan 2 | GTFO | Schilly".to_string(),
        ];
        let out = serialize_nicknames_lua(&names);
        assert!(out.starts_with("nicknames = \r\n{\r\n"));
        assert!(out.contains("\t[1] = \"GTFO | Schilly\",\r\n"));
        assert!(out.contains("\t[2] = \"GTFO | Test\",\r\n"));
        assert!(out.contains("\t[3] = \"Logan 2 | GTFO | Schilly\",\r\n"));
        assert!(out.ends_with("} -- end of nicknames\r\n"));
    }

    #[test]
    fn test_prepend_and_deduplicate_nickname() {
        let mut list = vec![
            "GTFO | Test".to_string(),
            "GTFO | Schilly".to_string(),
            "Wank | Schilly".to_string(),
        ];
        let new_nick = "GTFO | Schilly";
        list.retain(|n| n != new_nick);
        list.insert(0, new_nick.to_string());

        assert_eq!(list[0], "GTFO | Schilly");
        assert_eq!(list[1], "GTFO | Test");
        assert_eq!(list[2], "Wank | Schilly");
        assert_eq!(list.len(), 3);
    }
}
