// NeutronTrader - Technical indicator strategies (shared by bot, backtest, composer)

function calculateSMA(prices, period) {
  const result = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

function calculateEMA(prices, period) {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function executeSimpleMovingAverage(candles, shortPeriod = 5, longPeriod = 20) {
  const closePrices = candles.map(candle => parseFloat(candle.close));
  const shortSMA = calculateSMA(closePrices, shortPeriod);
  const longSMA = calculateSMA(closePrices, longPeriod);

  if (shortSMA.length < 2 || longSMA.length < 2) {
    return { action: 'HOLD', reason: 'Insufficient data for SMA calculation' };
  }

  const currentShort = shortSMA[shortSMA.length - 1];
  const previousShort = shortSMA[shortSMA.length - 2];
  const currentLong = longSMA[longSMA.length - 1];
  const previousLong = longSMA[longSMA.length - 2];

  if (previousShort <= previousLong && currentShort > currentLong) {
    return { action: 'BUY', reason: 'SMA bullish crossover detected' };
  }
  if (previousShort >= previousLong && currentShort < currentLong) {
    return { action: 'SELL', reason: 'SMA bearish crossover detected' };
  }
  return { action: 'HOLD', reason: 'No SMA crossover signal' };
}

function executeRSIStrategy(candles, period = 14, overbought = 70, oversold = 30) {
  const closes = candles.map(c => parseFloat(c.close));
  if (closes.length < period + 1) {
    return { action: 'HOLD', reason: 'Insufficient data for RSI calculation' };
  }

  const deltas = [];
  for (let i = 1; i < closes.length; i++) deltas.push(closes[i] - closes[i - 1]);

  const gains = deltas.map(d => (d > 0 ? d : 0));
  const losses = deltas.map(d => (d < 0 ? -d : 0));

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < deltas.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  if (rsi < oversold) return { action: 'BUY', reason: `RSI oversold (${rsi.toFixed(1)})` };
  if (rsi > overbought) return { action: 'SELL', reason: `RSI overbought (${rsi.toFixed(1)})` };
  return { action: 'HOLD', reason: `RSI neutral (${rsi.toFixed(1)})` };
}

function executeBollingerBandsStrategy(candles, currentPrice, period = 20, stdDevMultiplier = 2) {
  const closes = candles.map(c => parseFloat(c.close));
  const price = currentPrice ?? closes[closes.length - 1];
  if (closes.length < period) {
    return { action: 'HOLD', reason: 'Insufficient data for Bollinger Bands' };
  }

  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upperBand = sma + stdDevMultiplier * stdDev;
  const lowerBand = sma - stdDevMultiplier * stdDev;

  if (price <= lowerBand) {
    return { action: 'BUY', reason: `Price at lower Bollinger Band (${lowerBand.toFixed(4)})` };
  }
  if (price >= upperBand) {
    return { action: 'SELL', reason: `Price at upper Bollinger Band (${upperBand.toFixed(4)})` };
  }
  return { action: 'HOLD', reason: `Price within Bollinger Bands (${lowerBand.toFixed(4)} - ${upperBand.toFixed(4)})` };
}

function executeMACDStrategy(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const closes = candles.map(c => parseFloat(c.close));
  if (closes.length < slowPeriod + signalPeriod) {
    return { action: 'HOLD', reason: 'Insufficient data for MACD calculation' };
  }

  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const offset = slowPeriod - fastPeriod;
  const macdLine = [];
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + offset] - slowEMA[i]);
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);
  if (macdLine.length < 2 || signalLine.length < 2) {
    return { action: 'HOLD', reason: 'Insufficient data for MACD signal line' };
  }

  const macdIdx = macdLine.length - 1;
  const sigIdx = signalLine.length - 1;
  const prevMacdIdx = macdIdx - 1;
  const prevSigIdx = sigIdx - 1;

  const histogram = macdLine[macdIdx] - signalLine[sigIdx];
  const prevHistogram = macdLine[prevMacdIdx] - signalLine[prevSigIdx];

  if (prevHistogram <= 0 && histogram > 0) {
    return { action: 'BUY', reason: `MACD bullish crossover (hist ${histogram.toFixed(6)})` };
  }
  if (prevHistogram >= 0 && histogram < 0) {
    return { action: 'SELL', reason: `MACD bearish crossover (hist ${histogram.toFixed(6)})` };
  }
  return { action: 'HOLD', reason: `MACD neutral (hist ${histogram.toFixed(6)})` };
}

const STRATEGY_RUNNERS = {
  simpleMovingAverage: (candles, params = {}, currentPrice) =>
    executeSimpleMovingAverage(candles, params.shortPeriod, params.longPeriod),
  relativeStrengthIndex: (candles, params = {}) =>
    executeRSIStrategy(candles, params.period, params.overbought, params.oversold),
  bollingerBands: (candles, params = {}, currentPrice) =>
    executeBollingerBandsStrategy(candles, currentPrice, params.period, params.stdDevMultiplier),
  macd: (candles, params = {}) =>
    executeMACDStrategy(candles, params.fastPeriod, params.slowPeriod, params.signalPeriod),
};

function runStrategy(strategyName, candles, params = {}, currentPrice) {
  const runner = STRATEGY_RUNNERS[strategyName];
  if (!runner) return { action: 'HOLD', reason: `Unknown strategy: ${strategyName}` };
  return runner(candles, params, currentPrice);
}

