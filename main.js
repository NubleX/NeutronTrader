// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
// normalize electron-is-dev (works if module exports boolean or a { default: boolean } shape)
const _isDevModule = require('electron-is-dev');
const isDev = (typeof _isDevModule === 'boolean')
  ? _isDevModule
  : Boolean(_isDevModule && (_isDevModule.default ?? _isDevModule));
const url = require('url');
const BinanceAPI = require('./electron/binanceApi');
const schedule = require('node-schedule');
const { storageService } = require('./src/services/storageService');
const activeBots = new Map();
let mainWindow

async function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 800,
      // icon must point to an icon file, not preload.js
      icon: path.join(__dirname, "electron", "icon.ico"),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: !isDev
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false // Don't show until ready
    });

    const startUrl = isDev
      ? 'http://localhost:3000'
      : url.format({
        pathname: path.join(__dirname, '../build/index.html'),
        protocol: 'file:',
        slashes: true
      });

    console.log('Launching Electron (isDev=%s) loading URL: %s', isDev, startUrl);
    await mainWindow.loadURL(startUrl);
    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();

      // Focus window on creation
      if (isDev) {
        mainWindow.webContents.openDevTools();
      }
    });

    // Handle window closed
    mainWindow.on('closed', () => {
      mainWindow = null;
      // Stop all active trading bots
      stopAllTradingBots();
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Enhanced error handling for renderer crashes
    mainWindow.webContents.on('crashed', (event, killed) => {
      console.error('Renderer process crashed:', { killed });

      const response = dialog.showMessageBoxSync(mainWindow, {
        type: 'error',
        title: 'Application Crashed',
        message: 'The application has crashed. Would you like to restart?',
        buttons: ['Restart', 'Close'],
        defaultId: 0
      });

      if (response === 0) {
        app.relaunch();
        app.exit();
      } else {
        app.quit();
      }
    });

    // Handle unresponsive renderer
    mainWindow.webContents.on('unresponsive', () => {
      console.warn('Renderer process became unresponsive');

      const response = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        title: 'Application Not Responding',
        message: 'The application is not responding. Would you like to restart?',
        buttons: ['Wait', 'Restart'],
        defaultId: 0
      });

      if (response === 1) {
        app.relaunch();
        app.exit();
      }
    });

    return mainWindow;
  } catch (error) {
    console.error('Failed to create window:', error);
    app.quit();
  }
}

