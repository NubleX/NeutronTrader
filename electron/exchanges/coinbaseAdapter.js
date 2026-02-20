// NeutronTrader - Coinbase Advanced Trade adapter
// Auth: JWT (ES256) — requires apiKey (key name) + apiSecret (EC private key PEM)

const { ExchangeAdapter } = require('./exchangeAdapter');
const https = require('https');
const crypto = require('crypto');

const REST_HOST_PROD = 'api.coinbase.com';
const REST_HOST_SAND = 'api.coinbase.com'; // Coinbase sandbox uses same host, different credentials

class CoinbaseAdapter extends ExchangeAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'coinbase';
    this.isTestnet = config.isTestnet === true;
  }

  get baseUrl() {
    return REST_HOST_PROD;
  }

  // Build JWT for Coinbase Advanced Trade
  _buildJWT(method, path) {
    if (!this.apiConfig.apiKey || !this.apiConfig.apiSecret) {
      throw new Error('Coinbase: apiKey and apiSecret required');
    }
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: this.apiConfig.apiKey })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: this.apiConfig.apiKey,
      iss: 'coinbase-cloud',
      nbf: now,
      exp: now + 120,
      uri: `${method} ${this.baseUrl}${path}`
    })).toString('base64url');

    const signingInput = `${header}.${payload}`;
    const sign = crypto.createSign('SHA256');
    sign.update(signingInput);
    const sig = sign.sign(this.apiConfig.apiSecret, 'base64url');
    return `${signingInput}.${sig}`;
  }

  async _request(method, path, params = null, auth = false) {
    return new Promise((resolve, reject) => {
      let fullPath = `/api/v3/brokerage${path}`;
      if (params && method === 'GET') {
        const qs = new URLSearchParams(params).toString();
        fullPath += `?${qs}`;
      }

      const headers = { 'Content-Type': 'application/json' };
      if (auth) {
        headers['Authorization'] = `Bearer ${this._buildJWT(method, fullPath)}`;
      }

      const body = (method !== 'GET' && params) ? JSON.stringify(params) : null;
      if (body) headers['Content-Length'] = Buffer.byteLength(body);

      const req = https.request({ hostname: this.baseUrl, path: fullPath, method, headers, timeout: 10000 }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
            else reject(new Error(json.message || `HTTP ${res.statusCode}`));
          } catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
        });
      });
      req.on('error', e => reject(e));
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      if (body) req.write(body);
      req.end();
    });
  }

  async ping() {
    try {
      await this._request('GET', '/products', null, false);
      return { status: 'connected', exchange: 'coinbase' };
    } catch (e) {
      throw new Error(`Coinbase ping failed: ${e.message}`);
    }
  }

  async getCurrentPrice(symbol) {
    const productId = this.normalizeSymbol(symbol);
    const data = await this._request('GET', `/best_bid_ask`, { product_ids: productId }, false);
    const p = data.pricebooks?.[0];
    if (!p) throw new Error(`No price data for ${symbol}`);
    const mid = (parseFloat(p.bids?.[0]?.price || 0) + parseFloat(p.asks?.[0]?.price || 0)) / 2;
    return { symbol, price: mid, timestamp: new Date().toISOString() };
  }

  async getOrderBook(symbol, limit = 20) {
    const productId = this.normalizeSymbol(symbol);
    return this._request('GET', `/product_book`, { product_id: productId, limit }, false);
  }

  async getCandlesticks(symbol, interval, options = {}) {
    const productId = this.normalizeSymbol(symbol);
    const granularity = this._intervalToGranularity(interval);
    const end = Math.floor(Date.now() / 1000);
    const start = end - granularity * (options.limit || 300);
    const data = await this._request('GET', `/products/${productId}/candles`, { start, end, granularity }, false);
    return (data.candles || []).map(c => ({
      openTime: c.start * 1000,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume),
      closeTime: (c.start + granularity) * 1000
    }));
  }

  async get24hrTicker(symbol) {
    const productId = this.normalizeSymbol(symbol);
    return this._request('GET', `/products/${productId}`, null, false);
  }

  async getAccountInfo() {
    return this._request('GET', '/accounts', null, true);
  }

  async getBalance(asset) {
    const accounts = await this.getAccountInfo();
    const acc = (accounts.accounts || []).find(a => a.currency === asset.toUpperCase());
    return acc ? { asset: acc.currency, free: parseFloat(acc.available_balance?.value || 0), locked: 0 } : { asset, free: 0, locked: 0 };
  }

  async createMarketOrder(symbol, side, quantity) {
    const body = {
      client_order_id: `nt_${Date.now()}`,
      product_id: this.normalizeSymbol(symbol),
      side: side.toUpperCase(),
      order_configuration: { market_market_ioc: { base_size: String(quantity) } }
    };
    return this._request('POST', '/orders', body, true);
  }

  async createLimitOrder(symbol, side, quantity, price, timeInForce = 'GTC') {
    const body = {
      client_order_id: `nt_${Date.now()}`,
      product_id: this.normalizeSymbol(symbol),
      side: side.toUpperCase(),
      order_configuration: {
        limit_limit_gtc: { base_size: String(quantity), limit_price: String(price) }
      }
    };
    return this._request('POST', '/orders', body, true);
  }

  async createStopLoss(symbol, side, quantity, price, stopPrice) {
    const body = {
      client_order_id: `nt_${Date.now()}`,
      product_id: this.normalizeSymbol(symbol),
      side: side.toUpperCase(),
      order_configuration: {
        stop_limit_stop_limit_gtc: {
          base_size: String(quantity),
          limit_price: String(price),
          stop_price: String(stopPrice),
          stop_direction: side.toUpperCase() === 'BUY' ? 'STOP_DIRECTION_STOP_UP' : 'STOP_DIRECTION_STOP_DOWN'
        }
      }
    };
    return this._request('POST', '/orders', body, true);
  }

  async cancelOrder(symbol, orderId) {
    return this._request('POST', '/orders/batch_cancel', { order_ids: [orderId] }, true);
  }

  async getOrderStatus(symbol, orderId) {
    return this._request('GET', `/orders/historical/${orderId}`, null, true);
  }

  async getMyTrades(symbol, options = {}) {
    const productId = this.normalizeSymbol(symbol);
    return this._request('GET', '/orders/historical/fills', { product_id: productId }, true);
  }

  async getListedSymbols() {
    const data = await this._request('GET', '/products', null, false);
    return (data.products || []).map(p => this.denormalizeSymbol(p.product_id));
  }

  /** 'BTC/USDT' -> 'BTC-USDT' */
  normalizeSymbol(universal) {
    return universal.replace('/', '-').toUpperCase();
  }

  /** 'BTC-USDT' -> 'BTC/USDT' */
  denormalizeSymbol(exchangeSymbol) {
    return exchangeSymbol.replace('-', '/');
  }

  _intervalToGranularity(interval) {
    const map = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '6h': 21600, '1d': 86400 };
    return map[interval] || 900;
  }

  async subscribeToTicker(symbol, callback) { return null; }
  async subscribeToOrderBook(symbol, callback) { return null; }
  async subscribeToTrades(symbol, callback) { return null; }
  async unsubscribe(subscriptionId) { return null; }
}

module.exports = { CoinbaseAdapter };
