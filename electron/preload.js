// NeutronTrader - Updated preload.js with WebSocket API
// electron/preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose API methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Binance API methods (existing)
  binance: {
    ping: () => ipcRenderer.invoke('binance:ping'),

    getAccountInfo: (apiConfig) =>
      ipcRenderer.invoke('binance:accountInfo', apiConfig),

    getPrices: (symbol) =>
      ipcRenderer.invoke('binance:prices', symbol),

    getCandles: (symbol, interval, options) =>
      ipcRenderer.invoke('binance:candles', symbol, interval, options),

    getMyTrades: (apiConfig, symbol, options) =>
      ipcRenderer.invoke('binance:myTrades', apiConfig, symbol, options),

    executeMarketOrder: (apiConfig, symbol, side, quantity) =>
      ipcRenderer.invoke('binance:marketOrder', apiConfig, symbol, side, quantity)
  },

  // WebSocket API methods (new)
  websocket: {
    // Create a new WebSocket connection
    create: (options) =>
      ipcRenderer.invoke('websocket:create', options),

    // Subscribe to data streams
    subscribe: (connectionId, subscriptionData) =>
      ipcRenderer.invoke('websocket:subscribe', connectionId, subscriptionData),

    // Unsubscribe from data streams
    unsubscribe: (connectionId, unsubscriptionData) =>
      ipcRenderer.invoke('websocket:unsubscribe', connectionId, unsubscriptionData),

    // Send raw message
    send: (connectionId, message) =>
      ipcRenderer.invoke('websocket:send', connectionId, message),

    // Close connection
    close: (connectionId) =>
      ipcRenderer.invoke('websocket:close', connectionId),

    // Get connection status
    getStatus: (connectionId) =>
      ipcRenderer.invoke('websocket:status', connectionId),

    // Event listeners for WebSocket events
    onMessage: (connectionId, callback) => {
      const handler = (event, data) => {
        if (!connectionId || data.connectionId === connectionId) {
          callback(data);
        }
      };
      ipcRenderer.on('websocket:message', handler);

      // Return cleanup function
      return () => ipcRenderer.removeListener('websocket:message', handler);
    },

    onOpen: (connectionId, callback) => {
      const handler = (event, data) => {
        if (!connectionId || data.connectionId === connectionId) {
          callback(data);
        }
      };
      ipcRenderer.on('websocket:open', handler);

      return () => ipcRenderer.removeListener('websocket:open', handler);
    },

    onClose: (connectionId, callback) => {
      const handler = (event, data) => {
        if (!connectionId || data.connectionId === connectionId) {
          callback(data);
        }
      };
      ipcRenderer.on('websocket:close', handler);

      return () => ipcRenderer.removeListener('websocket:close', handler);
    },

    onError: (connectionId, callback) => {
      const handler = (event, data) => {
        if (!connectionId || data.connectionId === connectionId) {
          callback(data);
        }
      };
      ipcRenderer.on('websocket:error', handler);

      return () => ipcRenderer.removeListener('websocket:error', handler);
    },

    // Remove all listeners for a connection
    removeAllListeners: (connectionId) => {
      if (connectionId) {
        // Remove specific connection listeners
        // This is a simplified version - in production you'd want more granular control
        ipcRenderer.removeAllListeners('websocket:message');
        ipcRenderer.removeAllListeners('websocket:open');
        ipcRenderer.removeAllListeners('websocket:close');
        ipcRenderer.removeAllListeners('websocket:error');
      }
    }
  },

  // Professional data feed methods
  professionalData: {
    // Initialize professional data service
    initialize: () =>
      ipcRenderer.invoke('professional:initialize'),

    // Subscribe to symbols with professional-grade data
    subscribe: (symbols, options) =>
      ipcRenderer.invoke('professional:subscribe', symbols, options),

    // Get aggregated market data
    getAggregatedData: (symbol) =>
      ipcRenderer.invoke('professional:aggregatedData', symbol),

    // Get latency statistics
    getLatencyStats: () =>
      ipcRenderer.invoke('professional:latencyStats'),

    // Get data quality report
    getDataQualityReport: () =>
      ipcRenderer.invoke('professional:dataQuality'),

    // Event listeners for professional data
    // The handler reference must be stored so removeListener can find the exact
    // function that was registered — passing `callback` directly would not match
    // the anonymous wrapper and the listener would leak on every component mount.
    onMarketData: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('professional:marketData', handler);
      return () => ipcRenderer.removeListener('professional:marketData', handler);
    },

    onLatencyUpdate: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('professional:latencyUpdate', handler);
      return () => ipcRenderer.removeListener('professional:latencyUpdate', handler);
    },

    onQualityAlert: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('professional:qualityAlert', handler);
      return () => ipcRenderer.removeListener('professional:qualityAlert', handler);
    }
  },

  // Trading bot methods (existing)
  tradingBot: {
    start: (config) => {
      ipcRenderer.send('start-trading-bot', config);

      return new Promise((resolve) => {
        const handler = (_, data) => {
          ipcRenderer.removeListener('trading-status', handler);
          resolve(data);
        };

        ipcRenderer.on('trading-status', handler);
      });
    },

    stop: (botId) => {
      ipcRenderer.send('stop-trading-bot', { botId });

      return new Promise((resolve) => {
        const handler = (_, data) => {
          ipcRenderer.removeListener('trading-status', handler);
          resolve(data);
        };

        ipcRenderer.on('trading-status', handler);
      });
    },

    onStatus: (callback) => {
      ipcRenderer.on('trading-status', (_, data) => callback(data));

      return () => {
        ipcRenderer.removeListener('trading-status', callback);
      };
    },

    onError: (callback) => {
      ipcRenderer.on('trading-error', (_, data) => callback(data));

      return () => {
        ipcRenderer.removeListener('trading-error', callback);
      };
    },

    onTradeExecuted: (callback) => {
      ipcRenderer.on('trade-executed', (_, data) => callback(data));

      return () => {
        ipcRenderer.removeListener('trade-executed', callback);
      };
    }
  },

  // System utilities
  system: {
    // Get system performance metrics
    getPerformanceMetrics: () =>
      ipcRenderer.invoke('system:performance'),

    // Get memory usage
    getMemoryUsage: () =>
      ipcRenderer.invoke('system:memory'),

    // Get network latency to various endpoints
    getNetworkLatency: () =>
      ipcRenderer.invoke('system:latency'),

    // Check if we're running in development mode
    isDev: () =>
      ipcRenderer.invoke('system:isDev'),

    // Get application version
    getVersion: () =>
      ipcRenderer.invoke('system:version')
  },

  // Security utilities
  security: {
    encrypt: (data, password) =>
      ipcRenderer.invoke('security:encrypt', data, password),
    decrypt: (encryptedData, password) =>
      ipcRenderer.invoke('security:decrypt', encryptedData, password),
    hashApiKey: (apiKey) =>
      ipcRenderer.invoke('security:hashApiKey', apiKey),
    validateApiKey: (apiKey) =>
      ipcRenderer.invoke('security:validateApiKey', apiKey),
    storeCredentials: (exchange, apiKey, apiSecret, passphrase) =>
      ipcRenderer.invoke('security:storeCredentials', exchange, apiKey, apiSecret, passphrase),
    loadCredentials: (exchange) =>
      ipcRenderer.invoke('security:loadCredentials', exchange)
  },

  // Price feed aggregator
  priceFeed: {
    start: (symbols, options) => ipcRenderer.invoke('pricefeed:start', symbols, options),
    stop: () => ipcRenderer.invoke('pricefeed:stop'),
    getSnapshot: () => ipcRenderer.invoke('pricefeed:snapshot'),
    getSymbolPrices: (symbol) => ipcRenderer.invoke('pricefeed:symbolPrices', symbol)
  },

  // Multi-exchange API
  exchange: {
    configure: (exchange, config) => ipcRenderer.invoke('exchange:configure', { exchange, config }),
    list: () => ipcRenderer.invoke('exchange:list'),
    ping: (exchange) => ipcRenderer.invoke('exchange:ping', exchange),
    getPrice: (exchange, symbol) => ipcRenderer.invoke('exchange:price', exchange, symbol),
    getOrderBook: (exchange, symbol, limit) => ipcRenderer.invoke('exchange:orderbook', exchange, symbol, limit),
    getCandles: (exchange, symbol, interval, options) => ipcRenderer.invoke('exchange:candles', exchange, symbol, interval, options),
    getAccount: (exchange) => ipcRenderer.invoke('exchange:account', exchange),
    marketOrder: (exchange, symbol, side, quantity) => ipcRenderer.invoke('exchange:marketOrder', exchange, symbol, side, quantity),
    limitOrder: (exchange, symbol, side, quantity, price, timeInForce) => ipcRenderer.invoke('exchange:limitOrder', exchange, symbol, side, quantity, price, timeInForce),
    cancelOrder: (exchange, symbol, orderId) => ipcRenderer.invoke('exchange:cancelOrder', exchange, symbol, orderId),
    getSymbols: (exchange) => ipcRenderer.invoke('exchange:symbols', exchange),
    // Arbitrage opportunities stream
    onOpportunity: (callback) => {
      ipcRenderer.on('arb:opportunity', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('arb:opportunity');
    },
    // Listing alerts
    onNewListing: (callback) => {
      ipcRenderer.on('listing:new', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('listing:new');
    }
  },

  // Wallet/DeFi API
  wallet: {
    createWallet: (chain) => ipcRenderer.invoke('wallet:create', chain),
    importWallet: (chain, privateKey) => ipcRenderer.invoke('wallet:import', chain, privateKey),
    getAddress: (chain) => ipcRenderer.invoke('wallet:address', chain),
    getBalance: (chain, address) => ipcRenderer.invoke('wallet:balance', chain, address),
    listWallets: () => ipcRenderer.invoke('wallet:list'),
    getPoolPrice: (chain, tokenA, tokenB) => ipcRenderer.invoke('defi:poolPrice', chain, tokenA, tokenB)
  },

  // Sniper API
  sniper: {
    start: (config) => ipcRenderer.invoke('sniper:start', config),
    stop: () => ipcRenderer.invoke('sniper:stop'),
    getHistory: () => ipcRenderer.invoke('sniper:history'),
    updateConfig: (config) => ipcRenderer.invoke('sniper:config', config),
    onAlert: (callback) => {
      ipcRenderer.on('sniper:alert', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('sniper:alert');
    }
  },

  // Arbitrage API
  arbitrage: {
    start: (config) => ipcRenderer.invoke('arb:start', config),
    stop: () => ipcRenderer.invoke('arb:stop'),
    getHistory: () => ipcRenderer.invoke('arb:history'),
    onExecuted: (callback) => {
      ipcRenderer.on('arb:executed', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('arb:executed');
    }
  },

  // Listing detector API
  listing: {
    start: (config) => ipcRenderer.invoke('listing:start', config),
    stop: () => ipcRenderer.invoke('listing:stop'),
    onNewListing: (callback) => {
      ipcRenderer.on('listing:new', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('listing:new');
    }
  },

  // Risk manager API
  risk: {
    getStatus: () => ipcRenderer.invoke('risk:status'),
    resetCircuitBreaker: () => ipcRenderer.invoke('risk:resetCircuitBreaker'),
    updateConfig: (config) => ipcRenderer.invoke('risk:updateConfig', config)
  },

  // File system operations (for trading logs, configs, etc.)
  fs: {
    // Read file
    readFile: (path, options) =>
      ipcRenderer.invoke('fs:readFile', path, options),

    // Write file
    writeFile: (path, data, options) =>
      ipcRenderer.invoke('fs:writeFile', path, data, options),

    // Check if file exists
    exists: (path) =>
      ipcRenderer.invoke('fs:exists', path),

    // Create directory
    mkdir: (path) =>
      ipcRenderer.invoke('fs:mkdir', path),

    // List directory contents
    readdir: (path) =>
      ipcRenderer.invoke('fs:readdir', path)
  }
});

// Enhanced error handling
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in renderer:', event.reason);

  // Send error to main process for logging
  ipcRenderer.send('renderer-error', {
    type: 'unhandledRejection',
    error: event.reason,
    timestamp: Date.now()
  });
});

window.addEventListener('error', (event) => {
  console.error('Unhandled error in renderer:', event.error);

  // Send error to main process for logging
  ipcRenderer.send('renderer-error', {
    type: 'error',
    error: {
      message: event.error.message,
      stack: event.error.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    },
    timestamp: Date.now()
  });
});

console.log('NeutronTrader preload script loaded successfully');
console.log('Available APIs:', Object.keys(window.electronAPI));