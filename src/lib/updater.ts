import { invoke } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  version: string | null;
  downloading: boolean;
  error: string | null;
}

export async function checkForUpdates(): Promise<{ available: boolean; version: string | null }> {
  try {
    const update = await check();
    if (update?.available) {
      return { available: true, version: update.version };
    }
    return { available: false, version: null };
  } catch (e) {
    console.error('Update check failed:', e);
    return { available: false, version: null };
  }
}

export async function downloadAndInstall(
  onProgress?: (downloaded: number, total: number | null) => void
): Promise<void> {
  const update = await check();
  if (!update?.available) return;

  await update.downloadAndInstall((event) => {
    if (event.event === 'Progress' && onProgress) {
      onProgress(event.data.chunkLength, event.data.contentLength ?? null);
    }
  });

  await relaunch();
}
