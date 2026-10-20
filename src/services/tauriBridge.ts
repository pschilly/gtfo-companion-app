import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { STATIC_CONFIG } from '../config/constants';
import { SAMPLE_MANIFEST } from '../data/sampleManifest';
import {
  buildFallbackMemberProfile,
  formatRoutePresetToLuaSnippet,
  generateKneeboardSvgCard,
  normalizeMemberPortalProfile,
} from '../data/samplePortalData';
import {
  AssetCategory,
  AssetItem,
  AssetManifest,
  AtcFlightPlanPackage,
  AtcKneeboardItem,
  DcsDtcData,
  DcsEnvironmentInfo,
  DiscordUserSession,
  DownloadProgressEvent,
  InstalledAssetRecord,
  IntegrityCheckResult,
  MemberPortalProfile,
  RequiredTier,
  RequirementLevel,
  RouteToolPresetData,
  UserTier,
} from '../types';

export interface RoutePresetManifestInfo {
  filePath: string;
  exists: boolean;
  presetNames: string[];
  rawContent: string;
}

export interface RoutePresetMergeResult {
  filePath: string;
  action: 'created' | 'appended' | 'updated' | string;
  presetNames: string[];
  rawContent: string;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function detectDcsPaths(customOverride?: string): Promise<DcsEnvironmentInfo> {
  if (isTauriRuntime()) {
    return await invoke<DcsEnvironmentInfo>('detect_dcs_paths', {
      customOverride: customOverride || null,
    });
  }

  const defaultRoot = 'C:\\Users\\Pilot\\Saved Games';
  const dcsPath = `${defaultRoot}\\DCS`;
  const openbetaPath = `${defaultRoot}\\DCS.openbeta`;

  return {
    savedGamesRoot: defaultRoot,
    activeSavedGamesPath: customOverride || dcsPath,
    detectedCandidates: [
      {
        label: 'DCS (Saved Games)',
        path: dcsPath,
        exists: true,
        variant: 'release',
      },
      {
        label: 'DCS.openbeta (Legacy)',
        path: openbetaPath,
        exists: false,
        variant: 'openbeta',
      },
    ],
  };
}

function normalizeRemoteManifest(raw: Record<string, unknown>): AssetManifest {
  const rawList = Array.isArray(raw.assets)
    ? raw.assets
    : Array.isArray(raw.packages)
    ? raw.packages
    : [];

  const assets: AssetItem[] = rawList.map((item: Record<string, unknown>) => {
    const rawGallery = Array.isArray(item.previewGallery)
      ? item.previewGallery
      : Array.isArray(item.galleryUrls)
      ? item.galleryUrls
      : [];

    const previewGallery = rawGallery
      .map((g: unknown, idx: number) => {
        if (typeof g === 'string') {
          return { label: `Preview ${idx + 1}`, url: g };
        }
        if (g && typeof g === 'object') {
          const obj = g as Record<string, unknown>;
          return {
            label: String(obj.label || `Preview ${idx + 1}`),
            url: String(obj.url || ''),
          };
        }
        return null;
      })
      .filter((g): g is { label: string; url: string } => Boolean(g && g.url));

    const rawCategory = String(item.category || 'mod').toLowerCase();
    const category: AssetCategory =
      rawCategory === 'livery' ? 'livery' : rawCategory === 'tool' ? 'tool' : 'mod';

    const isExternal = Boolean(
      item.isExternal ||
        item.is_external ||
        item.sourceType === 'external' ||
        item.source_type === 'external' ||
        rawCategory === 'tool'
    );

    const externalUrl =
      item.externalUrl || item.external_url
        ? String(item.externalUrl || item.external_url)
        : undefined;

    const detectionPath =
      item.detectionPath || item.detection_path
        ? String(item.detectionPath || item.detection_path)
        : undefined;

    const rawTier = String(item.requiredTier || item.required_tier || 'community').toLowerCase();
    const requiredTier: RequiredTier = rawTier === 'core' ? 'core' : 'community';

    const rawReqLevel = String(
      item.requirementLevel || item.requirement_level || 'optional'
    ).toLowerCase();
    const requirementLevel: RequirementLevel =
      rawReqLevel === 'required_all' || rawReqLevel === 'required_core'
        ? (rawReqLevel as RequirementLevel)
        : 'optional';

    const rawTargetFolder = String(item.targetFolder || item.target_folder || '').replace(
      /[\\/]+$/,
      ''
    );

    const rawPrefixes = Array.isArray(item.githubPathPrefixes)
      ? item.githubPathPrefixes
      : Array.isArray(item.github_path_prefixes)
      ? item.github_path_prefixes
      : undefined;

    const rawAirframe =
      item.aircraftOrModule ?? item.aircraft ?? item.airframe ?? '';
    const airframeStr =
      typeof rawAirframe === 'string' ? rawAirframe.trim() : '';
    const isAgnostic =
      !airframeStr ||
      airframeStr.toLowerCase() === 'airframe agnostic' ||
      airframeStr.toLowerCase() === 'agnostic';
    const aircraftOrModule = isAgnostic ? '' : airframeStr;

    return {
      id: String(item.id || item.slug || ''),
      name: String(item.name || 'Unnamed Package'),
      description: String(item.description || item.shortDescription || ''),
      category,
      aircraftOrModule,
      version: String(item.version || '1.0.0'),
      author: String(item.author || 'GTFO Logistics'),
      imagePreviewUrl: String(
        item.imagePreviewUrl ||
          item.thumbnailUrl ||
          item.thumbnail_url ||
          STATIC_CONFIG.logoUrl
      ),
      previewGallery: previewGallery.length > 0 ? previewGallery : undefined,
      targetFolder: rawTargetFolder,
      installFolderName: String(item.installFolderName || item.install_folder_name || ''),
      githubRepo:
        item.githubRepo || item.github_repo
          ? String(item.githubRepo || item.github_repo)
          : undefined,
      githubBranch:
        item.githubBranch || item.github_branch
          ? String(item.githubBranch || item.github_branch)
          : undefined,
      githubPathPrefixes: rawPrefixes ? rawPrefixes.map((p: unknown) => String(p)) : undefined,
      fileCount:
        typeof item.fileCount === 'number'
          ? item.fileCount
          : typeof item.file_count === 'number'
          ? item.file_count
          : undefined,
      requiredTier,
      requirementLevel,
      downloadUrl: String(item.downloadUrl || item.download_url || ''),
      archiveSubfolder:
        item.archiveSubfolder ||
        item.archive_subfolder ||
        item.archivePathPrefix ||
        item.archive_path_prefix ||
        item.zipSubfolder ||
        item.zip_subfolder
          ? String(
              item.archiveSubfolder ||
                item.archive_subfolder ||
                item.archivePathPrefix ||
                item.archive_path_prefix ||
                item.zipSubfolder ||
                item.zip_subfolder
            )
          : undefined,
      sha256: String(item.sha256 || ''),
      fileSizeBytes: Number(item.fileSizeBytes ?? item.file_size_bytes ?? 0),
      updatedAt: String(
        item.updatedAt || item.releasedAt || item.released_at || new Date().toISOString()
      ),
      changelog: Array.isArray(item.changelog)
        ? item.changelog.map((c: unknown) => String(c))
        : undefined,
      tags: Array.isArray(item.tags) ? item.tags.map((t: unknown) => String(t)) : undefined,
      featured: Boolean(item.featured),
      isExternal,
      externalUrl,
      detectionPath,
    };
  });

  const rawAnn = raw.announcement as Record<string, unknown> | null | undefined;
  const announcement =
    rawAnn && rawAnn.title && rawAnn.message
      ? {
          title: String(rawAnn.title),
          message: String(rawAnn.message),
          type: (rawAnn.type === 'warning' || rawAnn.type === 'tactical'
            ? rawAnn.type
            : 'info') as 'info' | 'warning' | 'tactical',
        }
      : undefined;

  return {
    schemaVersion: Number(raw.schemaVersion || 1),
    communityName: String(raw.communityName || 'Global Task Force Overlord'),
    manifestVersion: String(raw.manifestVersion || '1.0.0'),
    generatedAt: String(raw.generatedAt || new Date().toISOString()),
    announcement,
    assets,
  };
}

/**
 * Fetches the live asset manifest from https://members.globaltaskforceoverlord.org/api/v1/companion/manifest
 */
export async function fetchStaticManifest(
  portalApiBaseUrl?: string,
  accessToken?: string | null
): Promise<AssetManifest> {
  const cleanPortalBase = (portalApiBaseUrl || STATIC_CONFIG.portalBaseUrl).replace(/\/+$/, '');
  const candidateUrls = Array.from(
    new Set([`${cleanPortalBase}/manifest`, STATIC_CONFIG.manifestUrl])
  );

  for (const url of candidateUrls) {
    if (isTauriRuntime()) {
      try {
        const rawManifest = await invoke<Record<string, unknown>>('fetch_remote_manifest', {
          manifestUrl: url,
          accessToken: accessToken || null,
        });
        if (rawManifest && (Array.isArray(rawManifest.assets) || Array.isArray(rawManifest.packages))) {
          return normalizeRemoteManifest(rawManifest);
        }
      } catch {
        // Fallback to HTTP fetch below if invoke fails
      }
    }

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      const resp = await fetch(url, { cache: 'no-store', headers });
      if (resp.ok) {
        const rawManifest = (await resp.json()) as Record<string, unknown>;
        if (rawManifest && (Array.isArray(rawManifest.assets) || Array.isArray(rawManifest.packages))) {
          return normalizeRemoteManifest(rawManifest);
        }
      }
    } catch {
      // Try next candidate URL
    }
  }