// Enhanced app event handlers
app.whenReady().then(async () => {
  try {
    // Initialize storage service
    await storageService.initialize();
    console.log('Storage service initialized');

    // Create main window
    await createWindow();

    // Set up application menu
    setupApplicationMenu();

    // Handle app activation (macOS)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

  } catch (error) {
    console.error('Failed to initialize application:', error);
    dialog.showErrorBox('Initialization Error',
      'Failed to initialize the application. Please restart and try again.');
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Enhanced error handling wrapper
function withErrorHandling(operation, context = {}) {
  return async (...args) => {
    try {
      return await operation(...args);
    } catch (error) {
      console.error(`Error in ${context.operation || 'unknown operation'}:`, error);

      // Save error to storage for debugging
      try {
        await storageService.saveSetting('lastError', {
          timestamp: new Date().toISOString(),
          operation: context.operation,
          error: error.message,
          stack: error.stack
        });
      } catch (storageError) {
        console.error('Failed to save error to storage:', storageError);
      }

      return {
        success: false,
        error: error.message,
        code: error.code,
        context
      };
    }
  };
}

// ===== BINANCE API IPC HANDLERS =====

// Ping endpoint - test basic connectivity
ipcMain.handle('binance:ping', async () => {
  try {
    console.log('Main process: Ping request received');
    const result = await BinanceAPI.ping();
    console.log('Main process: Ping successful');
    return { success: true, data: result };
  } catch (error) {
    console.error('Main process: Ping failed:', error.message);
    return {
      success: false,
      error: error.message,
      code: error.code || 'PING_ERROR'
    };
  }
});

// Get account information (requires API keys)
ipcMain.handle('binance:accountInfo', async (event, apiConfig) => {
  try {
    console.log('Main process: Account info request received');

    if (!apiConfig || !apiConfig.apiKey || !apiConfig.apiSecret) {
      // Use embedded API keys if not provided
      apiConfig = {
        apiKey: 'teGoWtR4oUftjl1ME8rDAc8iEmFfNoUsRhF0k8Qfg4u8JhsQmRwhKZUxeTKkDpFB',
        apiSecret: 'xfY8z9W88O0JBef5RRqQRiVcJ8hKJ9jqC7LKaCWx1k6GYukMg8T7v2kZEQNVnoWI'
      };
    }

    const result = await BinanceAPI.getAccountInfo(apiConfig);
    console.log('Main process: Account info retrieved successfully');
    return { success: true, data: result };
  } catch (error) {
    console.error('Main process: Account info failed:', error.message);
    return {
      success: false,
      error: error.message,
      code: error.code || 'ACCOUNT_ERROR'
    };
  }
});

// Get current prices for a symbol
ipcMain.handle('binance:prices', async (event, symbol) => {
  try {
    console.log(`Main process: Price request for ${symbol}`);
    const result = await BinanceAPI.getCurrentPrice(symbol);
    console.log(`Main process: Price data retrieved for ${symbol}`);
    return { success: true, data: result };
  } catch (error) {
    console.error(`Main process: Price request failed for ${symbol}:`, error.message);
    return {
      success: false,
      error: error.message,
      code: error.code || 'PRICE_ERROR'
    };
  }
});



// Get candlestick data
ipcMain.handle('binance:candles', async (event, symbol, interval, options = {}) => {
  try {
    console.log(`Main process: Candles request for ${symbol} (${interval})`);
    const result = await BinanceAPI.getCandlesticks(symbol, interval, options);
    console.log(`Main process: Candles data retrieved for ${symbol}`);
    return { success: true, data: result };
  } catch (error) {
    console.error(`Main process: Candles request failed for ${symbol}:`, error.message);
    return {
      success: false,
      error: error.message,
      code: error.code || 'CANDLES_ERROR'
    };
  }
});

// Get trade history (requires API keys)
ipcMain.handle('binance:myTrades', async (event, apiConfig, symbol, options = {}) => {
  try {
    console.log(`Main process: Trade history request for ${symbol}`);

    if (!apiConfig || !apiConfig.apiKey || !apiConfig.apiSecret) {
      throw new Error('API configuration missing');
    }

    const result = await BinanceAPI.getMyTrades(apiConfig, symbol, options);
    console.log(`Main process: Trade history retrieved for ${symbol}`);
    return { success: true, data: result };
  } catch (error) {
    console.error(`Main process: Trade history failed for ${symbol}:`, error.message);
    return {
      success: false,
      error: error.message,
      code: error.code || 'TRADES_ERROR'
    };
  }
});

// Execute market order (requires API keys)
ipcMain.handle('binance:marketOrder', async (event, apiConfig, symbol, side, quantity) => {
  try {
    console.log(`Main process: Market order request - ${side} ${quantity} ${symbol}`);

    if (!apiConfig || !apiConfig.apiKey || !apiConfig.apiSecret) {
      throw new Error('API configuration missing');
    }

    const result = await BinanceAPI.createMarketOrder(apiConfig, symbol, side, quantity);
    console.log(`Main process: Market order executed successfully`);
    return { success: true, data: result };
  } catch (error) {
    console.error('Main process: Market order failed:', error.message);
    return {
      success: false,
      error: error.message,
      code: error.code || 'ORDER_ERROR'
    };
  }
});

// ===== TRADING BOT IPC HANDLERS =====

let activeTradingBots = new Map();

// Start trading bot with full configuration persistence
ipcMain.on('start-trading-bot', withErrorHandling(async (event, config) => {
  // Validate configuration
  if (!config || !config.apiConfig || !config.symbol || !config.strategy) {
    event.reply('trading-error', 'Invalid configuration provided');
    return;
  }

  const botId = `${config.symbol}-${Date.now()}`;

  console.log(`Starting enhanced trading bot: ${botId}`);
  console.log('Configuration:', {
    symbol: config.symbol,
    strategy: config.strategy,
    amount: config.amount,
    interval: config.interval
  });

  // Save bot configuration
  await storageService.saveSetting(`bot_config_${botId}`, {
    ...config,
    botId,
    startTime: Date.now(),
    status: 'starting'
  });

  // Test API connection before starting
  try {
    await BinanceAPI.accountInfo(config.apiConfig);
    console.log('✓ API connection verified');
  } catch (err) {
    console.error('✗ API connection failed:', err.message);
    event.reply('trading-error', `API connection failed: ${err.message}`);
    return;
  }

  // Convert interval to cron schedule
  const cronSchedule = convertToCronSchedule(config.interval);
  console.log(`Scheduled with cron: ${cronSchedule}`);

  // Initialize bot state
  const botState = {
    config,
    botId,
    startTime: Date.now(),
    lastCheck: null,
    lastSignal: null,
    tradesExecuted: 0,
    totalProfit: 0,
    positions: {},
    orders: {},
    status: 'active'
  };

  // Schedule the trading strategy
  const job = schedule.scheduleJob(cronSchedule, async () => {
    try {
      console.log(`[${botId}] Executing scheduled check at ${new Date().toLocaleTimeString()}`);

      const result = await executeTradeStrategy(config, botState);

      // Update bot state
      botState.lastCheck = Date.now();
      botState.lastSignal = result.action;

      if (result.action !== 'HOLD') {
        botState.tradesExecuted++;
        if (result.profit) {
          botState.totalProfit += result.profit;
        }

        // Save trade execution to persistent storage
        await storageService.saveTrade({
          id: `bot_${botId}_${Date.now()}`,
          botId: botId,
          symbol: config.symbol,
          side: result.action,
          quantity: result.quantity,
          price: result.price,
          timestamp: Date.now(),
          strategy: config.strategy,
          reason: result.reason,
          profit: result.profit || 0,
          source: 'trading_bot_auto'
        });

        // Notify UI of trade execution
        event.reply('trade-executed', {
          botId: botId,
          time: new Date().toISOString(),
          symbol: config.symbol,
          side: result.action,
          price: result.price,
          quantity: result.quantity,
          reason: result.reason,
          profit: result.profit
        });
      }

      // Save updated bot state
      await storageService.saveSetting(`bot_state_${botId}`, botState);

      // Update UI with status
      event.reply('trading-status', {
        status: 'running',
        botId,
        lastCheck: botState.lastCheck,
        signal: result.action,
        reason: result.reason,
        tradesExecuted: botState.tradesExecuted,
        totalProfit: botState.totalProfit,
        message: `Last check: ${new Date().toLocaleTimeString()} - Signal: ${result.action} - ${result.reason}`
      });

    } catch (err) {
      console.error(`[${botId}] Error executing trade strategy:`, err.message);

      // Save error to storage
      await storageService.saveSetting(`bot_error_${botId}_${Date.now()}`, {
        botId,
        error: err.message,
        timestamp: Date.now(),
        config
      });

      event.reply('trading-error', `[${botId}] Trade execution failed: ${err.message}`);
    }
  });

  // Store the active bot
  activeBots.set(botId, {
    job,
    config,
    state: botState,
    createdAt: Date.now()
  });

  // Save bot as active
  await storageService.saveSetting(`active_bot_${botId}`, {
    botId,
    symbol: config.symbol,
    strategy: config.strategy,
    startTime: Date.now(),
    status: 'active'
  });

  // Reply to renderer
  event.reply('trading-status', {
    status: 'started',
    botId,
    message: `Enhanced bot started for ${config.symbol} using ${config.strategy} strategy`,
    config: {
      symbol: config.symbol,
      strategy: config.strategy,
      amount: config.amount,
      interval: config.interval
    }
  });

}, { operation: 'start_trading_bot' }));

// Stop trading bot with cleanup
ipcMain.on('stop-trading-bot', withErrorHandling(async (event, { botId } = {}) => {
  if (!botId) {
    // Stop all bots
    const stopCount = await stopAllTradingBots();
    event.reply('trading-status', {
      status: 'stopped',
      message: `All trading bots stopped (${stopCount} bots)`
    });
    return;
  }

  // Stop specific bot
  const stopped = await stopTradingBot(botId);

  if (stopped) {
    event.reply('trading-status', {
      status: 'stopped',
      botId,
      message: `Bot ${botId} stopped successfully`
    });
  } else {
    event.reply('trading-error', `Bot with ID ${botId} not found or already stopped`);
  }
}, { operation: 'stop_trading_bot' }));

// ============================
// Enhanced Storage IPC Handlers
// ============================

// Get trading history from storage
ipcMain.handle('storage:getTrades', withErrorHandling(async (event, filters) => {
  const trades = await storageService.getTrades(filters);
  return { success: true, data: trades };
}, { operation: 'get_stored_trades' }));

// Get trading statistics
ipcMain.handle('storage:getStatistics', withErrorHandling(async (event, filters) => {
  const stats = await storageService.getTradeStatistics(filters);
  return { success: true, data: stats };
}, { operation: 'get_statistics' }));

// Export data
ipcMain.handle('storage:exportData', withErrorHandling(async (event) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Trading Data',
    defaultPath: `neutrontrader-export-${new Date().toISOString().split('T')[0]}.json`,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (filePath) {
    await storageService.exportData(filePath);
    return { success: true, filePath };
  }

  return { success: false, error: 'Export cancelled' };
}, { operation: 'export_data' }));

// Import data
ipcMain.handle('storage:importData', withErrorHandling(async (event) => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Trading Data',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (filePaths && filePaths.length > 0) {
    await storageService.importData(filePaths[0]);
    return { success: true, filePath: filePaths[0] };
  }

  return { success: false, error: 'Import cancelled' };
}, { operation: 'import_data' }));

