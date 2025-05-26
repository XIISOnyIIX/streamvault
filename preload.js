const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  fetchM3U: (url) => ipcRenderer.invoke('fetch-m3u', url),
  fetchXtreamCodes: (baseUrl, username, password, action, params) =>
    ipcRenderer.invoke('fetch-xtream', baseUrl, username, password, action, params),
  savePlaylists: (playlists) => ipcRenderer.invoke('save-playlists', playlists),
  loadPlaylists: () => ipcRenderer.invoke('load-playlists'),
  saveWatchHistory: (history) => ipcRenderer.invoke('save-watch-history', history), 
  loadWatchHistory: () => ipcRenderer.invoke('load-watch-history'),
  getCacheSize: () => ipcRenderer.invoke('get-cache-size'),
  clearAppCache: () => ipcRenderer.invoke('clear-app-cache'),
  saveProfiles: (profiles) => ipcRenderer.invoke('save-profiles', profiles), 
  loadProfiles: () => ipcRenderer.invoke('load-profiles'),

  // For Auto Update Notifications
  onUpdateReady: (callback) => {
    const channel = 'update-ready';
    ipcRenderer.on(channel, callback);
    // Return a cleanup function
    return () => ipcRenderer.removeListener(channel, callback);
  },
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates') // Added
});