  return JSON.parse(JSON.stringify(SAMPLE_MANIFEST));
}

/**
 * Fetches Member Dossier from the GTFO Member Portal API:
 * GET https://members.globaltaskforceoverlord.org/api/v1/companion/member/{discordId}
 */
export async function fetchMemberPortalProfile(
  session: DiscordUserSession | null,
  effectiveTier: UserTier,
  portalApiBaseUrl: string
): Promise<{ profile: MemberPortalProfile; fromLiveApi: boolean }> {
  const discordId = session?.id;
  if (!discordId) {
    return {
      profile: buildFallbackMemberProfile(session, effectiveTier),
      fromLiveApi: false,
    };
  }

  const cleanBase = (portalApiBaseUrl || STATIC_CONFIG.portalBaseUrl).replace(/\/+$/, '');
  const endpoint = `${cleanBase}/member/${encodeURIComponent(discordId)}`;

  if (isTauriRuntime()) {
    try {
      const rawData = await invoke<Record<string, unknown>>('fetch_remote_member_profile', {
        endpointUrl: endpoint,
        accessToken: session?.accessToken || null,
      });
      if (rawData && (rawData.discordId || rawData.discord_id || rawData.callsign || rawData.grade)) {
        return {
          profile: normalizeMemberPortalProfile(rawData, session, effectiveTier),
          fromLiveApi: true,
        };
      }
    } catch {
      // Fallback to browser fetch below if invoke fails
    }
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (session?.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    }

    const resp = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(6000),
    });

    if (resp.ok) {
      const rawData = (await resp.json()) as Record<string, unknown>;
      if (rawData && (rawData.discordId || rawData.discord_id || rawData.callsign || rawData.grade)) {
        return {
          profile: normalizeMemberPortalProfile(rawData, session, effectiveTier),
          fromLiveApi: true,
        };
      }
    }
  } catch {
    // Endpoint temporarily unreachable
  }

  return {
    profile: buildFallbackMemberProfile(session, effectiveTier),
    fromLiveApi: false,
  };
}


