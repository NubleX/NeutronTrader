// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)
// src/services/binanceFetchApi.js - Using fetch instead of axios
// Base URL for Binance Testnet
const BASE_URL = 'https://testnet.binance.vision';

/**
 * Creates an HMAC SHA256 signature for Binance API requests
 */
async function createSignature(queryString, apiSecret) {
  // Use the Web Crypto API
  const encoder = new TextEncoder();
  const key = encoder.encode(apiSecret);
  const data = encoder.encode(queryString);

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw', key,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await window.crypto.subtle.sign(
    'HMAC', cryptoKey, data
  );

  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Handle response from fetch request
 */
async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(
      errorData.msg || `API request failed with status ${response.status}`
    );
    error.status = response.status;
    error.code = errorData.code;
    error.response = { data: errorData };
    throw error;
  }

  return await response.json();
}

// Simplified Binance API Client using fetch
const BinanceFetchApi = {
  // Test connectivity
  ping: async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/v3/ping`);
      return await handleResponse(response);
    } catch (error) {
      console.error('Ping error:', error);
      throw error;
    }
  },

  // Get server time
  time: async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/v3/time`);
      return await handleResponse(response);
    } catch (error) {
      console.error('Time error:', error);
      throw error;
    }
  },

  // Get account information (authenticated)
  accountInfo: async (apiConfig) => {
    try {
      // Prepare parameters
      const params = {
        timestamp: Date.now()
      };

      // Create query string
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

      // Sign the request
      const signature = await createSignature(queryString, apiConfig.apiSecret);

      // Make the request
      const response = await fetch(
        `${BASE_URL}/api/v3/account?${queryString}&signature=${signature}`,
        {
          method: 'GET',
          headers: {
            'X-MBX-APIKEY': apiConfig.apiKey
          }
        }
      );

      return await handleResponse(response);
    } catch (error) {
      console.error('Account info error:', error);
      throw error;
    }
  },

  // Get market prices
  prices: async (symbol = null) => {
    try {
      const url = `${BASE_URL}/api/v3/ticker/price` +
        (symbol ? `?symbol=${symbol}` : '');
      const response = await fetch(url);
      return await handleResponse(response);
    } catch (error) {
      console.error('Prices error:', error);
      throw error;
    }
  },

  // Get candlestick data
  candles: async (symbol, interval, options = {}) => {
    try {
      // Prepare parameters
      const params = {
        symbol,
        interval,
        ...options
      };

      // Create query string
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

      // Make the request
      const response = await fetch(`${BASE_URL}/api/v3/klines?${queryString}`);
      const data = await handleResponse(response);

      // Transform response data to a more usable format
      return data.map(candle => ({
        openTime: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
        closeTime: candle[6],
        quoteAssetVolume: candle[7],
        numberOfTrades: candle[8],
        takerBuyBaseAssetVolume: candle[9],
        takerBuyQuoteAssetVolume: candle[10]
      }));
    } catch (error) {
      console.error('Candles error:', error);
      throw error;
    }
  },

  // Get user trades (authenticated)
  myTrades: async (apiConfig, symbol, options = {}) => {
    try {
      // Prepare parameters
      const params = {
        symbol,
        ...options,
        timestamp: Date.now()
      };

      // Create query string
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

      // Sign the request
      const signature = await createSignature(queryString, apiConfig.apiSecret);

      // Make the request
      const response = await fetch(
        `${BASE_URL}/api/v3/myTrades?${queryString}&signature=${signature}`,
        {
          method: 'GET',
          headers: {
            'X-MBX-APIKEY': apiConfig.apiKey
          }
        }
      );

      return await handleResponse(response);
    } catch (error) {
      console.error('My trades error:', error);
      throw error;
    }
  },

  // Execute a market order (authenticated)
  marketOrder: async (apiConfig, symbol, side, quantity) => {
    try {
      // Prepare parameters
      const params = {
        symbol,
        side,
        type: 'MARKET',
        quantity,
        timestamp: Date.now()
      };

      // Create query string
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');

      // Sign the request
      const signature = await createSignature(queryString, apiConfig.apiSecret);

      // Make the request
      const response = await fetch(
        `${BASE_URL}/api/v3/order`,
        {
          method: 'POST',
          headers: {
            'X-MBX-APIKEY': apiConfig.apiKey,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `${queryString}&signature=${signature}`
        }
      );

      return await handleResponse(response);
    } catch (error) {
      console.error('Market order error:', error);
      throw error;
    }
  }
};

export default BinanceFetchApi;