function executeComposedStrategy(candles, config, currentPrice) {
  if (!config?.rules?.length) {
    return { action: 'HOLD', reason: 'No strategy rules configured' };
  }

  const signals = config.rules.map(rule => ({
    ...runStrategy(rule.strategy, candles, rule.params || {}, currentPrice),
    weight: rule.weight || 1,
    strategy: rule.strategy,
  }));

  const buys = signals.filter(s => s.action === 'BUY');
  const sells = signals.filter(s => s.action === 'SELL');
  const mode = config.combineMode || 'AND';

  if (mode === 'OR') {
    if (buys.length > 0) {
      return { action: 'BUY', reason: `OR: ${buys.map(s => s.strategy).join(', ')}` };
    }
    if (sells.length > 0) {
      return { action: 'SELL', reason: `OR: ${sells.map(s => s.strategy).join(', ')}` };
    }
    return { action: 'HOLD', reason: 'OR: no signals' };
  }

  if (mode === 'MAJORITY') {
    const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
    const buyWeight = buys.reduce((s, sig) => s + sig.weight, 0);
    const sellWeight = sells.reduce((s, sig) => s + sig.weight, 0);
    if (buyWeight > totalWeight / 2) {
      return { action: 'BUY', reason: `MAJORITY buy (${buyWeight}/${totalWeight})` };
    }
    if (sellWeight > totalWeight / 2) {
      return { action: 'SELL', reason: `MAJORITY sell (${sellWeight}/${totalWeight})` };
    }
    return { action: 'HOLD', reason: 'MAJORITY: no consensus' };
  }

  // AND (default)
  if (buys.length === signals.length) {
    return { action: 'BUY', reason: `AND: all strategies agree BUY` };
  }
  if (sells.length === signals.length) {
    return { action: 'SELL', reason: `AND: all strategies agree SELL` };
  }
  return { action: 'HOLD', reason: 'AND: strategies disagree' };
}

const MAX_POSITION_USDT = 500;
const CANDLE_WINDOW = 50;

function validateComposedConfig(config, options = {}) {
  const errors = [];
  const accountBalance = options.accountBalanceUSDT;

  if (!config?.name?.trim()) {
    errors.push('Config name is required.');
  }

  if (!config?.rules?.length) {
    errors.push('At least one strategy rule is required.');
  }

  if (config?.combineMode === 'AND' && config.rules?.length < 2) {
    errors.push('AND mode requires at least 2 strategies — with one rule, every signal is trivially unanimous and gives false confidence.');
  }

  const maxPos = config?.riskOverrides?.maxPositionUSDT;
  if (maxPos == null || maxPos <= 0) {
    errors.push('Max position must be greater than 0 USDT.');
  } else if (maxPos > MAX_POSITION_USDT) {
    errors.push(`Max position (${maxPos} USDT) exceeds hard cap of ${MAX_POSITION_USDT} USDT — large positions amplify losses when combined strategies misfire.`);
  } else if (accountBalance && maxPos > accountBalance * 0.05) {
    errors.push(`Max position (${maxPos} USDT) exceeds 5% of account balance (${(accountBalance * 0.05).toFixed(2)} USDT) — risking more than 5% per trade is not recommended.`);
  }

  if (options.requireStopLoss && !config?.riskOverrides?.stopLossPct) {
    errors.push('Stop-loss % is mandatory for live trading — without it a single bad signal can wipe the position.');
  }

  (config?.rules || []).forEach((rule, idx) => {
    const n = idx + 1;
    const p = rule.params || {};

    if (rule.weight === 0) {
      errors.push(`Rule ${n}: weight of 0 ignores this strategy but still clutters the config — remove it instead.`);
    }

    if (rule.strategy === 'relativeStrengthIndex') {
      const oversold = p.oversold ?? 30;
      const overbought = p.overbought ?? 70;
      if (oversold >= overbought) {
        errors.push(`Rule ${n} (RSI): oversold (${oversold}) must be below overbought (${overbought}) — inverted thresholds never trigger correctly.`);
      }
    }

    if (rule.strategy === 'simpleMovingAverage') {
      const short = p.shortPeriod ?? 5;
      const long = p.longPeriod ?? 20;
      if (short >= long) {
        errors.push(`Rule ${n} (SMA): short period (${short}) must be less than long period (${long}) — otherwise crossover logic is reversed.`);
      }
    }

    if (rule.strategy === 'bollingerBands') {
      const period = p.period ?? 20;
      if (period > CANDLE_WINDOW) {
        errors.push(`Rule ${n} (Bollinger): period (${period}) exceeds candle window (${CANDLE_WINDOW}) — not enough data to compute bands.`);
      }
    }

    if (rule.strategy === 'macd') {
      const fast = p.fastPeriod ?? 12;
      const slow = p.slowPeriod ?? 26;
      if (fast >= slow) {
        errors.push(`Rule ${n} (MACD): fast period (${fast}) must be less than slow period (${slow}) — standard MACD requires fast < slow.`);
      }
    }
  });

  // Detect contradictory strategy pairs under AND mode
  if (config?.combineMode === 'AND' && config.rules?.length >= 2) {
    const strategies = config.rules.map(r => r.strategy);
    const hasRSI = strategies.includes('relativeStrengthIndex');
    const hasBB = strategies.includes('bollingerBands');
    if (hasRSI && hasBB) {
      errors.push('AND mode with RSI + Bollinger Bands is contradictory — RSI buys oversold (falling) while BB buys at lower band (also falling); they rarely agree simultaneously, so you will almost never get a signal.');
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  calculateSMA,
  calculateEMA,
  executeSimpleMovingAverage,
  executeRSIStrategy,
  executeBollingerBandsStrategy,
  executeMACDStrategy,
  runStrategy,
  executeComposedStrategy,
  validateComposedConfig,
  STRATEGY_RUNNERS,
};
