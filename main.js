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
const { storageService } = require('./electron/storageService');
const { keyVault } = require('./electron/security/keyVault');
const { PriceFeedAggregator } = require('./electron/priceFeedAggregator');
const { ListingDetector } = require('./electron/listingDetector/index');
const { riskManager } = require('./electron/riskManager');
const { OrderManager } = require('./electron/orderManager');
const { ArbitrageEngine } = require('./electron/strategies/arbitrageEngine');
const { SniperEngine } = require('./electron/strategies/sniperEngine');
const { chainManager } = require('./electron/defi/chainManager');
const { walletManager } = require('./electron/defi/walletManager');
const { UniswapAdapter } = require('./electron/defi/uniswapAdapter');
const { PancakeSwapAdapter } = require('./electron/defi/pancakeswapAdapter');
const { encrypt, decrypt, hashApiKey, validateApiKeyFormat } = require('./electron/security/encryption');
const { BinanceAdapter } = require('./electron/exchanges/binanceAdapter');
const { CoinbaseAdapter } = require('./electron/exchanges/coinbaseAdapter');
const { KrakenAdapter } = require('./electron/exchanges/krakenAdapter');
const { OKXAdapter } = require('./electron/exchanges/okxAdapter');
const { BybitAdapter } = require('./electron/exchanges/bybitAdapter');
const activeBots = new Map();

const ADAPTER_CLASSES = {
  binance: BinanceAdapter,
  coinbase: CoinbaseAdapter,
  kraken: KrakenAdapter,
  okx: OKXAdapter,
  bybit: BybitAdapter
};

// Registry of configured exchange adapters
const exchangeAdapters = new Map();
exchangeAdapters.set('binance', new BinanceAdapter({ isTestnet: true }));