// ============================
// Helper Functions
// ============================

// Helper function to convert intervals to cron schedules
function convertToCronSchedule(interval) {
  const unit = interval.slice(-1);
  const value = parseInt(interval.slice(0, -1), 10);

  switch (unit) {
    case 'm': // minutes
      return `*/${value} * * * *`;
    case 'h': // hours
      return `0 */${value} * * *`;
    case 'd': // days
      return `0 0 */${value} * *`;
    default:
      return '*/15 * * * *'; // Default to 15 minutes
  }
}

// Function to execute the trading strategy
async function executeTradeStrategy(config, botState) {
  console.log(`Executing ${config.strategy} strategy for ${config.symbol}`);

  try {
    // Get current price
    const priceResult = await BinanceAPI.prices(config.symbol);
    const currentPrice = parseFloat(priceResult.price);
    console.log(`Current price for ${config.symbol}: ${currentPrice}`);

    // Get historical candles for analysis
    const candlesResult = await BinanceAPI.candles(config.symbol, config.interval, { limit: 50 });

    // Format candles data
    const candles = candlesResult.map(candle => ({
      openTime: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
      closeTime: candle[6],
      quoteAssetVolume: parseFloat(candle[7]),
      numberOfTrades: candle[8],
      takerBuyBaseAssetVolume: parseFloat(candle[9]),
      takerBuyQuoteAssetVolume: parseFloat(candle[10])
    }));

    // Get account info to check balances
    const accountInfo = await BinanceAPI.accountInfo(config.apiConfig);

    // Execute strategy based on config
    let signal;

    switch (config.strategy) {
      case 'simpleMovingAverage':
        signal = executeSimpleMovingAverage(candles);
        break;
      case 'relativeStrengthIndex':
        signal = executeRSIStrategy(candles);
        break;
      case 'bollingerBands':
        signal = executeBollingerBandsStrategy(candles, currentPrice);
        break;
      default:
        console.log('Unknown strategy, defaulting to HOLD');
        return {
          action: 'HOLD',
          price: currentPrice,
          reason: 'Unknown strategy'
        };
    }

    console.log(`Strategy signal: ${signal.action} - ${signal.reason}`);

    // For now, just return the signal - in a real implementation,
    // you would execute trades based on the signal
    return {
      action: signal.action,
      price: currentPrice,
      quantity: config.amount,
      reason: signal.reason
    };
  } catch (error) {
    console.error(`Error in strategy execution: ${error.message}`);
    throw error;
  }
}

