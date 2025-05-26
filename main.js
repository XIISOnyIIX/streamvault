const { app, BrowserWindow, ipcMain, session } = require('electron'); // Added session
const path = require('path');
const fs = require('fs'); 
const axios = require('axios');
const { autoUpdater } = require('electron-updater'); // Added for auto-update

const USER_DATA_PATH = app.getPath('userData');
const PLAYLISTS_FILE_PATH = path.join(USER_DATA_PATH, 'streamvault_playlists.json');
const WATCH_HISTORY_FILE_PATH = path.join(USER_DATA_PATH, 'streamvault_watch_history.json'); 
const PROFILES_FILE_PATH = path.join(USER_DATA_PATH, 'streamvault_profiles.json'); // Added

// --- Playlist Persistence ---
async function handleSavePlaylists(event, playlists) {
  try {
    console.log('Main process: Saving playlists to', PLAYLISTS_FILE_PATH);
    fs.writeFileSync(PLAYLISTS_FILE_PATH, JSON.stringify(playlists, null, 2));
  } catch (error) {
    console.error('Main process: Failed to save playlists -', error);
    throw new Error('Failed to save playlists.');
  }
}

async function handleLoadPlaylists() {
  try {
    if (fs.existsSync(PLAYLISTS_FILE_PATH)) {
      console.log('Main process: Loading playlists from', PLAYLISTS_FILE_PATH);
      const playlistsJson = fs.readFileSync(PLAYLISTS_FILE_PATH, 'utf-8');
      return JSON.parse(playlistsJson);
    }
    console.log('Main process: Playlists file not found. Returning null.');
    return null;
  } catch (error) {
    console.error('Main process: Failed to load playlists -', error);
    return null; 
  }
}
// --- End of Playlist Persistence ---

