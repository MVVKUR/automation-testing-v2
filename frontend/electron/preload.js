const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Get app info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Get backend URL
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),

  // Open external URL
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Platform info
  platform: process.platform,
  arch: process.arch,

  // Check if running in Electron
  isElectron: true,
});
