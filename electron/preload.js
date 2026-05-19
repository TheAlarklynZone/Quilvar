const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Clips
  getClips: () => ipcRenderer.invoke('clips:get'),
  deleteClip: (id) => ipcRenderer.invoke('clips:delete', id),
  togglePin: (id) => ipcRenderer.invoke('clips:toggle-pin', id),
  copyClip: (content) => ipcRenderer.invoke('clips:copy', content),

  // App
  quit: () => ipcRenderer.invoke('app:quit'),
  getVersion: () => ipcRenderer.invoke('app:version'),

  // Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadAndInstall: () => ipcRenderer.invoke('updater:download'),
  onUpdateAvailable: (cb) => ipcRenderer.on('updater:available', (_, info) => cb(info)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('updater:not-available', () => cb()),
  onUpdateProgress: (cb) => ipcRenderer.on('updater:progress', (_, data) => cb(data.downloaded, data.total)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('updater:downloaded', () => cb()),
  onUpdateError: (cb) => ipcRenderer.on('updater:error', (_, msg) => cb(msg)),

  // Events from main → renderer
  onNewClip: (cb) => ipcRenderer.on('clip:new', (_, clip) => cb(clip)),
  onQuickDrawOpen: (cb) => ipcRenderer.on('quickdraw:open', () => cb()),

  // Cleanup
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
