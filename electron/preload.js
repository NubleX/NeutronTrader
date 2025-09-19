// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

const { contextBridge, ipcRenderer } = require('electron');

// Expose API methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Binance API methods
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
      ipcRenderer.invoke('binance:marketOrder', apiConfig, symbol, side, quantity),
  },

  // Trading bot methods
  tradingBot: {
    start: (config) => {
      ipcRenderer.send('start-trading-bot', config);

      // Return a promise that resolves when trading status is received
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

      // Return a promise that resolves when trading status is received
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

      // Return a function to remove the listener
      return () => {
        ipcRenderer.removeListener('trading-status', callback);
      };
    },

    onError: (callback) => {
      ipcRenderer.on('trading-error', (_, data) => callback(data));

      // Return a function to remove the listener
      return () => {
        ipcRenderer.removeListener('trading-error', callback);
      };
    },

    onTradeExecuted: (callback) => {
      ipcRenderer.on('trade-executed', (_, data) => callback(data));

      // Return a function to remove the listener
      return () => {
        ipcRenderer.removeListener('trade-executed', callback);
      };
    }
  }
});