// NeutronTrader - Cross-exchange price feed aggregator with arbitrage detection

const EventEmitter = require('events');

// Taker fees per exchange (fraction, e.g. 0.001 = 0.1%)
const EXCHANGE_FEES = {
  binance:  { taker: 0.001,  maker: 0.001  },
  coinbase: { taker: 0.006,  maker: 0.004  },
  kraken:   { taker: 0.0026, maker: 0.0016 },
  okx:      { taker: 0.001,  maker: 0.0008 },
  bybit:    { taker: 0.001,  maker: 0.001  }
};

class PriceFeedAggregator extends EventEmitter {
  /**
   * @param {Map<string, ExchangeAdapter>} adapters - exchange name -> adapter
   * @param {object} options
   * @param {number} options.pollIntervalMs  - how often to poll REST prices (ms)
   * @param {number} options.minProfitPct    - minimum net profit % to emit opportunity
   */
  constructor(adapters, options = {}) {
    super();
    this.adapters = adapters; // Map<exchangeName, adapter>
    this.pollIntervalMs = options.pollIntervalMs || 8000;
    this.minProfitPct = options.minProfitPct || 0.5;

    // price cache: Map<"symbol:exchange", { price, bid, ask, timestamp }>
    this.priceCache = new Map();

    this._pollers = new Map(); // symbol -> intervalId
    this._running = false;
  }

  /**
   * Start polling prices for a set of symbols across all configured exchanges.
   */
  start(symbols) {
    if (this._running) return;
    this._running = true;
    console.log('[PriceFeed] Starting aggregator for symbols:', symbols);

    for (const symbol of symbols) {
      const id = setInterval(() => this._pollSymbol(symbol), this.pollIntervalMs);
      this._pollers.set(symbol, id);
      // Immediate first poll
      this._pollSymbol(symbol);
    }
  }

  stop() {
    this._running = false;
    for (const [, id] of this._pollers) clearInterval(id);
    this._pollers.clear();
    console.log('[PriceFeed] Aggregator stopped');
  }

  /**
   * Poll all configured exchanges for a single symbol.
   */
  async _pollSymbol(symbol) {
    const results = await Promise.allSettled(
      Array.from(this.adapters.entries()).map(async ([name, adapter]) => {
        try {
          const data = await adapter.getCurrentPrice(symbol);
          return { exchange: name, symbol, price: data.price, bid: data.bid || data.price, ask: data.ask || data.price };
        } catch (e) {
          // Silently skip unreachable exchanges
          return null;
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        const { exchange, price, bid, ask } = r.value;
        const key = `${symbol}:${exchange}`;
        this.priceCache.set(key, { price, bid, ask, timestamp: Date.now() });
      }
    }

    this._detectArbitrage(symbol);
  }

  /**
   * Compare best bid vs best ask across all exchanges for a symbol.
   */
  _detectArbitrage(symbol) {
    const prices = [];

    for (const [key, data] of this.priceCache.entries()) {
      const [sym, exchange] = key.split(':');
      if (sym !== symbol) continue;
      if (Date.now() - data.timestamp > 30000) continue; // stale
      prices.push({ exchange, ...data });
    }

    if (prices.length < 2) return;

    // Find best bid (highest — where we sell) and best ask (lowest — where we buy)
    const bestBid = prices.reduce((a, b) => b.bid > a.bid ? b : a);
    const bestAsk = prices.reduce((a, b) => b.ask < a.ask ? b : a);

    if (bestBid.exchange === bestAsk.exchange) return;

    const buyFee = EXCHANGE_FEES[bestAsk.exchange]?.taker || 0.001;
    const sellFee = EXCHANGE_FEES[bestBid.exchange]?.taker || 0.001;

    const grossSpread = (bestBid.bid - bestAsk.ask) / bestAsk.ask;
    const netProfit = grossSpread - buyFee - sellFee;
    const netProfitPct = netProfit * 100;

    if (netProfitPct >= this.minProfitPct) {
      const opportunity = {
        symbol,
        buyExchange: bestAsk.exchange,
        buyPrice: bestAsk.ask,
        sellExchange: bestBid.exchange,
        sellPrice: bestBid.bid,
        grossSpreadPct: (grossSpread * 100).toFixed(4),
        netProfitPct: netProfitPct.toFixed(4),
        fees: { buy: buyFee, sell: sellFee },
        timestamp: Date.now()
      };

      console.log(`[PriceFeed] Arbitrage opportunity: ${symbol} buy@${bestAsk.exchange}(${bestAsk.ask}) sell@${bestBid.exchange}(${bestBid.bid}) net=${netProfitPct.toFixed(3)}%`);
      this.emit('arbitrage-opportunity', opportunity);
    }
  }

  /**
   * Get all current prices from cache.
   */
  getPriceSnapshot() {
    const snapshot = {};
    for (const [key, data] of this.priceCache.entries()) {
      snapshot[key] = data;
    }
    return snapshot;
  }

  /**
   * Get prices for a specific symbol across all exchanges.
   */
  getPricesForSymbol(symbol) {
    const result = [];
    for (const [key, data] of this.priceCache.entries()) {
      const [sym, exchange] = key.split(':');
      if (sym === symbol) result.push({ exchange, ...data });
    }
    return result;
  }
}

module.exports = { PriceFeedAggregator };
