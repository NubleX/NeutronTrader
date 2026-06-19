// NeutronTrader - Strategy backtesting engine

const { runStrategy, executeComposedStrategy } = require('./strategies/technicalStrategies');

class BacktestEngine {
  constructor(getCandlesFn) {
    this.getCandles = getCandlesFn;
  }

  async run(config, onProgress) {
    const {
      exchange = 'binance',
      symbol,
      interval = '1h',
      startTime,
      endTime,
      strategy = 'simpleMovingAverage',
      strategyParams = {},
      composedConfig = null,
      initialCapital = 10000,
      feeRate = 0.001,
      windowSize = 50,
    } = config;

    const candles = await this.getCandles(exchange, symbol, interval, {
      startTime,
      endTime,
      limit: 1000,
    });

    if (!candles || candles.length < windowSize + 2) {
      throw new Error(`Insufficient candle data (${candles?.length || 0} bars)`);
    }

    let cash = initialCapital;
    let position = 0;
    let entryPrice = 0;
    const trades = [];
    const equity = [];

    for (let i = windowSize; i < candles.length - 1; i++) {
      const window = candles.slice(0, i + 1);
      const currentPrice = parseFloat(candles[i].close);
      const nextOpen = parseFloat(candles[i + 1].open);

      let signal;
      if (strategy === 'composed' && composedConfig) {
        signal = executeComposedStrategy(window, composedConfig, currentPrice);
      } else {
        signal = runStrategy(strategy, window, strategyParams, currentPrice);
      }

      if (signal.action === 'BUY' && position === 0 && cash > 0) {
        const qty = (cash * (1 - feeRate)) / nextOpen;
        position = qty;
        entryPrice = nextOpen;
        cash = 0;
        trades.push({
          side: 'BUY',
          price: nextOpen,
          quantity: qty,
          timestamp: candles[i + 1].openTime || candles[i + 1].closeTime,
          reason: signal.reason,
        });
      } else if (signal.action === 'SELL' && position > 0) {
        const proceeds = position * nextOpen * (1 - feeRate);
        const pnl = proceeds - position * entryPrice;
        cash = proceeds;
        trades.push({
          side: 'SELL',
          price: nextOpen,
          quantity: position,
          timestamp: candles[i + 1].openTime || candles[i + 1].closeTime,
          reason: signal.reason,
          pnl,
        });
        position = 0;
        entryPrice = 0;
      }

      const markValue = cash + position * currentPrice;
      equity.push({ timestamp: candles[i].closeTime || candles[i].openTime, value: markValue });

      if (onProgress && i % 10 === 0) {
        onProgress({ percent: Math.round((i / candles.length) * 100) });
      }
    }

    const finalPrice = parseFloat(candles[candles.length - 1].close);
    const finalValue = cash + position * finalPrice;
    const metrics = this._computeMetrics(trades, equity, initialCapital, finalValue);

    return { trades, equity, metrics, finalValue, initialCapital };
  }

  _computeMetrics(trades, equity, initialCapital, finalValue) {
    const sellTrades = trades.filter(t => t.side === 'SELL');
    const wins = sellTrades.filter(t => (t.pnl || 0) > 0);
    const losses = sellTrades.filter(t => (t.pnl || 0) < 0);
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

    let maxDrawdown = 0;
    let peak = initialCapital;
    for (const point of equity) {
      if (point.value > peak) peak = point.value;
      const dd = peak > 0 ? (peak - point.value) / peak : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const returns = [];
    for (let i = 1; i < equity.length; i++) {
      const prev = equity[i - 1].value;
      if (prev > 0) returns.push((equity[i].value - prev) / prev);
    }
    const avgReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdReturn = returns.length > 1
      ? Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
      : 0;
    const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

    return {
      totalReturn: ((finalValue - initialCapital) / initialCapital) * 100,
      maxDrawdown: maxDrawdown * 100,
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      winRate: sellTrades.length ? (wins.length / sellTrades.length) * 100 : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      totalTrades: sellTrades.length,
    };
  }
}

module.exports = { BacktestEngine };
