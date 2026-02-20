// NeutronTrader - CEX-CEX and DEX-CEX arbitrage engine

const { BaseStrategy } = require('./baseStrategy');

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
  }

  start() {
    super.start();
    this.priceFeed.on('arbitrage-opportunity', opp => this._onOpportunity(opp));
    console.log('[ArbitrageEngine] Started');
  }

  stop() {
    super.stop();
    this.priceFeed.removeAllListeners('arbitrage-opportunity');
    console.log('[ArbitrageEngine] Stopped');
  }

  async _onOpportunity(opp) {
    if (!this.isRunning()) return;

    // Risk check
    const riskResult = this.riskManager.validate({
      netProfitPct:    parseFloat(opp.netProfitPct),
      positionSizeUSDT: this.config.positionSizeUSDT,
      symbol:          opp.symbol
    });

    if (!riskResult.approved) {
      console.log(`[ArbitrageEngine] Risk rejected: ${riskResult.reason}`);
      return;
    }

    // Estimate quantity from position size and buy price
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

      const record = { ...opp, quantity, result, pnl, executedAt: Date.now() };
      this._opportunities.push(record);
      if (this._opportunities.length > 100) this._opportunities.shift();

      this.emit('executed', record);
    } catch (err) {
      console.error('[ArbitrageEngine] Execution error:', err.message);
      this.riskManager.recordClose(positionId, -this.config.positionSizeUSDT * 0.01);
    }
  }

  getHistory() { return [...this._opportunities]; }
}

module.exports = { ArbitrageEngine };
