// NeutronTrader - Cross-exchange price feed aggregator with arbitrage detection
//
// Supports REST polling (default) or WebSocket streams (Binance, Bybit).

const EventEmitter = require('events');
const { WebSocketPriceFeed } = require('./websocketPriceFeed');

const EXCHANGE_FEES = {
  binance:  { taker: 0.001,  maker: 0.001  },
  coinbase: { taker: 0.006,  maker: 0.004  },
  kraken:   { taker: 0.0026, maker: 0.0016 },
  okx:      { taker: 0.001,  maker: 0.0008 },
  bybit:    { taker: 0.001,  maker: 0.001  },
};

const DEFAULT_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'LINK/USDT'];

const STAGGER_MS = 10000;
const PER_EXCHANGE_INTERVAL_MS = 60000;

class PriceFeedAggregator extends EventEmitter {
  constructor(adapters, options = {}) {
    super();
    this.adapters = adapters;
    this.pollIntervalMs = options.pollIntervalMs || PER_EXCHANGE_INTERVAL_MS;
    this.minProfitPct = options.minProfitPct || 0.3;
    this.mode = options.mode || 'polling';
    this.priceCache = new Map();
    this._timers = new Map();
    this._symbols = [];
    this._running = false;
    this._wsFeed = null;
    this._wsOppHandler = null;
    this._wsPriceHandler = null;
  }

  start(symbols = DEFAULT_SYMBOLS) {
    if (this._running) return;
    this._running = true;
    this._symbols = symbols;

    if (this.mode === 'websocket') {
      this._startWebSocket(symbols);
      return;
    }

    console.log('[PriceFeed] Starting staggered REST aggregator for', symbols.join(', '));
    let offset = 0;
    for (const [name] of this.adapters.entries()) {
      setTimeout(() => {
        if (!this._running) return;
        this._pollExchange(name);
        const id = setInterval(() => this._pollExchange(name), this.pollIntervalMs);
        this._timers.set(name, id);
      }, offset);
      offset += STAGGER_MS;
    }
  }

  _startWebSocket(symbols) {
    console.log('[PriceFeed] Starting WebSocket mode for', symbols.join(', '));
    this._wsFeed = new WebSocketPriceFeed({ minProfitPct: this.minProfitPct });
    this._wsOppHandler = (opp) => this.emit('arbitrage-opportunity', opp);
    this._wsPriceHandler = ({ symbol, exchange, price, bid, ask, timestamp }) => {
      const key = `${symbol}:${exchange}`;
      this.priceCache.set(key, { price, bid, ask, timestamp });
    };
    this._wsFeed.on('arbitrage-opportunity', this._wsOppHandler);
    this._wsFeed.on('price-update', this._wsPriceHandler);
    this._wsSnapshotHandler = () => this.emit('snapshot-update', this.getPriceSnapshot());
    this._wsFeed.on('price-update', this._wsSnapshotHandler);
    this._wsFeed.start(symbols);
  }

  setMode(mode) {
    const wasRunning = this._running;
    if (wasRunning) this.stop();
    this.mode = mode;
    if (wasRunning) this.start(this._symbols);
  }

  stop() {
    this._running = false;
    for (const [, id] of this._timers) clearInterval(id);
    this._timers.clear();
    if (this._wsFeed) {
      if (this._wsOppHandler) this._wsFeed.removeListener('arbitrage-opportunity', this._wsOppHandler);
      if (this._wsPriceHandler) this._wsFeed.removeListener('price-update', this._wsPriceHandler);
      if (this._wsSnapshotHandler) this._wsFeed.removeListener('price-update', this._wsSnapshotHandler);
      this._wsFeed.stop();
      this._wsFeed = null;
    }
    console.log('[PriceFeed] Aggregator stopped');
  }

  /** Add symbols to the active poll list without restarting the feed */
  updateSymbols(symbols = []) {
    const merged = [...new Set([...this._symbols, ...symbols.filter(Boolean)])];
    if (merged.length === this._symbols.length) return this._symbols;
    this._symbols = merged;
    console.log('[PriceFeed] Symbols updated:', this._symbols.join(', '));
    return this._symbols;
  }

  updateConfig(options = {}) {
    if (options.minProfitPct != null) this.minProfitPct = options.minProfitPct;
    if (options.pollIntervalMs != null) this.pollIntervalMs = options.pollIntervalMs;
  }

  async _pollExchange(exchangeName) {
    const adapter = this.adapters.get(exchangeName);
    if (!adapter) return;

    let anyUpdated = false;
    for (const symbol of this._symbols) {
      try {
        const data = await adapter.getCurrentPrice(symbol);
        const key = `${symbol}:${exchangeName}`;
        this.priceCache.set(key, {
          price: data.price,
          bid:   data.bid || data.price,
          ask:   data.ask || data.price,
          timestamp: Date.now(),
        });
        anyUpdated = true;
        this._detectArbitrage(symbol);
      } catch {
        // skip unsupported symbols silently
      }
    }
    if (anyUpdated) this.emit('snapshot-update', this.getPriceSnapshot());
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

    const buyFee  = EXCHANGE_FEES[bestAsk.exchange]?.taker || 0.001;
    const sellFee = EXCHANGE_FEES[bestBid.exchange]?.taker || 0.001;
    const grossSpread = (bestBid.bid - bestAsk.ask) / bestAsk.ask;
    const netProfit   = grossSpread - buyFee - sellFee;
    const netPct      = netProfit * 100;

    if (netPct >= this.minProfitPct) {
      this.emit('arbitrage-opportunity', {
        symbol,
        buyExchange:   bestAsk.exchange,
        buyPrice:      bestAsk.ask,
        sellExchange:  bestBid.exchange,
        sellPrice:     bestBid.bid,
        grossSpreadPct: (grossSpread * 100).toFixed(4),
        netProfitPct:   netPct.toFixed(4),
        fees: { buy: buyFee, sell: sellFee },
        timestamp: Date.now(),
      });
    }
  }

  getPriceSnapshot() {
    if (this._wsFeed) {
      const wsSnap = this._wsFeed.getPriceSnapshot();
      return { ...Object.fromEntries(this.priceCache), ...wsSnap };
    }
    const snapshot = {};
    for (const [key, data] of this.priceCache.entries()) snapshot[key] = data;
    return snapshot;
  }

  getPricesForSymbol(symbol) {
    if (this._wsFeed) return this._wsFeed.getPricesForSymbol(symbol);
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
    if (this._wsFeed) return this._wsFeed.getLatencyMs();
    return null;
  }
}

module.exports = { PriceFeedAggregator, DEFAULT_SYMBOLS };