async function stopTradingBot(botId) {
  const bot = activeBots.get(botId);
  if (bot && bot.job) {
    bot.job.cancel();
    activeBots.delete(botId);

    // Update bot status in storage
    await storageService.saveSetting(`bot_final_state_${botId}`, {
      ...bot.state,
      status: 'stopped',
      stopTime: Date.now()
    });

    // Remove from active bots
    await storageService.saveSetting(`active_bot_${botId}`, null);

    console.log(`✓ Bot stopped: ${botId}`);
    return true;
  }
  return false;
}

async function stopAllTradingBots() {
  let stopCount = 0;
  const botIds = Array.from(activeBots.keys());

  for (const botId of botIds) {
    if (await stopTradingBot(botId)) {
      stopCount++;
    }
  }

  return stopCount;
}

function convertToCronSchedule(interval) {
  const unit = interval.slice(-1);
  const value = parseInt(interval.slice(0, -1), 10);

  switch (unit) {
    case 'm': return `*/${value} * * * *`;
    case 'h': return `0 */${value} * * *`;
    case 'd': return `0 0 */${value} * *`;
    default: return '*/15 * * * *';
  }
}

async function executeTradeStrategy(config, botState) {
  console.log(`[${botState.botId}] Executing ${config.strategy} strategy for ${config.symbol}`);

  try {
    // Get current price
    const priceResult = await BinanceAPI.prices(config.symbol);
    const currentPrice = parseFloat(priceResult.price);

    // Get historical candles for analysis
    const candlesResult = await BinanceAPI.candles(config.symbol, config.interval, { limit: 50 });

    // Format candles data (same as before)
    const candles = candlesResult.map(candle => ({
      openTime: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    }));

    // Execute strategy
    let signal;
    switch (config.strategy) {
      case 'simpleMovingAverage':
        signal = executeSimpleMovingAverage(candles);
        break;
      case 'relativeStrengthIndex':
        signal = executeRSIStrategy(candles);
        break;
      case 'bollingerBands':
        signal = executeBollingerBandsStrategy(candles, currentPrice);
        break;
      default:
        signal = { action: 'HOLD', reason: 'Unknown strategy' };
    }

    console.log(`[${botState.botId}] Strategy signal: ${signal.action} - ${signal.reason}`);

    return {
      action: signal.action,
      price: currentPrice,
      quantity: config.amount,
      reason: signal.reason,
      timestamp: Date.now()
    };

  } catch (error) {
    console.error(`[${botState.botId}] Error in strategy execution:`, error.message);
    throw error;
  }
}

