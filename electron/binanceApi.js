// NeutronTrader - Complete Binance API module for Electron main process
// electron/binanceApi.js

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
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'NeutronTrader/2.0.0'
    };

    if (apiConfig && apiConfig.apiKey) {
      headers['X-MBX-APIKEY'] = apiConfig.apiKey;

      // For authenticated requests, add timestamp and recvWindow
      if (!params) params = {};
      params.timestamp = Date.now();
      params.recvWindow = 5000;

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
      method: method,
      headers: headers,
      timeout: 10000
    };

    console.log(`Making ${method} request to: https://${BASE_URL}${options.path}`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`API request successful: ${res.statusCode}`);
            resolve(jsonData);
          } else {
            console.error(`API request failed: ${res.statusCode}`, jsonData);
            const error = new Error(jsonData.msg || `API request failed with status ${res.statusCode}`);
            error.code = jsonData.code;
            error.status = res.statusCode;
            reject(error);
          }
        } catch (parseError) {
          console.error('Failed to parse API response:', parseError.message);
          console.error('Raw response:', data);
          reject(new Error(`Failed to parse API response: ${parseError.message}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error.message);
      reject(new Error(`Network error: ${error.message}`));
    });

    req.on('timeout', () => {
      console.error('Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    // Send the request
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// ===== PUBLIC ENDPOINTS (No authentication required) =====

/**
 * Test connectivity to the Binance API
 */
async function ping() {
  try {
    const result = await makeRequest('/ping');
    return { status: 'connected', timestamp: new Date().toISOString() };
  } catch (error) {
    throw new Error(`Ping failed: ${error.message}`);
  }
}

/**
 * Get server time
 */
async function getServerTime() {
  try {
    const result = await makeRequest('/time');
    return result;
  } catch (error) {
    throw new Error(`Failed to get server time: ${error.message}`);
  }
}

/**
 * Get current price for a symbol
 */
async function getCurrentPrice(symbol) {
  try {
    const result = await makeRequest('/ticker/price', 'GET', { symbol: symbol.toUpperCase() });
    return {
      symbol: result.symbol,
      price: parseFloat(result.price),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to get price for ${symbol}: ${error.message}`);
  }
}

/**
 * Get 24hr ticker statistics for a symbol
 */
async function get24hrTicker(symbol) {
  try {
    const result = await makeRequest('/ticker/24hr', 'GET', { symbol: symbol.toUpperCase() });
    return {
      symbol: result.symbol,
      priceChange: parseFloat(result.priceChange),
      priceChangePercent: parseFloat(result.priceChangePercent),
      weightedAvgPrice: parseFloat(result.weightedAvgPrice),
      prevClosePrice: parseFloat(result.prevClosePrice),
      lastPrice: parseFloat(result.lastPrice),
      bidPrice: parseFloat(result.bidPrice),
      askPrice: parseFloat(result.askPrice),
      openPrice: parseFloat(result.openPrice),
      highPrice: parseFloat(result.highPrice),
      lowPrice: parseFloat(result.lowPrice),
      volume: parseFloat(result.volume),
      quoteVolume: parseFloat(result.quoteVolume),
      openTime: new Date(result.openTime),
      closeTime: new Date(result.closeTime),
      count: result.count
    };
  } catch (error) {
    throw new Error(`Failed to get 24hr ticker for ${symbol}: ${error.message}`);
  }
}

/**
 * Get candlestick data for a symbol
 */
async function getCandlesticks(symbol, interval, options = {}) {
  try {
    const params = {
      symbol: symbol.toUpperCase(),
      interval: interval,
      limit: options.limit || 500
    };

    if (options.startTime) params.startTime = options.startTime;
    if (options.endTime) params.endTime = options.endTime;

    const result = await makeRequest('/klines', 'GET', params);

    return result.map(candle => ({
      openTime: parseInt(candle[0]),
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
      closeTime: parseInt(candle[6]),
      quoteAssetVolume: parseFloat(candle[7]),
      numberOfTrades: parseInt(candle[8]),
      takerBuyBaseAssetVolume: parseFloat(candle[9]),
      takerBuyQuoteAssetVolume: parseFloat(candle[10])
    }));
  } catch (error) {
    throw new Error(`Failed to get candlesticks for ${symbol}: ${error.message}`);
  }
}

// ===== PRIVATE ENDPOINTS (Authentication required) =====

/**
 * Get account information
 */