// --- Watch History Persistence ---
async function handleSaveWatchHistory(event, history) {
  try {
    console.log('Main process: Saving watch history to', WATCH_HISTORY_FILE_PATH);
    fs.writeFileSync(WATCH_HISTORY_FILE_PATH, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Main process: Failed to save watch history -', error);
    throw new Error('Failed to save watch history.');
  }
}

async function handleLoadWatchHistory() {
  try {
    if (fs.existsSync(WATCH_HISTORY_FILE_PATH)) {
      console.log('Main process: Loading watch history from', WATCH_HISTORY_FILE_PATH);
      const historyJson = fs.readFileSync(WATCH_HISTORY_FILE_PATH, 'utf-8');
      return JSON.parse(historyJson);
    }
    console.log('Main process: Watch history file not found. Returning null.');
    return null;
  } catch (error) {
    console.error('Main process: Failed to load watch history -', error);
    return null;
  }
}
// --- End of Watch History Persistence ---

// --- Profile Persistence ---
async function handleSaveProfiles(event, profiles) {
  try {
    console.log('Main process: Saving profiles to', PROFILES_FILE_PATH);
    fs.writeFileSync(PROFILES_FILE_PATH, JSON.stringify(profiles, null, 2));
  } catch (error) {
    console.error('Main process: Failed to save profiles -', error);
    throw new Error('Failed to save profiles.');
  }
}

async function handleLoadProfiles() {
  try {
    if (fs.existsSync(PROFILES_FILE_PATH)) {
      console.log('Main process: Loading profiles from', PROFILES_FILE_PATH);
      const profilesJson = fs.readFileSync(PROFILES_FILE_PATH, 'utf-8');
      return JSON.parse(profilesJson);
    }
    console.log('Main process: Profiles file not found. Returning null.');
    return null;
  } catch (error) {
    console.error('Main process: Failed to load profiles -', error);
    return null; 
  }
}
// --- End of Profile Persistence ---

// --- Cache Management ---
async function handleGetCacheSize() {
  try {
    const cacheSize = await session.defaultSession.getCacheSize();
    console.log('Main process: Cache size requested, bytes:', cacheSize);
    return cacheSize;
  } catch (error) {
    console.error('Main process: Failed to get cache size -', error);
    throw new Error('Failed to get cache size.');
  }
}

async function handleClearAppCache() {
  try {
    await session.defaultSession.clearCache();
    console.log('Main process: Application cache cleared.');
  } catch (error) {
    console.error('Main process: Failed to clear cache -', error);
    throw new Error('Failed to clear cache.');
  }
}
// --- End of Cache Management ---


// --- Network request handlers for IPC ---
async function handleFetchM3U(event, url) {
  try {
    console.log(`Main process: Fetching M3U from ${url}`);
    const response = await axios.get(url, { 
      responseType: 'text',
      timeout: 15000 
    });
    return response.data;
  } catch (error) {
    console.error('Main process: Failed to fetch M3U -', error.isAxiosError ? error.message : error);
    throw new Error(error.isAxiosError ? error.message : (error.toString() || 'Failed to fetch M3U in main process'));
  }
}

async function handleFetchXtreamCodes(event, baseUrl, username, password, action, params) {
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  let apiUrl = `${cleanBaseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=${encodeURIComponent(action)}`;
  
  if (params) {
    Object.keys(params).forEach(key => {
      apiUrl += `&${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
    });
  }

  try {
    console.log(`Main process: Fetching Xtream Codes (${action}) with params ${JSON.stringify(params)} from ${apiUrl}`);
    const response = await axios.get(apiUrl, {
      timeout: 20000 
    });
    return response.data;
  } catch (error) {
    console.error(`Main process: Failed to fetch Xtream Codes (${action}) -`, error.isAxiosError ? error.message : error);
    throw new Error(error.isAxiosError ? error.message : (error.toString() || `Failed to fetch Xtream Codes ${action} in main process`));
  }
}
// --- End of network request handlers ---

// --- Auto Update ---
autoUpdater.on('update-available', () => {
  console.log('Main process: Update available.');
  if (mainWindow) {
    // Optionally, send a message to renderer if you want to notify about availability before download
    // mainWindow.webContents.send('update-status', 'Update available, downloading...');
  }
});

autoUpdater.on('update-downloaded', () => {
  console.log('Main process: Update downloaded.');
  if (mainWindow) {
    mainWindow.webContents.send('update-ready');
  }
});

autoUpdater.on('error', (err) => {
  console.error('Main process: Error in auto-updater. ' + err);
  if (mainWindow) {
    // Optionally, send error details to renderer
    // mainWindow.webContents.send('update-status', `Error in auto-updater: ${err.message}`);
  }
});

ipcMain.on('quit-and-install', () => {
  console.log("Main process: Quitting and installing update.");
  autoUpdater.quitAndInstall();
});

ipcMain.on('check-for-updates', () => {
  console.log("Main process: Renderer requested check for updates.");
  // For a real app, ensure autoUpdater.setFeedURL is configured before calling this.
  // This is typically done in your electron-builder.js or package.json build config.
  autoUpdater.checkForUpdatesAndNotify();
});
// --- End of Auto Update ---


let mainWindow; // Define mainWindow in a broader scope

function createWindow () {
  mainWindow = new BrowserWindow({ // Assign to the broader scope mainWindow
    width: 1280, 
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false, 
    }
  });

  // Apply CSP header modifications
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' https://cdn.tailwindcss.com https://esm.sh 'unsafe-eval' 'unsafe-inline'", // esm.sh needs unsafe-eval for some modules
      "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
      "img-src 'self' data: https: http: blob: https://picsum.photos https://fastly.picsum.photos https://sample-videos.com",
      "media-src 'self' https://sample-videos.com blob: http: https: data:",
      "connect-src 'self' https://tvifqpyuuvduskopkxjh.supabase.co", 
      "font-src 'self' data:", 
      "frame-src 'self'", 
      "object-src 'none'", 
      "worker-src 'self' blob:" 
    ];
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives.join('; ')]
      }
    });
  });
  
  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

  // Removed simulated update check after window is ready
  // Actual update check will be triggered by user or on app launch via checkForUpdatesAndNotify (if configured)

  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  // Register IPC handlers
  ipcMain.handle('fetch-m3u', handleFetchM3U);
  ipcMain.handle('fetch-xtream', handleFetchXtreamCodes);
  ipcMain.handle('save-playlists', handleSavePlaylists);
  ipcMain.handle('load-playlists', handleLoadPlaylists);
  ipcMain.handle('save-watch-history', handleSaveWatchHistory); 
  ipcMain.handle('load-watch-history', handleLoadWatchHistory); 
  ipcMain.handle('get-cache-size', handleGetCacheSize);
  ipcMain.handle('clear-app-cache', handleClearAppCache);
  ipcMain.handle('save-profiles', handleSaveProfiles); 
  ipcMain.handle('load-profiles', handleLoadProfiles); 

  createWindow();

  // Optionally, check for updates on app start, after window is created
  // mainWindow.webContents.on('did-finish-load', () => {
  //   autoUpdater.checkForUpdatesAndNotify();
  // });


  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});