/**
 * Installs a DTC file (.dtc native or .json DCS-DTC) into Saved Games\DCS\<targetSubfolder>\<fileName>
 */
export async function installAtcDtcFileCommand(
  dcsSavedGamesPath: string,
  dtc: DcsDtcData
): Promise<string> {
  const serializedContent = JSON.stringify(dtc.rawPayload, null, 2);
  if (isTauriRuntime()) {
    return await invoke<string>('install_dtc_file', {
      dcsSavedGamesPath,
      targetSubFolder: dtc.targetSubfolder,
      fileName: dtc.fileName,
      content: serializedContent,
    });
  }

  // Browser preview fallback
  return `${dcsSavedGamesPath}\\${dtc.targetSubfolder.replace(/\//g, '\\')}\\${dtc.fileName}`;
}

/**
 * Helper for browser preview mode to simulate DCS RouteToolPresets Lua merging
 */
function simulateBrowserLuaMerge(
  existingLua: string | null,
  presetName: string,
  luaSnippet: string
): { content: string; action: 'created' | 'appended' | 'updated'; presetNames: string[] } {
  const indented = luaSnippet
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');

  let content = '';
  let action: 'created' | 'appended' | 'updated' = 'created';

  if (!existingLua || !existingLua.includes('presets')) {
    content = `presets = \n{\n${indented}\n} -- end of presets\n`;
    action = 'created';
  } else if (existingLua.includes(`["${presetName}"]`)) {
    const keyMarker = `["${presetName}"]`;
    const lines = existingLua.split('\n');
    let depth = 0;
    let startIdx = -1;
    let endIdx = -1;
    let seenBrace = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (startIdx === -1 && depth === 1 && trimmed.startsWith(keyMarker)) {
        startIdx = i;
      }
      for (const ch of trimmed) {
        if (ch === '{') {
          depth++;
          if (startIdx !== -1 && depth >= 2) seenBrace = true;
        } else if (ch === '}') {
          depth = Math.max(0, depth - 1);
          if (startIdx !== -1 && seenBrace && depth === 1) {
            endIdx = i;
            break;
          }
        }
      }
      if (endIdx !== -1) break;
    }

    if (startIdx !== -1 && endIdx !== -1) {
      content = [
        ...lines.slice(0, startIdx),
        indented,
        ...lines.slice(endIdx + 1),
      ].join('\n');
      action = 'updated';
    } else {
      content = `presets = \n{\n${indented}\n} -- end of presets\n`;
      action = 'updated';
    }
  } else {
    const lines = existingLua.trimEnd().split('\n');
    let lastBraceIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('}')) {
        lastBraceIdx = i;
        break;
      }
    }
    if (lastBraceIdx !== -1) {
      content =
        [
          ...lines.slice(0, lastBraceIdx),
          indented,
          ...lines.slice(lastBraceIdx),
        ].join('\n') + '\n';
      action = 'appended';
    } else {
      content = `presets = \n{\n${indented}\n} -- end of presets\n`;
      action = 'created';
    }
  }

  const presetNames: string[] = [];
  let depth = 0;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (depth === 1 && trimmed.startsWith('["')) {
      const endQuote = trimmed.indexOf('"]', 2);
      if (endQuote !== -1) {
        const name = trimmed.slice(2, endQuote);
        if (!presetNames.includes(name)) {
          presetNames.push(name);
        }
      }
    }
    for (const ch of trimmed) {
      if (ch === '{') depth++;
      else if (ch === '}') depth = Math.max(0, depth - 1);
    }
  }

  return { content, action, presetNames };
}

