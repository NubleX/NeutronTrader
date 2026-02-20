// NeutronTrader - Binance exchange adapter
// Wraps electron/binanceApi.js into the standard ExchangeAdapter interface.

const { ExchangeAdapter } = require('./exchangeAdapter');
const BinanceAPI = require('../binanceApi');

class BinanceAdapter extends ExchangeAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'binance';
    this.isTestnet = config.isTestnet !== false;
  }

  get baseUrl() {
    return this.isTestnet ? 'testnet.binance.vision' : 'api.binance.com';
  }

  // ===== MARKET DATA =====
  async ping() { return BinanceAPI.ping(); }

  async getCurrentPrice(symbol) {
    return BinanceAPI.getCurrentPrice(this.normalizeSymbol(symbol));
  }

  async getOrderBook(symbol, limit = 20) {
    return BinanceAPI.getOrderBook(this.normalizeSymbol(symbol), limit);
  }

  async getCandlesticks(symbol, interval, options = {}) {
    return BinanceAPI.getCandlesticks(this.normalizeSymbol(symbol), interval, options);
  }

  async get24hrTicker(symbol) {
    return BinanceAPI.get24hrTicker(this.normalizeSymbol(symbol));
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
    const raw = await BinanceAPI.getListedSymbols();
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

  // WebSocket stubs — full implementation via wsManager in main.js
  async subscribeToTicker(symbol, callback) { return null; }
  async subscribeToOrderBook(symbol, callback) { return null; }
  async subscribeToTrades(symbol, callback) { return null; }
  async unsubscribe(subscriptionId) { return null; }
}

module.exports = { BinanceAdapter };
