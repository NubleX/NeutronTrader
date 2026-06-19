// NeutronTrader - New listing sniper engine

const { BaseStrategy } = require('./baseStrategy');
const { storageService } = require('../storageService');

function normalizeExchanges(exchange) {
  if (Array.isArray(exchange)) return exchange.map(e => e.toLowerCase());
  if (typeof exchange === 'string') return [exchange.toLowerCase()];
  return ['binance'];
}

class SniperEngine extends BaseStrategy {
  constructor(listingDetector, riskManager, orderManager, config = {}) {
    super('sniper', riskManager, orderManager);
    this.listingDetector = listingDetector;
    this._openSnipes = new Set();
    this.config = {
      exchange:        config.exchange       || ['binance'],
      allocationUSDT:  config.allocationUSDT || 100,
      maxAllocPerListing: config.maxAllocPerListing || config.allocationUSDT || 100,
      maxConcurrentSnipes: config.maxConcurrentSnipes || 3,
      stopLossPct:     config.stopLossPct    || 0.10,
      sellAfterMs:     config.sellAfterMs    || 900000,
      dryRun:          config.dryRun         || false,
      ...config,
    };
    this.config.exchange = normalizeExchanges(this.config.exchange);
    this._history = [];
  }

  start() {
    super.start();
    if (this.listingDetector) {
      this.listingDetector.on('new-listing', listing => this._onNewListing(listing));
    }
    console.log('[SniperEngine] Started', this.config.dryRun ? '(DRY RUN)' : '');
  }

  stop() {
    super.stop();
    if (this.listingDetector) {
      this.listingDetector.removeAllListeners('new-listing');
    }
    this._openSnipes.clear();
    console.log('[SniperEngine] Stopped');
  }

  setListingDetector(detector) {
    if (this.listingDetector) {
      this.listingDetector.removeAllListeners('new-listing');
    }
    this.listingDetector = detector;
    if (this.isRunning() && detector) {
      detector.on('new-listing', listing => this._onNewListing(listing));
    }
  }

  _isExchangeAllowed(exchange) {
    const allowed = normalizeExchanges(this.config.exchange);
    return allowed.includes((exchange || '').toLowerCase());
  }

  async _onNewListing(listing) {
    if (!this.isRunning()) return;

    const { symbol, exchange } = listing;

    if (!this._isExchangeAllowed(exchange)) return;

    if (this._openSnipes.size >= this.config.maxConcurrentSnipes) {
      console.log(`[SniperEngine] Max concurrent snipes (${this.config.maxConcurrentSnipes}) reached`);
      return;
    }

    const alloc = Math.min(this.config.allocationUSDT, this.config.maxAllocPerListing);

    console.log(`[SniperEngine] New listing detected: ${symbol} on ${exchange}`);

    const riskResult = this.riskManager.validate({
      positionSizeUSDT: alloc,
      symbol,
      exchange,
    });

    if (!riskResult.approved) {
      console.log(`[SniperEngine] Risk rejected for ${symbol}: ${riskResult.reason}`);
      return;
    }

    await new Promise(r => setTimeout(r, 2000));

    const positionId = `sniper_${symbol}_${Date.now()}`;
    this.riskManager.recordOpen(positionId);
    this._openSnipes.add(positionId);

    try {
      let result;
      if (this.config.dryRun) {
        result = {
          dryRun: true,
          orderId: positionId,
          symbol,
          exchange,
          allocationUSDT: alloc,
          message: 'Dry run — no order placed',
        };
        console.log(`[SniperEngine] DRY RUN snipe: ${symbol} on ${exchange} (${alloc} USDT)`);
      } else {
        result = await this.orderManager.executeSniper({
          exchange,
          symbol,
          quantity: alloc,
          stopLossPct: this.config.stopLossPct,
          sellAfterMs: this.config.sellAfterMs,
        });
      }

      const record = {
        symbol,
        exchange,
        listing,
        result,
        dryRun: this.config.dryRun,
        allocationUSDT: alloc,
        executedAt: Date.now(),
      };

      this._history.push(record);
      if (this._history.length > 200) this._history.shift();

      await storageService.saveSetting(`listing_snipe_${positionId}`, record);

      this.emit('sniped', record);
      if (!this.config.dryRun && result?.orderId) {
        this.riskManager.recordOpen(result.orderId);
      }
    } catch (err) {
      console.error(`[SniperEngine] Failed to snipe ${symbol}:`, err.message);
      this.riskManager.recordClose(positionId, 0);
    } finally {
      this._openSnipes.delete(positionId);
    }
  }

  updateConfig(newConfig) {
    if (newConfig.exchange !== undefined) {
      newConfig.exchange = normalizeExchanges(newConfig.exchange);
    }
    this.config = { ...this.config, ...newConfig };
  }

  getHistory() { return [...this._history]; }

  getOptimalSellWindowMs() {
    if (this._history.length === 0) return this.config.sellAfterMs;
    const windows = this._history
      .filter(h => h.result?.sellAfterMs)
      .map(h => h.result.sellAfterMs);
    if (windows.length === 0) return this.config.sellAfterMs;
    const sorted = [...windows].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
}

module.exports = { SniperEngine };
