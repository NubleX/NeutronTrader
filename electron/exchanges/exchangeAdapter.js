// NeutronTrader - Abstract exchange adapter interface
// All exchange adapters must implement this interface.

class ExchangeAdapter {
  constructor(config = {}) {
    this.name = 'base';
    this.isTestnet = config.isTestnet !== false; // default testnet
    this.apiConfig = config;
  }

  // ===== MARKET DATA =====
  async ping() { throw new Error(`${this.name}: ping() not implemented`); }
  async getCurrentPrice(symbol) { throw new Error(`${this.name}: getCurrentPrice() not implemented`); }
  async getOrderBook(symbol, limit) { throw new Error(`${this.name}: getOrderBook() not implemented`); }
  async getCandlesticks(symbol, interval, options) { throw new Error(`${this.name}: getCandlesticks() not implemented`); }
  async get24hrTicker(symbol) { throw new Error(`${this.name}: get24hrTicker() not implemented`); }

  // ===== ACCOUNT =====
  async getAccountInfo() { throw new Error(`${this.name}: getAccountInfo() not implemented`); }
  async getBalance(asset) { throw new Error(`${this.name}: getBalance() not implemented`); }

  // ===== ORDERS =====
  async createMarketOrder(symbol, side, quantity) { throw new Error(`${this.name}: createMarketOrder() not implemented`); }
  async createLimitOrder(symbol, side, quantity, price, timeInForce) { throw new Error(`${this.name}: createLimitOrder() not implemented`); }
  async createStopLoss(symbol, side, quantity, price, stopPrice) { throw new Error(`${this.name}: createStopLoss() not implemented`); }
  async cancelOrder(symbol, orderId) { throw new Error(`${this.name}: cancelOrder() not implemented`); }
  async getOrderStatus(symbol, orderId) { throw new Error(`${this.name}: getOrderStatus() not implemented`); }

  // ===== TRADES =====
  async getMyTrades(symbol, options) { throw new Error(`${this.name}: getMyTrades() not implemented`); }

  // ===== SYMBOLS =====
  async getListedSymbols() { throw new Error(`${this.name}: getListedSymbols() not implemented`); }
  normalizeSymbol(universal) { throw new Error(`${this.name}: normalizeSymbol() not implemented`); }
  denormalizeSymbol(exchangeSymbol) { throw new Error(`${this.name}: denormalizeSymbol() not implemented`); }

  // ===== WEBSOCKET =====
  async subscribeToTicker(symbol, callback) { throw new Error(`${this.name}: subscribeToTicker() not implemented`); }
  async subscribeToOrderBook(symbol, callback) { throw new Error(`${this.name}: subscribeToOrderBook() not implemented`); }
  async subscribeToTrades(symbol, callback) { throw new Error(`${this.name}: subscribeToTrades() not implemented`); }
  async unsubscribe(subscriptionId) { throw new Error(`${this.name}: unsubscribe() not implemented`); }

  get baseUrl() { throw new Error(`${this.name}: baseUrl getter not implemented`); }
}

module.exports = { ExchangeAdapter };