function getAdapter(name) {
  const adapter = exchangeAdapters.get(name);
  if (!adapter) throw new Error(`Exchange "${name}" not configured`);
  return adapter;
}
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
      ? 'http://localhost:5173'
      : url.format({
        pathname: path.join(__dirname, 'dist/index.html'),
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
      throw new Error('API configuration missing');
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

// Strategy engine singletons
let arbitrageEngine = null;
let sniperEngine = null;
let listingDetector = null;
const orderManager = new OrderManager(exchangeAdapters);

// ===== STRATEGY ENGINE IPC HANDLERS =====

ipcMain.handle('arb:start', async (event, config) => {
  try {
    if (!priceFeedAggregator) return { success: false, error: 'Price feed not started' };
    if (arbitrageEngine) arbitrageEngine.stop();
    arbitrageEngine = new ArbitrageEngine(priceFeedAggregator, riskManager, orderManager, config);
    arbitrageEngine.on('executed', (record) => {
      const allWindows = require('electron').BrowserWindow.getAllWindows();
      allWindows.forEach(w => w.webContents.send('arb:executed', record));
    });
    arbitrageEngine.start();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('arb:stop', async () => {
  if (arbitrageEngine) { arbitrageEngine.stop(); arbitrageEngine = null; }
  return { success: true };
});

ipcMain.handle('arb:history', async () => {
  return { success: true, data: arbitrageEngine ? arbitrageEngine.getHistory() : [] };
});

ipcMain.handle('sniper:start', async (event, config) => {
  try {
    if (sniperEngine) sniperEngine.stop();
    sniperEngine = new SniperEngine(null /* listingDetector wired below */, riskManager, orderManager, config);
    sniperEngine.on('sniped', (record) => {
      const allWindows = require('electron').BrowserWindow.getAllWindows();
      allWindows.forEach(w => w.webContents.send('sniper:alert', record));
    });
    sniperEngine.start();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('sniper:stop', async () => {
  if (sniperEngine) { sniperEngine.stop(); sniperEngine = null; }
  return { success: true };
});

ipcMain.handle('sniper:history', async () => {
  return { success: true, data: sniperEngine ? sniperEngine.getHistory() : [] };
});

ipcMain.handle('sniper:config', async (event, config) => {
  if (sniperEngine) sniperEngine.updateConfig(config);
  return { success: true };
});

ipcMain.handle('risk:status', async () => {
  return { success: true, data: riskManager.getStatus() };
});

ipcMain.handle('risk:resetCircuitBreaker', async () => {
  riskManager.resetCircuitBreaker();
  return { success: true };
});

ipcMain.handle('risk:updateConfig', async (event, config) => {
  Object.assign(riskManager.config, config);
  return { success: true };
});

// ===== LISTING DETECTOR IPC HANDLERS =====

ipcMain.handle('listing:start', async (event, config) => {
  try {
    if (listingDetector) listingDetector.stop();
    listingDetector = new ListingDetector(exchangeAdapters, config);
    listingDetector.on('new-listing', (listing) => {
      const allWindows = require('electron').BrowserWindow.getAllWindows();
      allWindows.forEach(w => w.webContents.send('listing:new', listing));
      // Forward to sniper if active
      if (sniperEngine && sniperEngine.isRunning()) {
        sniperEngine.listingDetector = listingDetector;
        sniperEngine.emit('new-listing-forward', listing);
      }
    });
    await listingDetector.start();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('listing:stop', async () => {
  if (listingDetector) { listingDetector.stop(); listingDetector = null; }
  return { success: true };
});

// ===== DEFI IPC HANDLERS =====

// DEX adapters (lazy init)
const defiAdapters = {
  ethereum: () => new UniswapAdapter('ethereum', chainManager),
  arbitrum: () => new UniswapAdapter('arbitrum', chainManager),
  polygon:  () => new UniswapAdapter('polygon', chainManager),
  bsc:      () => new PancakeSwapAdapter(chainManager)
};

ipcMain.handle('wallet:create', async (event, chain) => {
  try {
    const result = await walletManager.createWallet(chain);
    return { success: true, data: { address: result.address } }; // never expose mnemonic to renderer
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('wallet:import', async (event, chain, privateKey) => {
  try {
    const result = await walletManager.importWallet(chain, privateKey);
    return { success: true, data: { address: result.address } };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('wallet:address', async (event, chain) => {
  try {
    const wallets = await walletManager.listWallets();
    const w = wallets.find(x => x.chain === chain);
    return { success: true, data: w ? w.address : null };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('wallet:balance', async (event, chain, address) => {
  try {
    const balance = await walletManager.getBalance(chain, address);
    return { success: true, data: balance };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('wallet:list', async () => {
  try {
    const wallets = await walletManager.listWallets();
    return { success: true, data: wallets };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('defi:poolPrice', async (event, chain, tokenA, tokenB) => {
  try {
    const factory = defiAdapters[chain];
    if (!factory) throw new Error(`No DEX adapter for chain: ${chain}`);
    const adapter = factory();
    const result = await adapter.getPoolPrice(tokenA, tokenB);
    return { success: true, data: result };
  } catch (e) { return { success: false, error: e.message }; }
});

// ===== PRICE FEED AGGREGATOR =====

let priceFeedAggregator = null;

ipcMain.handle('pricefeed:start', async (event, symbols, options) => {
  try {
    if (priceFeedAggregator) priceFeedAggregator.stop();
    priceFeedAggregator = new PriceFeedAggregator(exchangeAdapters, options);
    priceFeedAggregator.on('arbitrage-opportunity', (opp) => {
      const allWindows = require('electron').BrowserWindow.getAllWindows();
      allWindows.forEach(w => w.webContents.send('arb:opportunity', opp));
    });
    priceFeedAggregator.start(symbols);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('pricefeed:stop', async () => {
  if (priceFeedAggregator) { priceFeedAggregator.stop(); priceFeedAggregator = null; }
  return { success: true };
});

ipcMain.handle('pricefeed:snapshot', async () => {
  if (!priceFeedAggregator) return { success: true, data: {} };
  return { success: true, data: priceFeedAggregator.getPriceSnapshot() };
});

ipcMain.handle('pricefeed:symbolPrices', async (event, symbol) => {
  if (!priceFeedAggregator) return { success: true, data: [] };
  return { success: true, data: priceFeedAggregator.getPricesForSymbol(symbol) };
});

// ===== SECURITY IPC HANDLERS =====

ipcMain.handle('security:encrypt', async (event, data, password) => {
  try {
    return { success: true, data: encrypt(data, password) };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('security:decrypt', async (event, encryptedData, password) => {
  try {
    return { success: true, data: decrypt(encryptedData, password) };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('security:hashApiKey', async (event, apiKey) => {
  return { success: true, data: hashApiKey(apiKey) };
});

ipcMain.handle('security:validateApiKey', async (event, apiKey) => {
  return { success: true, data: validateApiKeyFormat(apiKey) };
});

// Store exchange credentials via key vault
ipcMain.handle('security:storeCredentials', async (event, exchange, apiKey, apiSecret, passphrase) => {
  try {
    await keyVault.storeExchangeCredentials(exchange, apiKey, apiSecret, passphrase);
    // Re-configure the adapter with the new credentials
    const Cls = ADAPTER_CLASSES[exchange];
    if (Cls) {
      const existing = exchangeAdapters.get(exchange);
      const isTestnet = existing ? existing.isTestnet : true;
      exchangeAdapters.set(exchange, new Cls({ apiKey, apiSecret, passphrase, isTestnet }));
    }
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// Load persisted credentials on startup
ipcMain.handle('security:loadCredentials', async (event, exchange) => {
  try {
    const creds = await keyVault.getExchangeCredentials(exchange);
    if (creds) {
      const Cls = ADAPTER_CLASSES[exchange];
      if (Cls) {
        const existing = exchangeAdapters.get(exchange);
        const isTestnet = existing ? existing.isTestnet : true;
        exchangeAdapters.set(exchange, new Cls({ ...creds, isTestnet }));
      }
      return { success: true, hasCredentials: true };
    }
    return { success: true, hasCredentials: false };
  } catch (e) { return { success: false, error: e.message }; }
});

// ===== MULTI-EXCHANGE IPC HANDLERS =====

ipcMain.handle('exchange:configure', async (event, { exchange, config }) => {
  try {
    const Cls = ADAPTER_CLASSES[exchange];
    if (!Cls) throw new Error(`Unknown exchange: ${exchange}`);
    exchangeAdapters.set(exchange, new Cls(config));
    await storageService.saveSetting(`exchange_config_${exchange}`, { exchange, isTestnet: config.isTestnet });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('exchange:list', async () => {
  return { success: true, data: Array.from(exchangeAdapters.keys()) };
});

ipcMain.handle('exchange:ping', async (event, exchange) => {
  try {
    const result = await getAdapter(exchange).ping();
    return { success: true, data: result };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('exchange:price', async (event, exchange, symbol) => {
  try {
    const result = await getAdapter(exchange).getCurrentPrice(symbol);
    return { success: true, data: result };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('exchange:orderbook', async (event, exchange, symbol, limit) => {
  try {
    const result = await getAdapter(exchange).getOrderBook(symbol, limit);
    return { success: true, data: result };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('exchange:candles', async (event, exchange, symbol, interval, options) => {
  try {
    const result = await getAdapter(exchange).getCandlesticks(symbol, interval, options);
    return { success: true, data: result };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('exchange:account', async (event, exchange) => {
  try {
    const result = await getAdapter(exchange).getAccountInfo();
    return { success: true, data: result };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('exchange:marketOrder', async (event, exchange, symbol, side, quantity) => {
  try {
    const result = await getAdapter(exchange).createMarketOrder(symbol, side, quantity);
    return { success: true, data: result };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('exchange:limitOrder', async (event, exchange, symbol, side, quantity, price, timeInForce) => {
  try {
    const result = await getAdapter(exchange).createLimitOrder(symbol, side, quantity, price, timeInForce);
    return { success: true, data: result };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('exchange:cancelOrder', async (event, exchange, symbol, orderId) => {
  try {
    const result = await getAdapter(exchange).cancelOrder(symbol, orderId);
    return { success: true, data: result };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('exchange:symbols', async (event, exchange) => {
  try {
    const result = await getAdapter(exchange).getListedSymbols();
    return { success: true, data: result };
  } catch (e) { return { success: false, error: e.message }; }
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
    await BinanceAPI.getAccountInfo(config.apiConfig);
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

async function executeTradeStrategy(config, botState) {
  console.log(`[${botState.botId}] Executing ${config.strategy} strategy for ${config.symbol}`);

  try {
    // Get current price
    const priceResult = await BinanceAPI.getCurrentPrice(config.symbol);
    const currentPrice = parseFloat(priceResult.price);

    // Get historical candles for analysis
    const candlesResult = await BinanceAPI.getCandlesticks(config.symbol, config.interval, { limit: 50 });

    // candlesResult is already formatted by getCandlesticks
    const candles = candlesResult;

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

function executeRSIStrategy(candles, period = 14, overbought = 70, oversold = 30) {
  const closes = candles.map(c => c.close);
  if (closes.length < period + 1) {
    return { action: 'HOLD', reason: 'Insufficient data for RSI calculation' };
  }

  // Wilder's smoothing RSI
  const deltas = [];
  for (let i = 1; i < closes.length; i++) deltas.push(closes[i] - closes[i - 1]);

  const gains = deltas.map(d => d > 0 ? d : 0);
  const losses = deltas.map(d => d < 0 ? -d : 0);

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < deltas.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  if (rsi < oversold) return { action: 'BUY', reason: `RSI oversold (${rsi.toFixed(1)})` };
  if (rsi > overbought) return { action: 'SELL', reason: `RSI overbought (${rsi.toFixed(1)})` };
  return { action: 'HOLD', reason: `RSI neutral (${rsi.toFixed(1)})` };
}

function executeBollingerBandsStrategy(candles, currentPrice, period = 20, stdDevMultiplier = 2) {
  const closes = candles.map(c => c.close);
  if (closes.length < period) {
    return { action: 'HOLD', reason: 'Insufficient data for Bollinger Bands' };
  }

  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upperBand = sma + stdDevMultiplier * stdDev;
  const lowerBand = sma - stdDevMultiplier * stdDev;

  if (currentPrice <= lowerBand) {
    return { action: 'BUY', reason: `Price at lower Bollinger Band (${lowerBand.toFixed(4)})` };
  }
  if (currentPrice >= upperBand) {
    return { action: 'SELL', reason: `Price at upper Bollinger Band (${upperBand.toFixed(4)})` };
  }
  return { action: 'HOLD', reason: `Price within Bollinger Bands (${lowerBand.toFixed(4)} - ${upperBand.toFixed(4)})` };
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

console.log('Main process: IPC handlers registered successfully');