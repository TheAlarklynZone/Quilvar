// Updater via electron-updater (handled in main process)
// Renderer communicates through electronAPI IPC

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  version: string | null;
  downloading: boolean;
  error: string | null;
}

export async function checkForUpdates(): Promise<{ available: boolean; version: string | null }> {
  try {
    const result = await window.electronAPI.checkForUpdates();
    return result;
  } catch (e: any) {
    console.error('Update check failed:', e);
    return { available: false, version: null };
  }
}

export async function downloadAndInstall(
  onProgress?: (downloaded: number, total: number | null) => void
): Promise<void> {
  try {
    window.electronAPI.onUpdateProgress((downloaded: number, total: number | null) => {
      if (onProgress) onProgress(downloaded, total);
    });
    await window.electronAPI.downloadAndInstall();
  } catch (e: any) {
    console.error('Update install failed:', e);
    throw e;
  }
}
