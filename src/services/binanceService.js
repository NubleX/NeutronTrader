// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)
// src/services/binanceService.js
// Using the Electron IPC API instead of direct fetch calls

// Helper to check if Electron API is available
const isElectronAvailable = () => {
  return window.electronAPI !== undefined;
};

// Get account information
export const getAccountInfo = async (apiConfig) => {
  try {
    if (apiConfig.isConfigured && apiConfig.apiKey && apiConfig.apiSecret) {
      console.log('Fetching account info...');

      if (!isElectronAvailable()) {
        console.log('Electron API not available, using mock data');
        return getMockAccountData();
      }

      const result = await window.electronAPI.binance.getAccountInfo(apiConfig);

      if (result.success) {
        console.log('Account info received');
        return result.data;
      } else {
        throw new Error(result.error);
      }
    }

    // Return mock data if no API keys or for development
    return getMockAccountData();
  } catch (error) {
    console.error('Error in getAccountInfo:', error);
    throw new Error(`Failed to fetch account information: ${error.message}`);
  }
};

// Get current prices for a trading pair
export const getPrices = async (symbol, apiConfig = null) => {
  try {
    // If Electron API is available and we have a configured API, use it
    if (isElectronAvailable()) {
      console.log(`Fetching price data for ${symbol}...`);

      // First get the current price
      const priceResult = await window.electronAPI.binance.getPrices(symbol);

      if (!priceResult.success) {
        throw new Error(priceResult.error);
      }

      // Then get candles for more detailed chart data
      const candlesResult = await window.electronAPI.binance.getCandles(
        symbol, '1h', { limit: 24 }
      );

      if (!candlesResult.success) {
        throw new Error(candlesResult.error);
      }

      // Convert to the format expected by the chart component
      return candlesResult.data.map(candle => ({
        time: new Date(candle.openTime).toLocaleTimeString(),
        price: parseFloat(candle.close)
      }));
    }

    // Fall back to mock data if Electron API is not available
    return getMockPrices(symbol);
  } catch (error) {
    console.error('Error fetching prices:', error);
    throw new Error(`Failed to fetch price data: ${error.message}`);
  }
};

