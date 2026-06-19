// NeutronTrader - WebSocket price feed for Binance and Bybit

const WebSocket = require('ws');
const EventEmitter = require('events');

const EXCHANGE_FEES = {
  binance: { taker: 0.001 },
  bybit: { taker: 0.001 },
};

class WebSocketPriceFeed extends EventEmitter {
  constructor(options = {}) {
    super();
    this.minProfitPct = options.minProfitPct || 0.3;
    this.priceCache = new Map();
    this._connections = new Map();
    this._symbols = [];
    this._running = false;
    this._lastUpdateAt = null;
  }

  start(symbols = []) {
    if (this._running) return;
    this._running = true;
    this._symbols = symbols;
    this._connectBinance(symbols);
    this._connectBybit(symbols);
    console.log('[WSPriceFeed] Started for', symbols.join(', '));
  }

  stop() {
    this._running = false;
    for (const [, ws] of this._connections) {
      try { ws.close(); } catch { /* ignore */ }
    }
    this._connections.clear();
    console.log('[WSPriceFeed] Stopped');
  }

  _connectBinance(symbols) {
    const streams = symbols.map(s => `${s.replace('/', '').toLowerCase()}@ticker`).join('/');
    const url = streams.includes('/')
      ? `wss://stream.binance.com:9443/stream?streams=${streams}`
      : `wss://stream.binance.com:9443/ws/${streams}`;

    const ws = new WebSocket(url);
    this._connections.set('binance', ws);

    ws.on('open', () => console.log('[WSPriceFeed] Binance connected'));
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const data = msg.data || msg;
        if (!data.s) return;
        const symbol = this._binanceToUniversal(data.s);
        const price = parseFloat(data.c);
        const bid = parseFloat(data.b);
        const ask = parseFloat(data.a);
        this._updatePrice(symbol, 'binance', price, bid, ask);
      } catch { /* ignore parse errors */ }
    });
    ws.on('close', () => {
      if (this._running) setTimeout(() => this._connectBinance(this._symbols), 5000);
    });
    ws.on('error', (err) => console.warn('[WSPriceFeed] Binance error:', err.message));
  }

  _connectBybit(symbols) {
    const ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');
    this._connections.set('bybit', ws);

    ws.on('open', () => {
      console.log('[WSPriceFeed] Bybit connected');
      const args = symbols.map(s => `tickers.${s.replace('/', '')}`);
      ws.send(JSON.stringify({ op: 'subscribe', args }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.topic?.startsWith('tickers.') && msg.data) {
          const data = msg.data;
          const symbol = this._bybitToUniversal(data.symbol);
          const price = parseFloat(data.lastPrice);
          const bid = parseFloat(data.bid1Price || data.lastPrice);
          const ask = parseFloat(data.ask1Price || data.lastPrice);
          this._updatePrice(symbol, 'bybit', price, bid, ask);
        }
      } catch { /* ignore */ }
    });
    ws.on('close', () => {
      if (this._running) setTimeout(() => this._connectBybit(this._symbols), 5000);
    });
    ws.on('error', (err) => console.warn('[WSPriceFeed] Bybit error:', err.message));
  }

  _binanceToUniversal(s) {
    const quotes = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB', 'USDC'];
    for (const q of quotes) {
      if (s.endsWith(q)) return `${s.slice(0, -q.length)}/${q}`;
    }
    return s;
  }

  _bybitToUniversal(s) {
    const quotes = ['USDT', 'USDC', 'BTC', 'ETH'];
    for (const q of quotes) {
      if (s.endsWith(q)) return `${s.slice(0, -q.length)}/${q}`;
    }
    return s;
  }

  _updatePrice(symbol, exchange, price, bid, ask) {
    const key = `${symbol}:${exchange}`;
    const entry = { price, bid, ask, timestamp: Date.now() };
    this.priceCache.set(key, entry);
    this._lastUpdateAt = Date.now();
    this.emit('price-update', { symbol, exchange, ...entry });
    this._detectArbitrage(symbol);
  }

  _detectArbitrage(symbol) {
    const prices = [];
    for (const [key, data] of this.priceCache.entries()) {
      const colon = key.lastIndexOf(':');
      if (key.slice(0, colon) !== symbol) continue;
      if (Date.now() - data.timestamp > 120000) continue;
      prices.push({ exchange: key.slice(colon + 1), ...data });
    }
    if (prices.length < 2) return;

    const bestBid = prices.reduce((a, b) => b.bid > a.bid ? b : a);
    const bestAsk = prices.reduce((a, b) => b.ask < a.ask ? b : a);
    if (bestBid.exchange === bestAsk.exchange) return;

    const buyFee = EXCHANGE_FEES[bestAsk.exchange]?.taker || 0.001;
    const sellFee = EXCHANGE_FEES[bestBid.exchange]?.taker || 0.001;
    const grossSpread = (bestBid.bid - bestAsk.ask) / bestAsk.ask;
    const netPct = (grossSpread - buyFee - sellFee) * 100;

    if (netPct >= this.minProfitPct) {
      this.emit('arbitrage-opportunity', {
        symbol,
        buyExchange: bestAsk.exchange,
        buyPrice: bestAsk.ask,
        sellExchange: bestBid.exchange,
        sellPrice: bestBid.bid,
        grossSpreadPct: (grossSpread * 100).toFixed(4),
        netProfitPct: netPct.toFixed(4),
        fees: { buy: buyFee, sell: sellFee },
        timestamp: Date.now(),
      });
    }
  }

  getPriceSnapshot() {
    const snapshot = {};
    for (const [key, data] of this.priceCache.entries()) snapshot[key] = data;
    return snapshot;
  }

  getPricesForSymbol(symbol) {
    const result = [];
    for (const [key, data] of this.priceCache.entries()) {
      const colon = key.lastIndexOf(':');
      if (key.slice(0, colon) === symbol) {
        result.push({ exchange: key.slice(colon + 1), ...data });
      }
    }
    return result;
  }

  getLatencyMs() {
    return this._lastUpdateAt ? Date.now() - this._lastUpdateAt : null;
  }
}

module.exports = { WebSocketPriceFeed };
