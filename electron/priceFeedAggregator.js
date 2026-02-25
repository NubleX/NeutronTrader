// NeutronTrader - Cross-exchange price feed aggregator with arbitrage detection
//
// Polling strategy: each exchange is polled on its own staggered timer,
// offset by STAGGER_MS apart. With 5 exchanges and 10s stagger, one
// exchange is polled every 10 seconds — never all at once.

const EventEmitter = require('events');

const EXCHANGE_FEES = {
  binance:  { taker: 0.001,  maker: 0.001  },
  coinbase: { taker: 0.006,  maker: 0.004  },
  kraken:   { taker: 0.0026, maker: 0.0016 },
  okx:      { taker: 0.001,  maker: 0.0008 },
  bybit:    { taker: 0.001,  maker: 0.001  },
};

// Historically strong cross-exchange arbitrage pairs
const DEFAULT_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'LINK/USDT'];

const STAGGER_MS = 10000; // 10s between each exchange start
const PER_EXCHANGE_INTERVAL_MS = 60000; // each exchange polls every 60s

class PriceFeedAggregator extends EventEmitter {
  constructor(adapters, options = {}) {
    super();
    this.adapters = adapters;
    this.pollIntervalMs = options.pollIntervalMs || PER_EXCHANGE_INTERVAL_MS;
    this.minProfitPct = options.minProfitPct || 0.3;
    this.priceCache = new Map(); // "symbol:exchange" -> { price, bid, ask, timestamp }
    this._timers = new Map();   // exchangeName -> intervalId
    this._symbols = [];
    this._running = false;
  }

  start(symbols = DEFAULT_SYMBOLS) {
    if (this._running) return;
    this._running = true;
    this._symbols = symbols;
    console.log('[PriceFeed] Starting staggered aggregator for', symbols.join(', '));

    let offset = 0;
    for (const [name] of this.adapters.entries()) {
      // Stagger each exchange start so they never fire simultaneously
      setTimeout(() => {
        if (!this._running) return;
        this._pollExchange(name);
        const id = setInterval(() => this._pollExchange(name), this.pollIntervalMs);
        this._timers.set(name, id);
      }, offset);
      offset += STAGGER_MS;
    }
  }

  stop() {
    this._running = false;
    for (const [, id] of this._timers) clearInterval(id);
    this._timers.clear();
    console.log('[PriceFeed] Aggregator stopped');
  }

  // Poll one exchange for all tracked symbols sequentially (not concurrent)
  async _pollExchange(exchangeName) {
    const adapter = this.adapters.get(exchangeName);
    if (!adapter) return;

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
        this._detectArbitrage(symbol);
      } catch {
        // Exchange doesn't support this symbol or is unreachable — skip silently
      }
    }
  }

  _detectArbitrage(symbol) {
    const prices = [];
    for (const [key, data] of this.priceCache.entries()) {
      const colon = key.lastIndexOf(':');
      if (key.slice(0, colon) !== symbol) continue;
      if (Date.now() - data.timestamp > 120000) continue; // ignore stale (>2 min)
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
    const snapshot = {};
    for (const [key, data] of this.priceCache.entries()) {
      snapshot[key] = data;
    }
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
}

module.exports = { PriceFeedAggregator, DEFAULT_SYMBOLS };
