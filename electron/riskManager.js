// NeutronTrader - Pre-trade risk validation

const { storageService } = require('./storageService');

class RiskManager {
  constructor(config = {}) {
    this.config = {
      minProfitPct:        config.minProfitPct        || 0.5,   // minimum net profit %
      maxPositionUSDT:     config.maxPositionUSDT     || 500,   // max position size per trade
      dailyLossLimitUSDT:  config.dailyLossLimitUSDT  || 200,   // absolute daily loss cap
      dailyLossLimitPct:   config.dailyLossLimitPct   || 5,     // % of portfolio daily loss cap
      maxOpenPositions:    config.maxOpenPositions    || 5,     // max concurrent open positions
      maxGasGwei:          config.maxGasGwei          || 100,   // max gas price for DeFi
      maxConsecutiveLosses:config.maxConsecutiveLosses|| 5,     // circuit breaker threshold
    };

    this._dailyStats = { date: this._today(), losses: 0, consecutiveLosses: 0 };
    this._openPositions = new Set();
    this._circuitBreakerTripped = false;
  }

  _today() {
    return new Date().toISOString().slice(0, 10);
  }

  _resetDailyIfNeeded() {
    const today = this._today();
    if (this._dailyStats.date !== today) {
      this._dailyStats = { date: today, losses: 0, consecutiveLosses: 0 };
      this._circuitBreakerTripped = false;
    }
  }

  /**
   * Validate an opportunity before execution.
   * Returns { approved: bool, reason: string }
   */
  validate(opportunity) {
    this._resetDailyIfNeeded();

    if (this._circuitBreakerTripped) {
      return { approved: false, reason: 'Circuit breaker tripped — daily loss limit or consecutive losses exceeded' };
    }

    const { netProfitPct, positionSizeUSDT, gasGwei, symbol, exchange } = opportunity;

    if (netProfitPct !== undefined && netProfitPct < this.config.minProfitPct) {
      return { approved: false, reason: `Net profit ${netProfitPct.toFixed(3)}% below minimum ${this.config.minProfitPct}%` };
    }

    if (positionSizeUSDT !== undefined && positionSizeUSDT > this.config.maxPositionUSDT) {
      return { approved: false, reason: `Position size $${positionSizeUSDT} exceeds limit $${this.config.maxPositionUSDT}` };
    }

    if (gasGwei !== undefined && gasGwei > this.config.maxGasGwei) {
      return { approved: false, reason: `Gas price ${gasGwei} gwei exceeds ceiling ${this.config.maxGasGwei} gwei` };
    }

    if (this._openPositions.size >= this.config.maxOpenPositions) {
      return { approved: false, reason: `Max open positions (${this.config.maxOpenPositions}) reached` };
    }

    if (this._dailyStats.losses >= this.config.dailyLossLimitUSDT) {
      this._circuitBreakerTripped = true;
      return { approved: false, reason: `Daily loss limit $${this.config.dailyLossLimitUSDT} reached` };
    }

    return { approved: true, reason: 'Risk checks passed' };
  }

  /** Called when a position is opened */
  recordOpen(positionId) {
    this._openPositions.add(positionId);
  }

  /** Called when a position is closed with P&L */
  recordClose(positionId, pnlUSDT) {
    this._openPositions.delete(positionId);
    this._resetDailyIfNeeded();

    if (pnlUSDT < 0) {
      this._dailyStats.losses += Math.abs(pnlUSDT);
      this._dailyStats.consecutiveLosses++;
      if (this._dailyStats.consecutiveLosses >= this.config.maxConsecutiveLosses) {
        this._circuitBreakerTripped = true;
        console.warn('[RiskManager] Circuit breaker tripped: too many consecutive losses');
      }
    } else {
      this._dailyStats.consecutiveLosses = 0;
    }
  }

  resetCircuitBreaker() {
    this._circuitBreakerTripped = false;
    console.log('[RiskManager] Circuit breaker manually reset');
  }

  getStatus() {
    this._resetDailyIfNeeded();
    return {
      circuitBreakerTripped: this._circuitBreakerTripped,
      dailyLosses: this._dailyStats.losses,
      consecutiveLosses: this._dailyStats.consecutiveLosses,
      openPositions: this._openPositions.size,
      config: this.config
    };
  }
}

const riskManager = new RiskManager();
module.exports = { riskManager, RiskManager };