async function getAccountInfo(apiConfig) {
  try {
    if (!apiConfig || !apiConfig.apiKey || !apiConfig.apiSecret) {
      throw new Error('API key and secret are required');
    }

    const result = await makeRequest('/account', 'GET', {}, apiConfig);

    return {
      makerCommission: result.makerCommission,
      takerCommission: result.takerCommission,
      buyerCommission: result.buyerCommission,
      sellerCommission: result.sellerCommission,
      canTrade: result.canTrade,
      canWithdraw: result.canWithdraw,
      canDeposit: result.canDeposit,
      accountType: result.accountType,
      balances: result.balances.map(balance => ({
        asset: balance.asset,
        free: parseFloat(balance.free),
        locked: parseFloat(balance.locked)
      })).filter(balance => balance.free > 0 || balance.locked > 0),
      permissions: result.permissions
    };
  } catch (error) {
    throw new Error(`Failed to get account info: ${error.message}`);
  }
}

/**
 * Get trade history for a symbol
 */
async function getMyTrades(apiConfig, symbol, options = {}) {
  try {
    if (!apiConfig || !apiConfig.apiKey || !apiConfig.apiSecret) {
      throw new Error('API key and secret are required');
    }

    const params = {
      symbol: symbol.toUpperCase(),
      limit: options.limit || 500
    };

    if (options.orderId) params.orderId = options.orderId;
    if (options.startTime) params.startTime = options.startTime;
    if (options.endTime) params.endTime = options.endTime;
    if (options.fromId) params.fromId = options.fromId;

    const result = await makeRequest('/myTrades', 'GET', params, apiConfig);

    return result.map(trade => ({
      symbol: trade.symbol,
      id: trade.id,
      orderId: trade.orderId,
      orderListId: trade.orderListId,
      price: parseFloat(trade.price),
      qty: parseFloat(trade.qty),
      quoteQty: parseFloat(trade.quoteQty),
      commission: parseFloat(trade.commission),
      commissionAsset: trade.commissionAsset,
      time: new Date(trade.time),
      isBuyer: trade.isBuyer,
      isMaker: trade.isMaker,
      isBestMatch: trade.isBestMatch
    }));
  } catch (error) {
    throw new Error(`Failed to get trade history for ${symbol}: ${error.message}`);
  }
}

/**
 * Create a market order
 */
async function createMarketOrder(apiConfig, symbol, side, quantity) {
  try {
    if (!apiConfig || !apiConfig.apiKey || !apiConfig.apiSecret) {
      throw new Error('API key and secret are required');
    }

    const params = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: 'MARKET',
      quantity: parseFloat(quantity).toString()
    };

    const result = await makeRequest('/order', 'POST', params, apiConfig);

    return {
      symbol: result.symbol,
      orderId: result.orderId,
      orderListId: result.orderListId,
      clientOrderId: result.clientOrderId,
      transactTime: new Date(result.transactTime),
      price: parseFloat(result.price || 0),
      origQty: parseFloat(result.origQty),
      executedQty: parseFloat(result.executedQty),
      cummulativeQuoteQty: parseFloat(result.cummulativeQuoteQty),
      status: result.status,
      timeInForce: result.timeInForce,
      type: result.type,
      side: result.side,
      fills: result.fills ? result.fills.map(fill => ({
        price: parseFloat(fill.price),
        qty: parseFloat(fill.qty),
        commission: parseFloat(fill.commission),
        commissionAsset: fill.commissionAsset
      })) : []
    };
  } catch (error) {
    throw new Error(`Failed to create market order: ${error.message}`);
  }
}

/**
 * Get open orders for a symbol
 */
async function getOpenOrders(apiConfig, symbol = null) {
  try {
    if (!apiConfig || !apiConfig.apiKey || !apiConfig.apiSecret) {
      throw new Error('API key and secret are required');
    }

    const params = {};
    if (symbol) params.symbol = symbol.toUpperCase();

    const result = await makeRequest('/openOrders', 'GET', params, apiConfig);

    return result.map(order => ({
      symbol: order.symbol,
      orderId: order.orderId,
      orderListId: order.orderListId,
      clientOrderId: order.clientOrderId,
      price: parseFloat(order.price),
      origQty: parseFloat(order.origQty),
      executedQty: parseFloat(order.executedQty),
      cummulativeQuoteQty: parseFloat(order.cummulativeQuoteQty),
      status: order.status,
      timeInForce: order.timeInForce,
      type: order.type,
      side: order.side,
      stopPrice: parseFloat(order.stopPrice || 0),
      icebergQty: parseFloat(order.icebergQty || 0),
      time: new Date(order.time),
      updateTime: new Date(order.updateTime),
      isWorking: order.isWorking,
      origQuoteOrderQty: parseFloat(order.origQuoteOrderQty || 0)
    }));
  } catch (error) {
    throw new Error(`Failed to get open orders: ${error.message}`);
  }
}

// Export all functions
module.exports = {
  // Public endpoints
  ping,
  getServerTime,
  getCurrentPrice,
  get24hrTicker,
  getCandlesticks,

  // Private endpoints
  getAccountInfo,
  getMyTrades,
  createMarketOrder,
  getOpenOrders,

  // Utility
  createSignature,
  makeRequest
};