/**
 * Inspects a DCS theatre RouteToolPresets Lua manifest (`Saved Games\DCS\Config\RouteToolPresets\<theatre>.lua`)
 */
export async function inspectAtcRouteToolPresetsCommand(
  dcsSavedGamesPath: string,
  theatreFileName: string
): Promise<RoutePresetManifestInfo> {
  if (isTauriRuntime()) {
    return await invoke<RoutePresetManifestInfo>('inspect_route_tool_presets', {
      dcsSavedGamesPath,
      theatreFileName,
    });
  }

  const storageKey = `gtfo_sim_routetool_${theatreFileName}`;
  const existing = localStorage.getItem(storageKey);
  const filePath = `${dcsSavedGamesPath}\\Config\\RouteToolPresets\\${theatreFileName}`;

  if (!existing) {
    return {
      filePath,
      exists: false,
      presetNames: [],
      rawContent: '',
    };
  }

  const presetNames: string[] = [];
  let depth = 0;
  for (const line of existing.split('\n')) {
    const trimmed = line.trim();
    if (depth === 1 && trimmed.startsWith('["')) {
      const endQuote = trimmed.indexOf('"]', 2);
      if (endQuote !== -1) {
        const name = trimmed.slice(2, endQuote);
        if (!presetNames.includes(name)) presetNames.push(name);
      }
    }
    for (const ch of trimmed) {
      if (ch === '{') depth++;
      else if (ch === '}') depth = Math.max(0, depth - 1);
    }
  }

  return {
    filePath,
    exists: true,
    presetNames,
    rawContent: existing,
  };
}

