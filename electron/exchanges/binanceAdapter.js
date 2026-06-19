// NeutronTrader - Binance exchange adapter
// Wraps electron/binanceApi.js into the standard ExchangeAdapter interface.

const { ExchangeAdapter } = require('./exchangeAdapter');
const BinanceAPI = require('../binanceApi');

class BinanceAdapter extends ExchangeAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'binance';
    this.isTestnet = config.isTestnet === true || config.testnet === true;
    this.apiConfig = {
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      isTestnet: this.isTestnet,
    };
  }

  _opts(extra = {}) {
    return { isTestnet: this.isTestnet, ...extra };
  }

  get baseUrl() {
    return this.isTestnet ? 'testnet.binance.vision' : 'api.binance.com';
  }

  // ===== MARKET DATA =====
  async ping() { return BinanceAPI.ping(this._opts()); }

  async getCurrentPrice(symbol) {
    return BinanceAPI.getCurrentPrice(this.normalizeSymbol(symbol), this._opts());
  }

  async getOrderBook(symbol, limit = 20) {
    return BinanceAPI.getOrderBook(this.normalizeSymbol(symbol), limit, this._opts());
  }

  async getCandlesticks(symbol, interval, options = {}) {
    return BinanceAPI.getCandlesticks(
      this.normalizeSymbol(symbol),
      interval,
      this._opts(options)
    );
  }

  async get24hrTicker(symbol) {
    return BinanceAPI.get24hrTicker(this.normalizeSymbol(symbol), this._opts());
  }

  // ===== ACCOUNT =====
  async getAccountInfo() {
    return BinanceAPI.getAccountInfo(this.apiConfig);
  }

  async getBalance(asset) {
    const info = await this.getAccountInfo();
    const bal = info.balances.find(b => b.asset === asset.toUpperCase());
    return bal || { asset: asset.toUpperCase(), free: 0, locked: 0 };
  }

  // ===== ORDERS =====
  async createMarketOrder(symbol, side, quantity) {
    return BinanceAPI.createMarketOrder(this.apiConfig, this.normalizeSymbol(symbol), side, quantity);
  }

  async createLimitOrder(symbol, side, quantity, price, timeInForce = 'GTC') {
    return BinanceAPI.createLimitOrder(this.apiConfig, this.normalizeSymbol(symbol), side, quantity, price, timeInForce);
  }

  async createStopLoss(symbol, side, quantity, price, stopPrice) {
    return BinanceAPI.createStopLossLimitOrder(this.apiConfig, this.normalizeSymbol(symbol), side, quantity, price, stopPrice);
  }

  async cancelOrder(symbol, orderId) {
    return BinanceAPI.cancelOrder(this.apiConfig, this.normalizeSymbol(symbol), orderId);
  }

  async getOrderStatus(symbol, orderId) {
    return BinanceAPI.getOrderStatus(this.apiConfig, this.normalizeSymbol(symbol), orderId);
  }

  // ===== TRADES =====
  async getMyTrades(symbol, options = {}) {
    return BinanceAPI.getMyTrades(this.apiConfig, this.normalizeSymbol(symbol), options);
  }

  // ===== SYMBOLS =====
  async getListedSymbols() {
    const raw = await BinanceAPI.getListedSymbols(this._opts());
    return raw.map(s => this.denormalizeSymbol(s));
  }

  /** 'BTC/USDT' -> 'BTCUSDT' */
  normalizeSymbol(universal) {
    return universal.replace('/', '').toUpperCase();
  }

  /** 'BTCUSDT' -> 'BTC/USDT' — best-effort 4-letter quote detection */
  denormalizeSymbol(exchangeSymbol) {
    const quotes = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB', 'USDC'];
    for (const q of quotes) {
      if (exchangeSymbol.endsWith(q)) {
        return `${exchangeSymbol.slice(0, -q.length)}/${q}`;
      }
    }
    return exchangeSymbol;
  }

  async subscribeToTicker(symbol, callback) {
    const WebSocket = require('ws');
    const stream = `${this.normalizeSymbol(symbol).toLowerCase()}@ticker`;
    const host = this.isTestnet
      ? 'wss://testnet.binance.vision/ws'
      : 'wss://stream.binance.com:9443/ws';
    const ws = new WebSocket(`${host}/${stream}`);
    const id = `binance_ticker_${stream}_${Date.now()}`;
    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        callback({
          symbol,
          price: parseFloat(data.c),
          bid: parseFloat(data.b),
          ask: parseFloat(data.a),
          timestamp: Date.now(),
        });
      } catch { /* ignore */ }
    });
    ws.on('error', () => {});
    this._tickerSubs = this._tickerSubs || new Map();
    this._tickerSubs.set(id, ws);
    return id;
  }

  async unsubscribe(subscriptionId) {
    if (this._tickerSubs?.has(subscriptionId)) {
      this._tickerSubs.get(subscriptionId).close();
      this._tickerSubs.delete(subscriptionId);
    }
    return true;
  }

  async subscribeToOrderBook(symbol, callback) { return null; }
  async subscribeToTrades(symbol, callback) { return null; }
}

module.exports = { BinanceAdapter };