// Get trade history
export const getTradeHistory = async (apiConfig, filter) => {
  try {
    if (apiConfig.isConfigured && apiConfig.apiKey && apiConfig.apiSecret && isElectronAvailable()) {
      // Only fetch for a specific symbol, since 'all' would require multiple requests
      if (filter.symbol !== 'all') {
        console.log(`Fetching trade history for ${filter.symbol}...`);

        // Set up parameters
        const params = {};

        // Add time range if specified
        if (filter.dateRange === '24h') {
          params.startTime = Date.now() - (24 * 60 * 60 * 1000);
        } else if (filter.dateRange === '7days') {
          params.startTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
        } else if (filter.dateRange === '30days') {
          params.startTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
        }

        // Set limit
        params.limit = 50;

        // Fetch trade history
        const result = await window.electronAPI.binance.getMyTrades(
          apiConfig, filter.symbol, params
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        // Process trades
        const trades = result.data;
        const processedTrades = trades.map(trade => ({
          id: trade.id.toString(),
          symbol: trade.symbol,
          price: parseFloat(trade.price),
          qty: parseFloat(trade.qty),
          time: trade.time,
          side: trade.isBuyer ? 'BUY' : 'SELL',
          profit: !trade.isBuyer ? parseFloat(trade.commission || 0) * -1 : 0
        }));

        // Sort by time, newest first
        return processedTrades.sort((a, b) => b.time - a.time);
      }
    }

    // Return mock data if not configured or non-specific symbol
    return getMockTradeHistory(filter);
  } catch (error) {
    console.error('Error fetching trade history:', error);
    throw new Error(`Failed to fetch trade history: ${error.message}`);
  }
};

// Execute a market trade
export const executeMarketTrade = async (apiConfig, tradeParams) => {
  try {
    if (!isElectronAvailable()) {
      throw new Error('Electron API not available, cannot execute trade');
    }

    console.log(`Executing ${tradeParams.side} order for ${tradeParams.quantity} ${tradeParams.symbol}`);

    const result = await window.electronAPI.binance.executeMarketOrder(
      apiConfig,
      tradeParams.symbol,
      tradeParams.side,
      tradeParams.quantity
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  } catch (error) {
    console.error('Error executing trade:', error);
    throw new Error(`Failed to execute ${tradeParams.side} order: ${error.message}`);
  }
};

// Check asset balances
export const getAssetBalance = async (apiConfig, asset) => {
  try {
    const accountInfo = await getAccountInfo(apiConfig);
    const balance = accountInfo.balances.find(b => b.asset === asset);

    return balance ? {
      free: parseFloat(balance.free),
      locked: parseFloat(balance.locked)
    } : { free: 0, locked: 0 };
  } catch (error) {
    console.error('Error fetching asset balance:', error);
    throw new Error(`Failed to fetch balance: ${error.message}`);
  }
};

// Start a trading bot
export const startTradingBot = async (config) => {
  try {
    if (!isElectronAvailable()) {
      console.log('Electron API not available, cannot start bot');
      return {
        status: 'started',
        message: 'Browser mode: Trading bot would start (simulation)'
      };
    }

    return await window.electronAPI.tradingBot.start(config);
  } catch (error) {
    console.error('Error starting trading bot:', error);
    throw new Error(`Failed to start trading bot: ${error.message}`);
  }
};

// Stop a trading bot
export const stopTradingBot = async (botId = null) => {
  try {
    if (!isElectronAvailable()) {
      console.log('Electron API not available, cannot stop bot');
      return {
        status: 'stopped',
        message: 'Browser mode: Trading bot would stop (simulation)'
      };
    }

    return await window.electronAPI.tradingBot.stop(botId);
  } catch (error) {
    console.error('Error stopping trading bot:', error);
    throw new Error(`Failed to stop trading bot: ${error.message}`);
  }
};

// Register trading bot event listeners
export const registerTradingBotListeners = (callbacks) => {
  if (!isElectronAvailable()) {
    console.log('Electron API not available, cannot register bot listeners');
    return () => { }; // Return empty cleanup function
  }

  // Register listeners
  const cleanupFunctions = [];

  if (callbacks.onStatus) {
    cleanupFunctions.push(window.electronAPI.tradingBot.onStatus(callbacks.onStatus));
  }

  if (callbacks.onError) {
    cleanupFunctions.push(window.electronAPI.tradingBot.onError(callbacks.onError));
  }

  if (callbacks.onTradeExecuted) {
    cleanupFunctions.push(window.electronAPI.tradingBot.onTradeExecuted(callbacks.onTradeExecuted));
  }

  // Return a cleanup function that calls all cleanup functions
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
  };
};

// Mock data functions for development
function getMockAccountData() {
  return {
    makerCommission: 10,
    takerCommission: 10,
    buyerCommission: 0,
    sellerCommission: 0,
    canTrade: true,
    canWithdraw: true,
    canDeposit: true,
    updateTime: Date.now(),
    accountType: 'SPOT',
    balances: [
      {
        asset: 'BTC',
        free: '0.00100000',
        locked: '0.00000000'
      },
      {
        asset: 'BNB',
        free: '10.00000000',
        locked: '0.00000000'
      },
      {
        asset: 'ETH',
        free: '1.00000000',
        locked: '0.00000000'
      },
      {
        asset: 'USDT',
        free: '1000.00000000',
        locked: '0.00000000'
      }
    ]
  };
}

function getMockPrices(symbol) {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  const mockPrices = [];
  let basePrice = symbol === 'BNBUSDT' ? 400 :
    symbol === 'BTCUSDT' ? 45000 : 3500;

  for (let i = 24; i >= 0; i--) {
    const time = new Date(now - (i * hourMs));
    const randomChange = (Math.random() - 0.5) * basePrice * 0.02;
    basePrice += randomChange;

    mockPrices.push({
      time: time.toLocaleTimeString(),
      price: basePrice
    });
  }

  return mockPrices;
}

function getMockTradeHistory(filter) {
  const mockTrades = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Determine how far back to generate data based on filter
  let daysBack = 7;
  if (filter.dateRange === '24h') daysBack = 1;
  if (filter.dateRange === '30days') daysBack = 30;
  if (filter.dateRange === 'all') daysBack = 90;

  const symbols = ['BNBUSDT', 'BTCUSDT', 'ETHUSDT'];

  for (let i = 0; i < 20; i++) {
    const randomDay = Math.floor(Math.random() * daysBack);
    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];

    // Skip if filter is set to specific symbol
    if (filter.symbol !== 'all' && filter.symbol !== randomSymbol) {
      continue;
    }

    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const basePrice = randomSymbol === 'BTCUSDT' ? 45000 :
      randomSymbol === 'ETHUSDT' ? 3500 : 400;
    const price = basePrice + (Math.random() - 0.5) * basePrice * 0.1;
    const qty = randomSymbol === 'BTCUSDT' ? 0.005 * Math.random() :
      randomSymbol === 'ETHUSDT' ? 0.05 * Math.random() : 0.5 * Math.random();

    // Generate random profit/loss for sell trades
    const profit = side === 'SELL' ? (Math.random() - 0.4) * price * qty * 0.1 : 0;

    mockTrades.push({
      id: `trade-${i}`,
      symbol: randomSymbol,
      price,
      qty,
      time: now - (randomDay * dayMs) - (Math.random() * dayMs),
      side,
      profit
    });
  }

  // Sort by time, newest first
  return mockTrades.sort((a, b) => b.time - a.time);
}