// NeutronTrader - Bybit exchange adapter (v5 API)
// Auth: HMAC-SHA256

const { ExchangeAdapter } = require('./exchangeAdapter');
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

const REST_HOST_PROD = 'api.bybit.com';
const REST_HOST_TEST = 'api-testnet.bybit.com';

class BybitAdapter extends ExchangeAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'bybit';
    this.isTestnet = config.isTestnet !== false;
  }

  get baseUrl() {
    return this.isTestnet ? REST_HOST_TEST : REST_HOST_PROD;
  }

  _sign(timestamp, params = '') {
    const recvWindow = 5000;
    const preSign = `${timestamp}${this.apiConfig.apiKey}${recvWindow}${params}`;
    return crypto.createHmac('sha256', this.apiConfig.apiSecret).update(preSign).digest('hex');
  }

  async _request(method, path, params = null, auth = false) {
    return new Promise((resolve, reject) => {
      let fullPath = `/v5${path}`;
      let body = '';
      let queryStr = '';

      if (params && method === 'GET') {
        queryStr = querystring.stringify(params);
        fullPath += `?${queryStr}`;
      } else if (params) {
        body = JSON.stringify(params);
        queryStr = body;
      }

      const headers = { 'Content-Type': 'application/json' };

      if (auth) {
        const timestamp = String(Date.now());
        const recvWindow = '5000';
        headers['X-BAPI-API-KEY'] = this.apiConfig.apiKey;
        headers['X-BAPI-SIGN'] = this._sign(timestamp, queryStr);
        headers['X-BAPI-TIMESTAMP'] = timestamp;
        headers['X-BAPI-RECV-WINDOW'] = recvWindow;
      }

      const req = https.request({ hostname: this.baseUrl, path: fullPath, method, headers, timeout: 10000 }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.retCode !== 0) reject(new Error(json.retMsg || `Bybit error ${json.retCode}`));
            else resolve(json.result);
          } catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
        });
      });
      req.on('error', e => reject(e));
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      if (body) req.write(body);
      req.end();
    });
  }

  async ping() {
    await this._request('GET', '/market/time');
    return { status: 'connected', exchange: 'bybit' };
  }

  async getCurrentPrice(symbol) {
    const sym = this.normalizeSymbol(symbol);
    const data = await this._request('GET', '/market/tickers', { category: 'spot', symbol: sym });
    const t = data.list?.[0];
    if (!t) throw new Error(`No ticker for ${symbol}`);
    return { symbol, price: parseFloat(t.lastPrice), bid: parseFloat(t.bid1Price), ask: parseFloat(t.ask1Price), timestamp: new Date().toISOString() };
  }

  async getOrderBook(symbol, limit = 20) {
    return this._request('GET', '/market/orderbook', { category: 'spot', symbol: this.normalizeSymbol(symbol), limit });
  }

  async getCandlesticks(symbol, interval, options = {}) {
    const sym = this.normalizeSymbol(symbol);
    const intervalStr = this._intervalToBybit(interval);
    const data = await this._request('GET', '/market/kline', { category: 'spot', symbol: sym, interval: intervalStr, limit: options.limit || 200 });
    return (data.list || []).reverse().map(c => ({
      openTime: parseInt(c[0]),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
      closeTime: parseInt(c[0]) + this._intervalToMs(interval)
    }));
  }

  async get24hrTicker(symbol) {
    return this._request('GET', '/market/tickers', { category: 'spot', symbol: this.normalizeSymbol(symbol) });
  }

  async getAccountInfo() {
    return this._request('GET', '/account/wallet-balance', { accountType: 'SPOT' }, true);
  }

  async getBalance(asset) {
    const data = await this.getAccountInfo();
    const coins = data.list?.[0]?.coin || [];
    const coin = coins.find(c => c.coin === asset.toUpperCase());
    return coin ? { asset, free: parseFloat(coin.availableToWithdraw), locked: parseFloat(coin.locked) } : { asset, free: 0, locked: 0 };
  }

  async createMarketOrder(symbol, side, quantity) {
    return this._request('POST', '/order/create', {
      category: 'spot',
      symbol: this.normalizeSymbol(symbol),
      side: side === 'BUY' ? 'Buy' : 'Sell',
      orderType: 'Market',
      qty: String(quantity)
    }, true);
  }

  async createLimitOrder(symbol, side, quantity, price) {
    return this._request('POST', '/order/create', {
      category: 'spot',
      symbol: this.normalizeSymbol(symbol),
      side: side === 'BUY' ? 'Buy' : 'Sell',
      orderType: 'Limit',
      qty: String(quantity),
      price: String(price),
      timeInForce: 'GTC'
    }, true);
  }

  async createStopLoss(symbol, side, quantity, price, stopPrice) {
    return this._request('POST', '/order/create', {
      category: 'spot',
      symbol: this.normalizeSymbol(symbol),
      side: side === 'BUY' ? 'Buy' : 'Sell',
      orderType: 'Limit',
      qty: String(quantity),
      price: String(price),
      triggerPrice: String(stopPrice),
      orderFilter: 'StopOrder'
    }, true);
  }

  async cancelOrder(symbol, orderId) {
    return this._request('POST', '/order/cancel', {
      category: 'spot',
      symbol: this.normalizeSymbol(symbol),
      orderId
    }, true);
  }

  async getOrderStatus(symbol, orderId) {
    return this._request('GET', '/order/realtime', { category: 'spot', symbol: this.normalizeSymbol(symbol), orderId }, true);
  }

  async getMyTrades(symbol, options = {}) {
    return this._request('GET', '/execution/list', { category: 'spot', symbol: this.normalizeSymbol(symbol) }, true);
  }

  async getListedSymbols() {
    const data = await this._request('GET', '/market/instruments-info', { category: 'spot' });
    return (data.list || []).map(d => this.denormalizeSymbol(d.symbol));
  }

  /** 'BTC/USDT' -> 'BTCUSDT' */
  normalizeSymbol(universal) {
    return universal.replace('/', '').toUpperCase();
  }

  /** 'BTCUSDT' -> 'BTC/USDT' */
  denormalizeSymbol(exchangeSymbol) {
    const quotes = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB'];
    for (const q of quotes) {
      if (exchangeSymbol.endsWith(q)) return `${exchangeSymbol.slice(0, -q.length)}/${q}`;
    }
    return exchangeSymbol;
  }

  _intervalToBybit(interval) {
    const map = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D' };
    return map[interval] || '15';
  }

  _intervalToMs(interval) {
    const map = { '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000, '1h': 3600000, '4h': 14400000, '1d': 86400000 };
    return map[interval] || 900000;
  }

  async subscribeToTicker(symbol, callback) { return null; }
  async subscribeToOrderBook(symbol, callback) { return null; }
  async subscribeToTrades(symbol, callback) { return null; }
  async unsubscribe(subscriptionId) { return null; }
}

module.exports = { BybitAdapter };
