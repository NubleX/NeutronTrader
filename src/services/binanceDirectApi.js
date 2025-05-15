// src/services/binanceDirectApi.js
import axios from 'axios';

// Base URL for Binance Testnet
const BASE_URL = 'https://testnet.binance.vision';

/**
 * Create a signature for authenticated requests
 * @param {string} queryString - The query string to sign
 * @param {string} apiSecret - The API secret key
 * @returns {string} - The signature
 */
async function createSignature(queryString, apiSecret) {
  // Use the subtle crypto API instead of Node.js crypto
  const encoder = new TextEncoder();
  const key = encoder.encode(apiSecret);
  const data = encoder.encode(queryString);
  
  // Create the signature using HMAC-SHA256
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw', 
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await window.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    data
  );
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Make an authenticated GET request
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @param {Object} apiConfig - API configuration with keys
 * @returns {Promise<any>} - Response data
 */
async function signedGetRequest(endpoint, params = {}, apiConfig) {
  // Add timestamp to params
  params.timestamp = Date.now();
  
  // Convert params to query string
  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  // Create signature (now asynchronous)
  const signature = await createSignature(queryString, apiConfig.apiSecret);
  
  try {
    // Make the request
    const response = await axios.get(
      `${BASE_URL}${endpoint}?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': apiConfig.apiKey
        }
      }
    );
    
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Make an authenticated POST request
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Request parameters
 * @param {Object} apiConfig - API configuration with keys
 * @returns {Promise<any>} - Response data
 */
async function signedPostRequest(endpoint, params = {}, apiConfig) {
  // Add timestamp to params
  params.timestamp = Date.now();
  
  // Convert params to query string
  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  // Create signature (now asynchronous)
  const signature = await createSignature(queryString, apiConfig.apiSecret);
  
  try {
    // Make the request
    const response = await axios.post(
      `${BASE_URL}${endpoint}`,
      `${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': apiConfig.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
}

/**
 * Handle API errors with detailed logging
 * @param {Error} error - The error object
 */
function handleApiError(error) {
  console.error('API request failed:');
  
  if (error.response) {
    // The request was made and the server responded with an error
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
    
    // Specific Binance error handling
    if (error.response.data && error.response.data.code) {
      const errorCode = error.response.data.code;
      const errorMsg = error.response.data.msg;
      
      console.error(`Binance Error ${errorCode}: ${errorMsg}`);
      
      // Common Binance error codes
      switch(errorCode) {
        case -1022:
          console.error('Signature validation failed. Check your API secret or system time.');
          break;
        case -2015:
          console.error('Invalid API key, IP, or permissions for action.');
          break;
        case -1021:
          console.error('Timestamp for this request is outside of the recvWindow.');
          break;
      }
    }
  } else if (error.request) {
    // The request was made but no response received
    console.error('No response received from server');
  } else {
    // Error setting up the request
    console.error('Error setting up request:', error.message);
  }
}

/**
 * Binance API client with direct implementation
 */
const BinanceApi = {
  // Public endpoints
  
  /**
   * Test connectivity to the API
   * @returns {Promise<{}>} - Empty object on success
   */
  ping: () => publicRequest('/api/v3/ping'),
  
  /**
   * Get server time
   * @returns {Promise<{serverTime: number}>} - Server time in milliseconds
   */
  time: () => publicRequest('/api/v3/time'),
  
  /**
   * Get exchange information
   * @returns {Promise<Object>} - Exchange information
   */
  exchangeInfo: () => publicRequest('/api/v3/exchangeInfo'),
  
  /**
   * Get order book for a symbol
   * @param {string} symbol - Trading pair symbol
   * @param {number} limit - Number of entries (default 100, max 5000)
   * @returns {Promise<Object>} - Order book
   */
  depth: (symbol, limit = 100) => publicRequest('/api/v3/depth', { symbol, limit }),
  
  /**
   * Get recent trades for a symbol
   * @param {string} symbol - Trading pair symbol
   * @param {number} limit - Number of trades (default 500, max 1000)
   * @returns {Promise<Array>} - Recent trades
   */
  trades: (symbol, limit = 500) => publicRequest('/api/v3/trades', { symbol, limit }),
  
  /**
   * Get klines (candlestick) data
   * @param {string} symbol - Trading pair symbol
   * @param {string} interval - Kline interval (1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M)
   * @param {Object} options - Additional options (limit, startTime, endTime)
   * @returns {Promise<Array>} - Kline data
   */
  candles: (symbol, interval, options = {}) => {
    return publicRequest('/api/v3/klines', { 
      symbol, 
      interval,
      ...options
    }).then(data => {
      // Transform the raw data to a more usable format
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
    });
  },
  
  /**
   * Get ticker price for one or all symbols
   * @param {string} symbol - Trading pair symbol (optional)
   * @returns {Promise<Object|Array>} - Price ticker(s)
   */
  prices: (symbol = null) => {
    const params = symbol ? { symbol } : {};
    return publicRequest('/api/v3/ticker/price', params);
  },
  
  // Authenticated endpoints
  
  /**
   * Get account information
   * @param {Object} apiConfig - API configuration
   * @returns {Promise<Object>} - Account information
   */
  accountInfo: (apiConfig) => signedGetRequest('/api/v3/account', {}, apiConfig),
  
  /**
   * Get current open orders
   * @param {Object} apiConfig - API configuration
   * @param {string} symbol - Trading pair symbol (optional)
   * @returns {Promise<Array>} - Open orders
   */
  openOrders: (apiConfig, symbol = null) => {
    const params = symbol ? { symbol } : {};
    return signedGetRequest('/api/v3/openOrders', params, apiConfig);
  },
  
  /**
   * Get all orders (open, filled, cancelled)
   * @param {Object} apiConfig - API configuration
   * @param {string} symbol - Trading pair symbol
   * @param {Object} options - Additional options (orderId, startTime, endTime, limit)
   * @returns {Promise<Array>} - Orders
   */
  allOrders: (apiConfig, symbol, options = {}) => {
    return signedGetRequest('/api/v3/allOrders', { symbol, ...options }, apiConfig);
  },
  
  /**
   * Get trade history
   * @param {Object} apiConfig - API configuration
   * @param {string} symbol - Trading pair symbol (optional)
   * @param {Object} options - Additional options (fromId, startTime, endTime, limit)
   * @returns {Promise<Array>} - Trade history
   */
  myTrades: (apiConfig, symbol = null, options = {}) => {
    const params = symbol ? { symbol, ...options } : options;
    return signedGetRequest('/api/v3/myTrades', params, apiConfig);
  },
  
  /**
   * Create a new order
   * @param {Object} apiConfig - API configuration
   * @param {Object} orderParams - Order parameters
   * @returns {Promise<Object>} - Order result
   */
  createOrder: (apiConfig, orderParams) => {
    return signedPostRequest('/api/v3/order', orderParams, apiConfig);
  },
  
  /**
   * Cancel an order
   * @param {Object} apiConfig - API configuration
   * @param {string} symbol - Trading pair symbol
   * @param {number|string} orderId - Order ID
   * @returns {Promise<Object>} - Cancellation result
   */
  cancelOrder: (apiConfig, symbol, orderId) => {
    return signedPostRequest('/api/v3/order', { symbol, orderId }, apiConfig);
  },
  
  /**
   * Create a market buy order
   * @param {Object} apiConfig - API configuration
   * @param {string} symbol - Trading pair symbol
   * @param {string|number} quantity - Order quantity
   * @returns {Promise<Object>} - Order result
   */
  marketBuy: (apiConfig, symbol, quantity) => {
    return BinanceApi.createOrder(apiConfig, {
      symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity
    });
  },
  
  /**
   * Create a market sell order
   * @param {Object} apiConfig - API configuration
   * @param {string} symbol - Trading pair symbol
   * @param {string|number} quantity - Order quantity
   * @returns {Promise<Object>} - Order result
   */
  marketSell: (apiConfig, symbol, quantity) => {
    return BinanceApi.createOrder(apiConfig, {
      symbol,
      side: 'SELL',
      type: 'MARKET',
      quantity
    });
  },
  
  /**
   * Create a limit buy order
   * @param {Object} apiConfig - API configuration
   * @param {string} symbol - Trading pair symbol
   * @param {string|number} quantity - Order quantity
   * @param {string|number} price - Order price
   * @returns {Promise<Object>} - Order result
   */
  limitBuy: (apiConfig, symbol, quantity, price) => {
    return BinanceApi.createOrder(apiConfig, {
      symbol,
      side: 'BUY',
      type: 'LIMIT',
      timeInForce: 'GTC',
      quantity,
      price
    });
  },
  
  /**
   * Create a limit sell order
   * @param {Object} apiConfig - API configuration
   * @param {string} symbol - Trading pair symbol
   * @param {string|number} quantity - Order quantity
   * @param {string|number} price - Order price
   * @returns {Promise<Object>} - Order result
   */
  limitSell: (apiConfig, symbol, quantity, price) => {
    return BinanceApi.createOrder(apiConfig, {
      symbol,
      side: 'SELL',
      type: 'LIMIT',
      timeInForce: 'GTC',
      quantity,
      price
    });
  }
};

export default BinanceApi;