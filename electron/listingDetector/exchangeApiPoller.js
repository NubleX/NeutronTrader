// NeutronTrader - Exchange API poller for new listings
// Diffs the exchange symbol list every 30 seconds.

const EventEmitter = require('events');

class ExchangeApiPoller extends EventEmitter {
  /**
   * @param {Map<string, ExchangeAdapter>} adapters
   * @param {number} intervalMs - polling interval (default 30s)
   */
  constructor(adapters, intervalMs = 30000) {
    super();
    this.adapters = adapters;
    this.intervalMs = intervalMs;
    this._knownSymbols = new Map(); // exchange -> Set<symbol>
    this._timers = new Map();
    this._initialized = false;
  }

  async start() {
    // Seed known symbols
    for (const [name, adapter] of this.adapters.entries()) {
      try {
        const symbols = await adapter.getListedSymbols();
        this._knownSymbols.set(name, new Set(symbols));
        console.log(`[ExchangeApiPoller] Seeded ${symbols.length} symbols from ${name}`);
      } catch (e) {
        console.warn(`[ExchangeApiPoller] Could not seed ${name}: ${e.message}`);
        this._knownSymbols.set(name, new Set());
      }
    }
    this._initialized = true;

    // Start polling each exchange
    for (const [name] of this.adapters.entries()) {
      const timer = setInterval(() => this._poll(name), this.intervalMs);
      this._timers.set(name, timer);
    }

    console.log('[ExchangeApiPoller] Started');
  }

  stop() {
    for (const [, timer] of this._timers) clearInterval(timer);
    this._timers.clear();
    console.log('[ExchangeApiPoller] Stopped');
  }

  async _poll(exchangeName) {
    const adapter = this.adapters.get(exchangeName);
    if (!adapter) return;

    try {
      const currentSymbols = await adapter.getListedSymbols();
      const known = this._knownSymbols.get(exchangeName) || new Set();

      for (const sym of currentSymbols) {
        if (!known.has(sym)) {
          console.log(`[ExchangeApiPoller] NEW LISTING on ${exchangeName}: ${sym}`);
          this.emit('new-listing', {
            symbol: sym,
            exchange: exchangeName,
            source: 'exchange-api',
            detectedAt: Date.now()
          });
          known.add(sym);
        }
      }

      this._knownSymbols.set(exchangeName, known);
    } catch (e) {
      console.warn(`[ExchangeApiPoller] Poll failed for ${exchangeName}: ${e.message}`);
    }
  }
}

module.exports = { ExchangeApiPoller };
