// NeutronTrader - CEX-CEX and DEX-CEX arbitrage engine

const { BaseStrategy } = require('./baseStrategy');
const { storageService } = require('../storageService');

class ArbitrageEngine extends BaseStrategy {
  constructor(priceFeedAggregator, riskManager, orderManager, config = {}) {
    super('arbitrage', riskManager, orderManager);
    this.priceFeed = priceFeedAggregator;
    this.config = {
      positionSizeUSDT: config.positionSizeUSDT || 100,
      minProfitPct:     config.minProfitPct     || 0.5,
      ...config
    };
    this._opportunities = [];
    this._oppHandler = opp => this._onOpportunity(opp);
  }

  start() {
    super.start();
    this.priceFeed.on('arbitrage-opportunity', this._oppHandler);
    console.log('[ArbitrageEngine] Started');
  }

  stop() {
    super.stop();
    this.priceFeed.removeListener('arbitrage-opportunity', this._oppHandler);
    console.log('[ArbitrageEngine] Stopped');
  }

  async _persistRecord(record, type) {
    const trade = {
      ...record,
      source: 'arbitrage',
      arbType: type,
      strategy: 'arbitrage',
      timestamp: record.timestamp || record.executedAt || Date.now(),
    };
    await storageService.saveTrade(trade);
    this._opportunities.push(record);
    if (this._opportunities.length > 100) this._opportunities.shift();
  }

  async _onOpportunity(opp) {
    if (!this.isRunning()) return;

    const riskResult = this.riskManager.validate({
      netProfitPct:    parseFloat(opp.netProfitPct),
      positionSizeUSDT: this.config.positionSizeUSDT,
      symbol:          opp.symbol
    });

    if (!riskResult.approved) {
      console.log(`[ArbitrageEngine] Risk rejected: ${riskResult.reason}`);
      return;
    }

    const quantity = (this.config.positionSizeUSDT / opp.buyPrice).toFixed(6);

    console.log(`[ArbitrageEngine] Executing arb: ${opp.symbol} buy@${opp.buyExchange} sell@${opp.sellExchange} net=${opp.netProfitPct}%`);

    const positionId = `arb_${Date.now()}`;
    this.riskManager.recordOpen(positionId);

    try {
      const result = await this.orderManager.executeArbitrage({
        symbol:       opp.symbol,
        buyExchange:  opp.buyExchange,
        sellExchange: opp.sellExchange,
        quantity,
        buyPrice:     opp.buyPrice,
        sellPrice:    opp.sellPrice
      });

      const pnl = result.success
        ? (opp.sellPrice - opp.buyPrice) * parseFloat(quantity)
        : 0;

      this.riskManager.recordClose(positionId, pnl);

      const record = { ...opp, quantity, result, pnl, executedAt: Date.now(), type: 'executed', success: result.success };
      await this._persistRecord(record, 'executed');

      this.emit('executed', record);
    } catch (err) {
      console.error('[ArbitrageEngine] Execution error:', err.message);
      this.riskManager.recordClose(positionId, -this.config.positionSizeUSDT * 0.01);
    }
  }

  getHistory() { return [...this._opportunities]; }

  async getPersistedHistory(filters = {}) {
    return storageService.getArbHistory(filters);
  }
}

module.exports = { ArbitrageEngine };
