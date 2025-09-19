// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

// Base URL for Binance Testnet
const BASE_URL = 'testnet.binance.vision';

/**
 * Creates an HMAC SHA256 signature for Binance API requests
 */
function createSignature(queryString, apiSecret) {
  return crypto
    .createHmac('sha256', apiSecret)
    .update(queryString)
    .digest('hex');
}

/**
 * Make a request to the Binance API
 */
function makeRequest(path, method = 'GET', params = null, apiConfig = null) {
  return new Promise((resolve, reject) => {
    let queryString = '';
    let postData = '';

    // Add authorization if apiConfig is provided
    const headers = {};
    if (apiConfig && apiConfig.apiKey) {
      headers['X-MBX-APIKEY'] = apiConfig.apiKey;

      // For authenticated requests, add timestamp
      if (!params) params = {};
      params.timestamp = Date.now();

      // Create query string
      queryString = querystring.stringify(params);

      // Add signature if we have an API secret
      if (apiConfig.apiSecret) {
        const signature = createSignature(queryString, apiConfig.apiSecret);
        queryString += `&signature=${signature}`;
      }
    } else if (params) {
      // For non-authenticated requests, just create query string
      queryString = querystring.stringify(params);
    }

    // Create request options
    const options = {
      hostname: BASE_URL,
      path: `/api/v3${path}${queryString ? `?${queryString}` : ''}`,
      method,
      headers
    };

    console.log(`Making request to: ${options.hostname}${options.path}`);

    // Create and send the request
    const req = https.request(options, (res) => {
      let data = '';

      // A chunk of data has been received
      res.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } catch (error) {
            console.error('Error parsing JSON response:', error);
            reject(new Error('Invalid JSON response'));
          }
        } else {
          console.error(`API Request failed with status ${res.statusCode}`);
          try {
            const parsedError = JSON.parse(data);
            reject(parsedError);
          } catch (error) {
            reject(new Error(`Request failed with status ${res.statusCode}`));
          }
        }
      });
    });

    // Handle request errors
    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    // Send POST data if any
    if (method === 'POST' && postData) {
      req.write(postData);
    }

    // End the request
    req.end();
  });
}

// Binance API Functions
const BinanceApi = {
  // Test connectivity
  ping: () => {
    return makeRequest('/ping');
  },

  // Get server time
  time: () => {
    return makeRequest('/time');
  },

  // Get account information
  accountInfo: (apiConfig) => {
    return makeRequest('/account', 'GET', {}, apiConfig);
  },

  // Get current prices
  prices: (symbol = null) => {
    const params = symbol ? { symbol } : {};
    return makeRequest('/ticker/price', 'GET', params);
  },

  // Get candles (klines) data
  candles: (symbol, interval, options = {}) => {
    return makeRequest('/klines', 'GET', {
      symbol,
      interval,
      ...options
    });
  },

  // Get trade history
  myTrades: (apiConfig, symbol, options = {}) => {
    return makeRequest('/myTrades', 'GET', {
      symbol,
      ...options
    }, apiConfig);
  },

  // Create a market order
  marketOrder: (apiConfig, symbol, side, quantity) => {
    return makeRequest('/order', 'POST', {
      symbol,
      side,
      type: 'MARKET',
      quantity: quantity.toString()
    }, apiConfig);
  }
};

module.exports = BinanceApi;