/**
 * Appends or updates a route preset inside `Saved Games\DCS\Config\RouteToolPresets\<theatre>.lua`
 * preserving all other user route presets in that theatre manifest.
 */
export async function mergeAtcRouteToolPresetCommand(
  dcsSavedGamesPath: string,
  preset: RouteToolPresetData
): Promise<RoutePresetMergeResult> {
  const theatreFileName = `${preset.theatre}.lua`;
  const luaSnippet = formatRoutePresetToLuaSnippet(preset);

  if (isTauriRuntime()) {
    return await invoke<RoutePresetMergeResult>('merge_route_tool_preset', {
      dcsSavedGamesPath,
      theatreFileName,
      presetName: preset.presetName,
      luaSnippet,
    });
  }

  const storageKey = `gtfo_sim_routetool_${theatreFileName}`;
  const existing = localStorage.getItem(storageKey);
  const merged = simulateBrowserLuaMerge(existing, preset.presetName, luaSnippet);
  localStorage.setItem(storageKey, merged.content);

  return {
    filePath: `${dcsSavedGamesPath}\\Config\\RouteToolPresets\\${theatreFileName}`,
    action: merged.action,
    presetNames: merged.presetNames,
    rawContent: merged.content,
  };
}

/**
 * Installs a Kneeboard card into `Saved Games\DCS\Kneeboard\<Aircraft>\<fileName>`
 */
export async function installAtcKneeboardCommand(
  dcsSavedGamesPath: string,
  pkg: AtcFlightPlanPackage,
  kneeboard: AtcKneeboardItem
): Promise<string> {
  const targetFolder =
    kneeboard.aircraftFolder === 'ALL'
      ? 'Kneeboard'
      : `Kneeboard\\${kneeboard.aircraftFolder}`;
  const svgContent = generateKneeboardSvgCard(pkg, kneeboard);

  if (isTauriRuntime()) {
    return await invoke<string>('install_atc_kneeboard', {
      dcsSavedGamesPath,
      targetFolder,
      fileName: kneeboard.fileName,
      svgContent,
    });
  }

  return `${dcsSavedGamesPath}\\${targetFolder}\\${kneeboard.fileName}`;
}

export async function loadInstalledAssets(): Promise<InstalledAssetRecord[]> {
  if (isTauriRuntime()) {
    try {
      return await invoke<InstalledAssetRecord[]>('get_installed_assets');
    } catch {
      return [];
    }
  }
  const raw = localStorage.getItem('gtfo_installed_assets_v1');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as InstalledAssetRecord[];
  } catch {
    return [];
  }
}

export async function scanExistingInstallations(
  dcsSavedGamesPath: string,
  assets: AssetItem[]
): Promise<InstalledAssetRecord[]> {
  if (isTauriRuntime()) {
    try {
      return await invoke<InstalledAssetRecord[]>('scan_existing_installations', {
        dcsSavedGamesPath,
        assets,
      });
    } catch {
      return [];
    }
  }
  return loadInstalledAssets();
}

export async function installAssetCommand(
  asset: AssetItem,
  dcsSavedGamesPath: string,
  verifyHash: boolean,
  onProgress?: (progress: DownloadProgressEvent) => void
): Promise<InstalledAssetRecord> {
  if (!isTauriRuntime()) {
    throw new Error(
      'File deployment into Saved Games\\DCS requires running the native desktop application.'
    );
  }

  let unlisten: UnlistenFn | null = null;
  try {
    if (onProgress) {
      unlisten = await listen<DownloadProgressEvent>('asset-download-progress', (event) => {
        if (event.payload.assetId === asset.id) {
          onProgress(event.payload);
        }
      });
    }
    return await invoke<InstalledAssetRecord>('install_asset', {
      asset,
      dcsSavedGamesPath,
      verifyHash,
    });
  } finally {
    if (unlisten) {
      unlisten();
    }
  }
}

