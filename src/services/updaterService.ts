import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { isTauriRuntime } from './tauriBridge';
import { STATIC_CONFIG } from '../config/constants';

export interface AppUpdateInfo {
  available: boolean;
  version?: string;
  currentVersion?: string;
  body?: string;
  date?: string;
  rawUpdate?: Update | null;
}

export type UpdateDownloadProgressCallback = (
  percent: number,
  downloadedBytes: number,
  totalBytes: number
) => void;

/**
 * Checks GitHub Releases endpoint for an available application update.
 */
export async function checkForAppUpdate(): Promise<AppUpdateInfo> {
  let runtimeVersion: string = STATIC_CONFIG.appVersion;
  if (isTauriRuntime()) {
    try {
      runtimeVersion = await getVersion();
    } catch {
      // Fallback to STATIC_CONFIG
    }
  }

  if (!isTauriRuntime()) {
    return {
      available: false,
      currentVersion: runtimeVersion,
    };
  }

  try {
    const update = await check();
    if (!update) {
      return {
        available: false,
        currentVersion: runtimeVersion,
      };
    }

    return {
      available: true,
      version: update.version,
      currentVersion: update.currentVersion || runtimeVersion,
      body: update.body || undefined,
      date: update.date || undefined,
      rawUpdate: update,
    };
  } catch (err) {
    console.warn('Tauri update check notice:', err);
    return {
      available: false,
    };
  }
}

/**
 * Downloads and applies the update with progress tracking.
 */
export async function downloadAndInstallUpdate(
  update: Update,
  onProgress?: UpdateDownloadProgressCallback
): Promise<void> {
  let downloaded = 0;
  let totalLength = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        totalLength = event.data.contentLength || 0;
        if (onProgress) onProgress(0, 0, totalLength);
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        const percent = totalLength > 0 ? Math.min(100, Math.round((downloaded / totalLength) * 100)) : 0;
        if (onProgress) onProgress(percent, downloaded, totalLength);
        break;
      case 'Finished':
        if (onProgress) onProgress(100, totalLength, totalLength);
        break;
    }
  });
}

/**
 * Relaunches the updated application.
 */
export async function relaunchApp(): Promise<void> {
  if (isTauriRuntime()) {
    await relaunch();
  } else {
    window.location.reload();
  }
}
