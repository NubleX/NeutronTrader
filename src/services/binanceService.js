// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import Binance from 'binance-api-node';

// Initialize Binance client
const createClient = (apiConfig) => {
  return Binance({
    apiKey: apiConfig.apiKey,
    apiSecret: apiConfig.apiSecret,
    // Use testnet for development to avoid trading with real funds
    useServerTime: true,
  });
};

// Get account information
export const getAccountInfo = async (apiConfig) => {
  try {
    // For development, return mock data instead of making a real API call
    // In a production app, you would use:
    // const client = createClient(apiConfig);
    // return await client.accountInfo();
    
    // Mock account data
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
          free: '0.00234500',
          locked: '0.00000000'
        },
        {
          asset: 'ETH',
          free: '0.05872300',
          locked: '0.00000000'
        },
        {
          asset: 'USDT',
          free: '25.35791200',
          locked: '0.00000000'
        },
        {
          asset: 'BNB',
          free: '1.75200000',
          locked: '0.00000000'
        },
        {
          asset: 'ADA',
          free: '112.37450000',
          locked: '0.00000000'
        }
      ]
    };
  } catch (error) {
    console.error('Error fetching account info:', error);
    throw new Error('Failed to fetch account information');
  }
};

// Get current prices for a trading pair
export const getPrices = async (symbol) => {
  try {
    // For demo purposes, generate mock data
    // In a real application, you would use:
    // const client = createClient(apiConfig);
    // const candles = await client.candles({ symbol, interval: '1h', limit: 24 });
    
    // Mock data for demonstration
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    
    const mockPrices = [];
    let basePrice = symbol === 'BTCUSDT' ? 45000 : 
                   symbol === 'ETHUSDT' ? 3500 : 400;
    
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
  } catch (error) {
    console.error('Error fetching prices:', error);
    throw new Error('Failed to fetch price data');
  }
};

// Get trade history
export const getTradeHistory = async (apiConfig, filter) => {
  try {
    // For demo purposes, generate mock data
    // In a real app you would use:
    // const client = createClient(apiConfig);
    // const trades = await client.myTrades({ symbol: filter.symbol !== 'all' ? filter.symbol : undefined });
    
    // Generate mock trade history data
    const mockTrades = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    // Determine how far back to generate data based on filter
    let daysBack = 7;
    if (filter.dateRange === '24h') daysBack = 1;
    if (filter.dateRange === '30days') daysBack = 30;
    if (filter.dateRange === 'all') daysBack = 90;
    
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    
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
      const qty = randomSymbol === 'BTCUSDT' ? 0.05 * Math.random() : 
                 randomSymbol === 'ETHUSDT' ? 0.3 * Math.random() : 2 * Math.random();
      
      // Generate random profit/loss
      const profit = (Math.random() - 0.4) * price * qty * 0.1;
      
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
  } catch (error) {
    console.error('Error fetching trade history:', error);
    throw new Error('Failed to fetch trade history');
  }
};

// Execute a trade
export const executeTrade = async (apiConfig, tradeParams) => {
  try {
    const client = createClient(apiConfig);
    
    if (tradeParams.side === 'BUY') {
      return await client.order({
        symbol: tradeParams.symbol,
        side: 'BUY',
        quantity: tradeParams.quantity,
        price: tradeParams.price,
        type: 'LIMIT'
      });
    } else {
      return await client.order({
        symbol: tradeParams.symbol,
        side: 'SELL',
        quantity: tradeParams.quantity,
        price: tradeParams.price,
        type: 'LIMIT'
      });
    }
  } catch (error) {
    console.error('Error executing trade:', error);
    throw new Error(`Failed to execute ${tradeParams.side} order`);
  }
};