// Strategy implementations (simplified for demo)
function executeSimpleMovingAverage(candles) {
  const closePrices = candles.map(candle => candle.close);
  const shortSMA = calculateSMA(closePrices, 5);
  const longSMA = calculateSMA(closePrices, 20);

  if (shortSMA.length < 2 || longSMA.length < 2) {
    return { action: 'HOLD', reason: 'Insufficient data for SMA calculation' };
  }

  const currentShort = shortSMA[shortSMA.length - 1];
  const previousShort = shortSMA[shortSMA.length - 2];
  const currentLong = longSMA[longSMA.length - 1];
  const previousLong = longSMA[longSMA.length - 2];

  if (previousShort <= previousLong && currentShort > currentLong) {
    return { action: 'BUY', reason: 'SMA bullish crossover detected' };
  }

  if (previousShort >= previousLong && currentShort < currentLong) {
    return { action: 'SELL', reason: 'SMA bearish crossover detected' };
  }

  return { action: 'HOLD', reason: 'No SMA crossover signal' };
}

function executeRSIStrategy(candles) {
  // Simplified RSI implementation
  return { action: 'HOLD', reason: 'RSI strategy placeholder' };
}

function executeBollingerBandsStrategy(candles, currentPrice) {
  // Simplified Bollinger Bands implementation
  return { action: 'HOLD', reason: 'Bollinger Bands strategy placeholder' };
}

function calculateSMA(prices, period) {
  const result = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

function setupApplicationMenu() {
  // Application menu setup would go here
  // This is platform-specific and enhances the user experience
}

// Handle app errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Save critical error and attempt graceful shutdown
  dialog.showErrorBox('Critical Error',
    'A critical error occurred. The application will now close.');
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log the error but don't crash the app
});

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in main process:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in main process:', reason);
});

console.log('Main process: IPC handlers registered successfully');