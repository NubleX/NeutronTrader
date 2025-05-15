// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const isDev = process.env.NODE_ENV !== 'production';
const BinanceApi = require('./binanceApi');
const schedule = require('node-schedule');

// Store active trading bots
const activeBots = new Map();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : url.format({
        pathname: path.join(__dirname, '../build/index.html'),
        protocol: 'file:',
        slashes: true
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

// ============================
// IPC Handlers for Binance API
// ============================

// Test API connectivity
ipcMain.handle('binance:ping', async () => {
  try {
    const result = await BinanceApi.ping();
    return { success: true, data: result };
  } catch (error) {
    console.error('Ping error:', error);
    return { success: false, error: error.message };
  }
});

// Get account information
ipcMain.handle('binance:accountInfo', async (event, apiConfig) => {
  try {
    const result = await BinanceApi.accountInfo(apiConfig);
    return { success: true, data: result };
  } catch (error) {
    console.error('Account info error:', error);
    return { success: false, error: error.message };
  }
});

// Get market prices
ipcMain.handle('binance:prices', async (event, symbol) => {
  try {
    const result = await BinanceApi.prices(symbol);
    return { success: true, data: result };
  } catch (error) {
    console.error('Prices error:', error);
    return { success: false, error: error.message };
  }
});

// Get candles data
ipcMain.handle('binance:candles', async (event, symbol, interval, options) => {
  try {
    const result = await BinanceApi.candles(symbol, interval, options);
    
    // Transform the data into a more usable format
    const formattedResult = result.map(candle => ({
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
    
    return { success: true, data: formattedResult };
  } catch (error) {
    console.error('Candles error:', error);
    return { success: false, error: error.message };
  }
});

// Get trade history
ipcMain.handle('binance:myTrades', async (event, apiConfig, symbol, options) => {
  try {
    const result = await BinanceApi.myTrades(apiConfig, symbol, options);
    return { success: true, data: result };
  } catch (error) {
    console.error('My trades error:', error);
    return { success: false, error: error.message };
  }
});

// Execute market order
ipcMain.handle('binance:marketOrder', async (event, apiConfig, symbol, side, quantity) => {
  try {
    const result = await BinanceApi.marketOrder(apiConfig, symbol, side, quantity);
    return { success: true, data: result };
  } catch (error) {
    console.error('Market order error:', error);
    return { success: false, error: error.message };
  }
});

// ============================
// Trading Bot IPC Handlers
// ============================

// Start trading bot
ipcMain.on('start-trading-bot', async (event, config) => {
  try {
    // Validate the config object
    if (!config || !config.apiConfig || !config.symbol || !config.strategy || !config.interval) {
      return event.reply('trading-error', 'Invalid configuration');
    }
    
    // Create a unique ID for this bot instance
    const botId = `${config.symbol}-${Date.now()}`;
    
    // Log the start of the bot
    console.log(`Starting trading bot for ${config.symbol} using ${config.strategy} strategy`);
    console.log(`Trading parameters: Amount=${config.amount}, Interval=${config.interval}`);
    console.log(`Take Profit: ${config.takeProfit}%, Stop Loss: ${config.stopLoss}%`);
    
    // Convert interval to cron schedule (e.g., 15m -> */15 * * * *)
    const cronSchedule = convertToCronSchedule(config.interval);
    console.log(`Scheduled with cron: ${cronSchedule}`);
    
    // Test API connection
    try {
      const result = await BinanceApi.accountInfo(config.apiConfig);
      console.log('API connection successful');
    } catch (err) {
      console.error(`API connection failed: ${err.message}`);
      return event.reply('trading-error', `API connection failed: ${err.message}`);
    }
    
    // Initialize bot state
    const botState = {
      config,
      lastCheck: Date.now(),
      lastSignal: null,
      positions: {}, // Track active positions
      orders: {}     // Track open orders
    };
    
    // Schedule the trading strategy
    const job = schedule.scheduleJob(cronSchedule, async () => {
      try {
        console.log(`Executing scheduled check for ${config.symbol} at ${new Date().toLocaleTimeString()}`);
        
        // Execute the trading strategy
        const result = await executeTradeStrategy(config, botState);
        botState.lastCheck = Date.now();
        botState.lastSignal = result.action;
        
        // If there was a trade, notify the UI
        if (result.action !== 'HOLD') {
          event.reply('trade-executed', {
            time: new Date().toISOString(),
            symbol: config.symbol,
            side: result.action,
            price: result.price,
            quantity: result.quantity,
            reason: result.reason
          });
        }
        
        // Update UI with status
        event.reply('trading-status', {
          status: 'started',
          botId,
          message: `Last check: ${new Date().toLocaleTimeString()} - Signal: ${result.action} - ${result.reason}`
        });
      } catch (err) {
        console.error(`Error executing trade strategy: ${err.message}`);
        event.reply('trading-error', `Trade execution failed: ${err.message}`);
      }
    });
    
    // Store the active bot
    activeBots.set(botId, { 
      job,
      config,
      state: botState
    });
    
    // Reply to the renderer
    event.reply('trading-status', { 
      status: 'started',
      botId,
      message: `Bot started for ${config.symbol} using ${config.strategy} strategy` 
    });
  } catch (error) {
    console.error('Error starting trading bot:', error);
    event.reply('trading-error', `Failed to start bot: ${error.message}`);
  }
});

// Stop trading bot
ipcMain.on('stop-trading-bot', (event, { botId } = {}) => {
  try {
    // If no specific botId provided, stop all bots
    if (!botId) {
      let stopCount = 0;
      activeBots.forEach((bot, id) => {
        if (bot.job) {
          bot.job.cancel();
          stopCount++;
          console.log(`Stopped bot: ${id}`);
        }
      });
      activeBots.clear();
      
      return event.reply('trading-status', { 
        status: 'stopped',
        message: `All trading bots stopped (${stopCount} bots)` 
      });
    }
    
    // Stop specific bot
    const bot = activeBots.get(botId);
    if (bot && bot.job) {
      bot.job.cancel();
      activeBots.delete(botId);
      
      console.log(`Stopped bot: ${botId}`);
      event.reply('trading-status', { 
        status: 'stopped',
        botId,
        message: `Bot for ${bot.config.symbol} stopped` 
      });
    } else {
      event.reply('trading-error', `Bot with ID ${botId} not found`);
    }
  } catch (error) {
    console.error('Error stopping trading bot:', error);
    event.reply('trading-error', `Failed to stop bot: ${error.message}`);
  }
});

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
    const priceResult = await BinanceApi.prices(config.symbol);
    const currentPrice = parseFloat(priceResult.price);
    console.log(`Current price for ${config.symbol}: ${currentPrice}`);
    
    // Get historical candles for analysis
    const candlesResult = await BinanceApi.candles(config.symbol, config.interval, { limit: 50 });
    
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
    const accountInfo = await BinanceApi.accountInfo(config.apiConfig);
    
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

// Implement your strategy functions here
// This is a simple placeholder example
function executeSimpleMovingAverage(candles) {
  // Extract close prices
  const closePrices = candles.map(candle => candle.close);
  
  // Define SMA periods
  const shortPeriod = 5;
  const longPeriod = 20;
  
  // Calculate SMAs
  const shortSMA = calculateSMA(closePrices, shortPeriod);
  const longSMA = calculateSMA(closePrices, longPeriod);
  
  // Check for crossovers
  const currentShortSMA = shortSMA[shortSMA.length - 1];
  const previousShortSMA = shortSMA[shortSMA.length - 2];
  const currentLongSMA = longSMA[longSMA.length - 1];
  const previousLongSMA = longSMA[longSMA.length - 2];
  
  // Buy signal: short SMA crosses above long SMA
  if (previousShortSMA <= previousLongSMA && currentShortSMA > currentLongSMA) {
    return {
      action: 'BUY',
      reason: 'Short-term SMA crossed above long-term SMA'
    };
  }
  
  // Sell signal: short SMA crosses below long SMA
  if (previousShortSMA >= previousLongSMA && currentShortSMA < currentLongSMA) {
    return {
      action: 'SELL',
      reason: 'Short-term SMA crossed below long-term SMA'
    };
  }
  
  // No signal
  return {
    action: 'HOLD',
    reason: 'No SMA crossover detected'
  };
}

// Implement RSI strategy
function executeRSIStrategy(candles) {
  // Placeholder implementation
  return {
    action: 'HOLD',
    reason: 'RSI strategy not fully implemented'
  };
}

// Implement Bollinger Bands strategy
function executeBollingerBandsStrategy(candles, currentPrice) {
  // Placeholder implementation
  return {
    action: 'HOLD',
    reason: 'Bollinger Bands strategy not fully implemented'
  };
}

// Helper function to calculate SMA
function calculateSMA(prices, period) {
  const result = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  
  return result;
}