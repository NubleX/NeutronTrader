// NeutronTrader - Kraken exchange adapter
// Auth: HMAC-SHA512 + nonce (REST v0)

const { ExchangeAdapter } = require('./exchangeAdapter');
const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

const REST_HOST = 'api.kraken.com';

class KrakenAdapter extends ExchangeAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'kraken';
    this.isTestnet = false; // Kraken has no public testnet
  }

  get baseUrl() { return REST_HOST; }

  _sign(path, nonce, postData) {
    const message = nonce + postData;
    const secret = Buffer.from(this.apiConfig.apiSecret, 'base64');
    const hash = crypto.createHash('sha256').update(nonce + postData).digest();
    const hmac = crypto.createHmac('sha512', secret).update(Buffer.concat([Buffer.from(path), hash])).digest('base64');
    return hmac;
  }

  async _request(path, params = null, auth = false) {
    return new Promise((resolve, reject) => {
      const isPublic = !auth;
      const fullPath = `/0/${isPublic ? 'public' : 'private'}${path}`;
      let postData = '';

      const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

      if (auth) {
        const nonce = String(Date.now() * 1000);
        const body = { nonce, ...params };
        postData = querystring.stringify(body);
        headers['API-Key'] = this.apiConfig.apiKey;
        headers['API-Sign'] = this._sign(fullPath, nonce, postData);
      } else if (params) {
        postData = querystring.stringify(params);
      }

      const options = {
        hostname: REST_HOST,
        path: fullPath,
        method: auth || params ? 'POST' : 'GET',
        headers,
        timeout: 10000
      };

      const req = https.request(options, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error && json.error.length > 0) reject(new Error(json.error[0]));
            else resolve(json.result);
          } catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
        });
      });
      req.on('error', e => reject(e));
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      if (postData) req.write(postData);
      req.end();
    });
  }

  async ping() {
    await this._request('/SystemStatus');
    return { status: 'connected', exchange: 'kraken' };
  }

  async getCurrentPrice(symbol) {
    const pair = this.normalizeSymbol(symbol);
    const data = await this._request('/Ticker', { pair });
    const key = Object.keys(data)[0];
    return { symbol, price: parseFloat(data[key].c[0]), timestamp: new Date().toISOString() };
  }

  async getOrderBook(symbol, limit = 20) {
    const pair = this.normalizeSymbol(symbol);
    return this._request('/Depth', { pair, count: limit });
  }

  async getCandlesticks(symbol, interval, options = {}) {
    const pair = this.normalizeSymbol(symbol);
    const minutes = this._intervalToMinutes(interval);
    const data = await this._request('/OHLC', { pair, interval: minutes });
    const key = Object.keys(data).find(k => k !== 'last');
    return (data[key] || []).map(c => ({
      openTime: c[0] * 1000,
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[6]),
      closeTime: (c[0] + minutes * 60) * 1000
    }));
  }

  async get24hrTicker(symbol) {
    const pair = this.normalizeSymbol(symbol);
    return this._request('/Ticker', { pair });
  }

  async getAccountInfo() {
    return this._request('/Balance', {}, true);
  }

  async getBalance(asset) {
    const balances = await this.getAccountInfo();
    const krakenAsset = asset === 'BTC' ? 'XXBT' : asset;
    const val = balances[krakenAsset] || balances[asset] || '0';
    return { asset, free: parseFloat(val), locked: 0 };
  }

  async createMarketOrder(symbol, side, quantity) {
    return this._request('/AddOrder', {
      pair: this.normalizeSymbol(symbol),
      type: side.toLowerCase(),
      ordertype: 'market',
      volume: String(quantity)
    }, true);
  }

  async createLimitOrder(symbol, side, quantity, price) {
    return this._request('/AddOrder', {
      pair: this.normalizeSymbol(symbol),
      type: side.toLowerCase(),
      ordertype: 'limit',
      price: String(price),
      volume: String(quantity)
    }, true);
  }

  async createStopLoss(symbol, side, quantity, price, stopPrice) {
    return this._request('/AddOrder', {
      pair: this.normalizeSymbol(symbol),
      type: side.toLowerCase(),
      ordertype: 'stop-loss-limit',
      price: String(stopPrice),
      price2: String(price),
      volume: String(quantity)
    }, true);
  }

  async cancelOrder(symbol, orderId) {
    return this._request('/CancelOrder', { txid: orderId }, true);
  }

  async getOrderStatus(symbol, orderId) {
    return this._request('/QueryOrders', { txid: orderId, trades: true }, true);
  }

  async getMyTrades(symbol, options = {}) {
    return this._request('/TradesHistory', {}, true);
  }

  async getListedSymbols() {
    const data = await this._request('/AssetPairs');
    return Object.keys(data).map(k => this.denormalizeSymbol(k));
  }

  /** 'BTC/USDT' -> 'XBTUSDT' */
  normalizeSymbol(universal) {
    const map = { 'BTC': 'XBT', 'DOGE': 'XDG' };
    const [base, quote] = universal.split('/');
    const kb = map[base] || base;
    return `X${kb}Z${quote}`;
  }

  /** 'XXBTZUSDT' -> 'BTC/USDT' */
  denormalizeSymbol(exchangeSymbol) {
    const map = { 'XBT': 'BTC', 'XDG': 'DOGE' };
    // Strip leading X and trailing Z sections
    const cleaned = exchangeSymbol.replace(/^X/, '').replace(/Z(\w+)$/, '/$1');
    const [base, quote] = cleaned.split('/');
    return `${map[base] || base}/${quote || ''}`;
  }

  _intervalToMinutes(interval) {
    const map = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440 };
    return map[interval] || 15;
  }

  async subscribeToTicker(symbol, callback) { return null; }
  async subscribeToOrderBook(symbol, callback) { return null; }
  async subscribeToTrades(symbol, callback) { return null; }
  async unsubscribe(subscriptionId) { return null; }
}

module.exports = { KrakenAdapter };
