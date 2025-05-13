// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const url = require('url');
const isDev = process.env.NODE_ENV !== 'production';

let mainWindow;

function createWindow() {
  // Set Content-Security-Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' https://api.binance.com; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data:; " +
          "connect-src 'self' https://api.binance.com wss://stream.binance.com:9443;"
        ],
      },
    });
  });

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,            // More secure default
      contextIsolation: true,            // Enable context isolation for security
      enableRemoteModule: false,         // Disable remote module
      preload: path.join(__dirname, 'preload.js'), // Use a preload script instead
      webSecurity: true                  // Enable web security
    },
  });

  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : url.format({
        pathname: path.join(__dirname, '../build/index.html'),
        protocol: 'file:',
        slashes: true
      });

  // Prevent navigation to non-local URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (isDev && parsedUrl.origin !== 'http://localhost:3000') {
      event.preventDefault();
    }
  });
  
  // Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Only allow specific external URLs to open in the default browser
    if (url.startsWith('https://www.binance.com')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.loadURL(startUrl);

  if (isDev) {
    // Open DevTools in development mode
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle Squirrel startup events for Windows
if (require('electron-squirrel-startup')) app.quit();

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle IPC messages securely
ipcMain.on('start-trading-bot', (event, config) => {
  // Validate the config object before using it
  if (!config || typeof config !== 'object') {
    return event.reply('trading-error', 'Invalid configuration');
  }
  
  console.log('Starting trading bot with validated config');
  // Implement actual trading logic here
  
  // Reply to the renderer
  event.reply('trading-status', { status: 'started' });
});

ipcMain.on('stop-trading-bot', (event) => {
  console.log('Stopping trading bot');
  // Implement logic to stop the trading bot
  
  // Reply to the renderer
  event.reply('trading-status', { status: 'stopped' });
});