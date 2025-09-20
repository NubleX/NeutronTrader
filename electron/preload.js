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
    onMarketData: (callback) => {
      ipcRenderer.on('professional:marketData', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('professional:marketData', callback);
    },

    onLatencyUpdate: (callback) => {
      ipcRenderer.on('professional:latencyUpdate', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('professional:latencyUpdate', callback);
    },

    onQualityAlert: (callback) => {
      ipcRenderer.on('professional:qualityAlert', (event, data) => callback(data));
      return () => ipcRenderer.removeListener('professional:qualityAlert', callback);
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
    // Encrypt sensitive data
    encrypt: (data, password) =>
      ipcRenderer.invoke('security:encrypt', data, password),

    // Decrypt sensitive data
    decrypt: (encryptedData, password) =>
      ipcRenderer.invoke('security:decrypt', encryptedData, password),

    // Hash API keys for storage
    hashApiKey: (apiKey) =>
      ipcRenderer.invoke('security:hashApiKey', apiKey),

    // Validate API key format
    validateApiKey: (apiKey) =>
      ipcRenderer.invoke('security:validateApiKey', apiKey)
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