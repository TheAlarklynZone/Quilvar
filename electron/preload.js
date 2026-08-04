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
  getStoragePath: () => ipcRenderer.invoke('app:storage-path'),

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

  // Quivers
  getQuivers: () => ipcRenderer.invoke('quivers:get'),
  createQuiver: (name) => ipcRenderer.invoke('quivers:create', name),
  renameQuiver: (id, name) => ipcRenderer.invoke('quivers:rename', id, name),
  deleteQuiver: (id) => ipcRenderer.invoke('quivers:delete', id),
  addClipToQuiver: (quiverId, clipId) => ipcRenderer.invoke('quivers:add-clip', quiverId, clipId),
  removeClipFromQuiver: (quiverId, clipId) => ipcRenderer.invoke('quivers:remove-clip', quiverId, clipId),

  // Quilvault
  vaultStatus: () => ipcRenderer.invoke('vault:status'),
  vaultSetPin: (pin) => ipcRenderer.invoke('vault:set-pin', pin),
  vaultUnlock: (pin) => ipcRenderer.invoke('vault:unlock', pin),
  vaultLock: () => ipcRenderer.invoke('vault:lock'),
  getVaultClips: () => ipcRenderer.invoke('vault:get-clips'),
  addToVault: (clipId) => ipcRenderer.invoke('vault:add', clipId),
  removeFromVault: (id) => ipcRenderer.invoke('vault:remove', id),
  restoreFromVault: (id) => ipcRenderer.invoke('vault:restore', id),

  // Cleanup
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