export async function uninstallAssetCommand(
  record: InstalledAssetRecord,
  dcsSavedGamesPath: string
): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error('Uninstalling local files requires running the native desktop application.');
  }
  await invoke('uninstall_asset', {
    assetId: record.assetId,
    installedPath: record.installedPath,
    dcsSavedGamesPath,
  });
}

export async function verifyAssetIntegrityCommand(
  record: InstalledAssetRecord,
  asset?: AssetItem | null,
  dcsSavedGamesPath?: string
): Promise<IntegrityCheckResult> {
  if (!isTauriRuntime()) {
    return {
      valid: true,
      missingFiles: [],
      modifiedFiles: [],
      checkedCount: record.extractedFiles.length,
    };
  }
  return await invoke<IntegrityCheckResult>('verify_asset_integrity', {
    installedPath: record.installedPath,
    extractedFiles: record.extractedFiles,
    asset: asset || null,
    dcsSavedGamesPath: dcsSavedGamesPath || null,
  });
}

export async function startDiscordOAuthCommand(): Promise<DiscordUserSession> {
  if (isTauriRuntime()) {
    return await invoke<DiscordUserSession>('start_discord_oauth', {
      clientId: STATIC_CONFIG.discordClientId,
      guildId: STATIC_CONFIG.discordGuildId,
      coreRoleId: STATIC_CONFIG.coreRoleId,
      communityRoleId: STATIC_CONFIG.communityRoleId,
      redirectPort: STATIC_CONFIG.oauthRedirectPort,
    });
  }

  // Browser OAuth2 redirect flow when testing via Vite dev server (http://localhost:1420)
  const redirectUri = window.location.origin;
  const authUrl = `https://discord.com/oauth2/authorize?client_id=${
    STATIC_CONFIG.discordClientId
  }&response_type=token&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent('identify guilds guilds.members.read')}`;
  window.location.href = authUrl;
  return new Promise(() => {
    // Page navigates to Discord OAuth2
  });
}

export async function verifyDiscordAccessToken(accessToken: string): Promise<DiscordUserSession> {
  if (isTauriRuntime()) {
    return await invoke<DiscordUserSession>('verify_discord_token', {
      accessToken,
      guildId: STATIC_CONFIG.discordGuildId,
      coreRoleId: STATIC_CONFIG.coreRoleId,
      communityRoleId: STATIC_CONFIG.communityRoleId,
    });
  }

  const userResp = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userResp.ok) {
    throw new Error(`Discord authentication failed (HTTP ${userResp.status}).`);
  }
  const userData = await userResp.json();

  const memberResp = await fetch(
    `https://discord.com/api/v10/users/@me/guilds/${STATIC_CONFIG.discordGuildId}/member`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let isGuildMember = false;
  let roleIds: string[] = [];

  if (memberResp.ok) {
    isGuildMember = true;
    const memberData = await memberResp.json();
    roleIds = Array.isArray(memberData.roles) ? memberData.roles : [];
  }

  const hasCoreRole = roleIds.includes(STATIC_CONFIG.coreRoleId);
  const hasCommunityRole = roleIds.includes(STATIC_CONFIG.communityRoleId);

  const tier = hasCoreRole ? 'core' : hasCommunityRole ? 'community' : 'guest';

  const avatarUrl = userData.avatar
    ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=128`
    : null;

  return {
    id: userData.id,
    username: userData.username,
    globalName: userData.global_name || userData.username,
    discriminator: userData.discriminator || '0',
    avatarUrl,
    guildId: STATIC_CONFIG.discordGuildId,
    isGuildMember,
    roleIds,
    tier,
    accessToken,
    authenticatedAt: new Date().toISOString(),
  };
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (isTauriRuntime()) {
    await invoke('open_external_url', { url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

