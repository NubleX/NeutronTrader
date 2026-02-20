// NeutronTrader - New listing sniper engine

const { BaseStrategy } = require('./baseStrategy');
const { storageService } = require('../storageService');

class SniperEngine extends BaseStrategy {
  constructor(listingDetector, riskManager, orderManager, config = {}) {
    super('sniper', riskManager, orderManager);
    this.listingDetector = listingDetector;
    this.config = {
      exchange:        config.exchange       || 'binance',
      allocationUSDT:  config.allocationUSDT || 100,
      stopLossPct:     config.stopLossPct    || 0.10,   // -10%
      sellAfterMs:     config.sellAfterMs    || 900000, // 15 min
      ...config
    };
    this._history = [];
  }

  start() {
    super.start();
    if (this.listingDetector) {
      this.listingDetector.on('new-listing', listing => this._onNewListing(listing));
    }
    console.log('[SniperEngine] Started');
  }

  stop() {
    super.stop();
    if (this.listingDetector) {
      this.listingDetector.removeAllListeners('new-listing');
    }
    console.log('[SniperEngine] Stopped');
  }

  async _onNewListing(listing) {
    if (!this.isRunning()) return;

    const { symbol, exchange } = listing;

    // Only snipe on the configured exchange
    if (exchange !== this.config.exchange) return;

    console.log(`[SniperEngine] New listing detected: ${symbol} on ${exchange}`);

    const riskResult = this.riskManager.validate({
      positionSizeUSDT: this.config.allocationUSDT,
      symbol,
      exchange
    });

    if (!riskResult.approved) {
      console.log(`[SniperEngine] Risk rejected for ${symbol}: ${riskResult.reason}`);
      return;
    }

    // Wait briefly for the market to open (exchange announces before enabling trading)
    await new Promise(r => setTimeout(r, 2000));

    const positionId = `sniper_${symbol}_${Date.now()}`;
    this.riskManager.recordOpen(positionId);

    try {
      const result = await this.orderManager.executeSniper({
        exchange: this.config.exchange,
        symbol,
        quantity: this.config.allocationUSDT, // market order by quote qty (adapter may handle)
        stopLossPct: this.config.stopLossPct,
        sellAfterMs: this.config.sellAfterMs
      });

      const record = {
        symbol, exchange, listing, result,
        allocationUSDT: this.config.allocationUSDT,
        executedAt: Date.now()
      };

      this._history.push(record);
      if (this._history.length > 200) this._history.shift();

      // Save to listing history in storage
      await storageService.saveSetting(`listing_snipe_${positionId}`, record);

      this.emit('sniped', record);
      this.riskManager.recordOpen(result.orderId);

    } catch (err) {
      console.error(`[SniperEngine] Failed to snipe ${symbol}:`, err.message);
      this.riskManager.recordClose(positionId, 0);
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  getHistory() { return [...this._history]; }

  /**
   * Calculate median optimal sell window from historical data.
   */
  getOptimalSellWindowMs() {
    if (this._history.length === 0) return this.config.sellAfterMs;
    const windows = this._history
      .filter(h => h.result?.sellAfterMs)
      .map(h => h.result.sellAfterMs);
    if (windows.length === 0) return this.config.sellAfterMs;
    const sorted = [...windows].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]; // median
  }
}

module.exports = { SniperEngine };
