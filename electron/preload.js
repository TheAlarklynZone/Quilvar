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

  // Events from main → renderer
  onNewClip: (cb) => ipcRenderer.on('clip:new', (_, clip) => cb(clip)),
  onQuickDrawOpen: (cb) => ipcRenderer.on('quickdraw:open', () => cb()),

  // Cleanup
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
