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
  return window.electronAPI.checkForUpdates();
}

export function downloadAndInstall(
  onProgress?: (downloaded: number, total: number | null) => void
): Promise<void> {
  // The 'updater:download' IPC call resolves as soon as the download
  // *starts*, not when it finishes — the real outcome arrives later via
  // these events from the main process, so that's what settles this promise.
  window.electronAPI.removeAllListeners('updater:progress');
  window.electronAPI.removeAllListeners('updater:downloaded');
  window.electronAPI.removeAllListeners('updater:error');

  return new Promise<void>((resolve, reject) => {
    window.electronAPI.onUpdateProgress((downloaded, total) => {
      onProgress?.(downloaded, total);
    });
    window.electronAPI.onUpdateDownloaded(() => {
      resolve();
    });
    window.electronAPI.onUpdateError((message) => {
      reject(new Error(message));
    });
    window.electronAPI.downloadAndInstall().catch(reject);
  });
}
