// NeutronTrader - OKX exchange adapter
// Auth: HMAC-SHA256 + passphrase

const { ExchangeAdapter } = require('./exchangeAdapter');
const https = require('https');
const crypto = require('crypto');

const REST_HOST_PROD = 'www.okx.com';
const REST_HOST_DEMO = 'www.okx.com'; // OKX demo uses header flag

class OKXAdapter extends ExchangeAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'okx';
    this.isTestnet = config.isTestnet === true;
  }

  get baseUrl() { return REST_HOST_PROD; }

  _sign(timestamp, method, path, body = '') {
    const msg = `${timestamp}${method}${path}${body}`;
    return crypto.createHmac('sha256', this.apiConfig.apiSecret).update(msg).digest('base64');
  }

  async _request(method, path, params = null, auth = false) {
    return new Promise((resolve, reject) => {
      let fullPath = `/api/v5${path}`;
      let body = '';

      if (params && method === 'GET') {
        const qs = new URLSearchParams(params).toString();
        fullPath += `?${qs}`;
      } else if (params) {
        body = JSON.stringify(params);
      }

      const headers = { 'Content-Type': 'application/json' };

      if (auth) {
        const ts = new Date().toISOString();
        headers['OK-ACCESS-KEY'] = this.apiConfig.apiKey;
        headers['OK-ACCESS-SIGN'] = this._sign(ts, method, fullPath, body);
        headers['OK-ACCESS-TIMESTAMP'] = ts;
        headers['OK-ACCESS-PASSPHRASE'] = this.apiConfig.passphrase || '';
        if (this.isTestnet) headers['x-simulated-trading'] = '1';
      }

      const req = https.request({ hostname: this.baseUrl, path: fullPath, method, headers, timeout: 10000 }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.code !== '0') reject(new Error(json.msg || `OKX error code ${json.code}`));
            else resolve(json.data);
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
    await this._request('GET', '/public/time');
    return { status: 'connected', exchange: 'okx' };
  }

  async getCurrentPrice(symbol) {
    const instId = this.normalizeSymbol(symbol);
    const data = await this._request('GET', '/market/ticker', { instId });
    const t = data[0];
    return { symbol, price: parseFloat(t.last), bid: parseFloat(t.bidPx), ask: parseFloat(t.askPx), timestamp: new Date().toISOString() };
  }

  async getOrderBook(symbol, limit = 20) {
    const instId = this.normalizeSymbol(symbol);
    return this._request('GET', '/market/books', { instId, sz: limit });
  }

  async getCandlesticks(symbol, interval, options = {}) {
    const instId = this.normalizeSymbol(symbol);
    const bar = this._intervalToBar(interval);
    const data = await this._request('GET', '/market/candles', { instId, bar, limit: options.limit || 300 });
    return data.map(c => ({
      openTime: parseInt(c[0]),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
      closeTime: parseInt(c[0]) + this._barToMs(bar)
    }));
  }

  async get24hrTicker(symbol) {
    const instId = this.normalizeSymbol(symbol);
    return this._request('GET', '/market/ticker', { instId });
  }

  async getAccountInfo() {
    return this._request('GET', '/account/balance', null, true);
  }

  async getBalance(asset) {
    const data = await this.getAccountInfo();
    const details = data[0]?.details || [];
    const bal = details.find(d => d.ccy === asset.toUpperCase());
    return bal ? { asset, free: parseFloat(bal.availBal), locked: parseFloat(bal.frozenBal) } : { asset, free: 0, locked: 0 };
  }

  async createMarketOrder(symbol, side, quantity) {
    return this._request('POST', '/trade/order', {
      instId: this.normalizeSymbol(symbol),
      tdMode: 'cash',
      side: side.toLowerCase(),
      ordType: 'market',
      sz: String(quantity)
    }, true);
  }

  async createLimitOrder(symbol, side, quantity, price) {
    return this._request('POST', '/trade/order', {
      instId: this.normalizeSymbol(symbol),
      tdMode: 'cash',
      side: side.toLowerCase(),
      ordType: 'limit',
      px: String(price),
      sz: String(quantity)
    }, true);
  }

  async createStopLoss(symbol, side, quantity, price, stopPrice) {
    return this._request('POST', '/trade/order-algo', {
      instId: this.normalizeSymbol(symbol),
      tdMode: 'cash',
      side: side.toLowerCase(),
      ordType: 'conditional',
      slTriggerPx: String(stopPrice),
      slOrdPx: String(price),
      sz: String(quantity)
    }, true);
  }

  async cancelOrder(symbol, orderId) {
    return this._request('POST', '/trade/cancel-order', {
      instId: this.normalizeSymbol(symbol),
      ordId: orderId
    }, true);
  }

  async getOrderStatus(symbol, orderId) {
    return this._request('GET', '/trade/order', { instId: this.normalizeSymbol(symbol), ordId: orderId }, true);
  }

  async getMyTrades(symbol, options = {}) {
    return this._request('GET', '/trade/fills', { instId: this.normalizeSymbol(symbol) }, true);
  }

  async getListedSymbols() {
    const data = await this._request('GET', '/public/instruments', { instType: 'SPOT' });
    return data.map(d => this.denormalizeSymbol(d.instId));
  }

  /** 'BTC/USDT' -> 'BTC-USDT' */
  normalizeSymbol(universal) {
    return universal.replace('/', '-').toUpperCase();
  }

  /** 'BTC-USDT' -> 'BTC/USDT' */
  denormalizeSymbol(exchangeSymbol) {
    return exchangeSymbol.replace('-', '/');
  }

  _intervalToBar(interval) {
    const map = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H', '1d': '1D' };
    return map[interval] || '15m';
  }

  _barToMs(bar) {
    const map = { '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000, '1H': 3600000, '4H': 14400000, '1D': 86400000 };
    return map[bar] || 900000;
  }

  async subscribeToTicker(symbol, callback) { return null; }
  async subscribeToOrderBook(symbol, callback) { return null; }
  async subscribeToTrades(symbol, callback) { return null; }
  async unsubscribe(subscriptionId) { return null; }
}

module.exports = { OKXAdapter };
