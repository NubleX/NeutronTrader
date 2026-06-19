// NeutronTrader - Strategy composer IPC service wrapper

const isElectronAvailable = () =>
  typeof window !== 'undefined' && window.electronAPI;

export async function saveStrategyConfig(config) {
  if (!isElectronAvailable()) return { success: false };
  return window.electronAPI.strategy.save(config);
}

export async function listStrategyConfigs() {
  if (!isElectronAvailable()) return [];
  const result = await window.electronAPI.strategy.list();
  return result?.data || [];
}

export async function deleteStrategyConfig(name) {
  if (!isElectronAvailable()) return { success: false };
  return window.electronAPI.strategy.delete(name);
}

export const STRATEGY_HELP = {
  combineMode: 'AND = all strategies must agree (conservative, fewer trades). OR = any strategy triggers (aggressive, more false signals). MAJORITY = weighted vote — useful when you trust some indicators more than others.',
  maxPosition: 'Maximum USDT per trade. Hard cap is 500 USDT. Risking more than 5% of your balance per trade is blocked when balance is known.',
  stopLoss: 'Required for live trading. Without a stop-loss, one bad combined signal can lose the entire position. Backtests do not require this.',
  weight: 'In MAJORITY mode, higher weight means that strategy counts more toward the final vote. Zero weight is not allowed — remove the rule instead.',
  rsi: 'RSI measures momentum. Buy when oversold (price dropped too fast), sell when overbought. Oversold must be lower than overbought.',
  sma: 'Compares short-term vs long-term average price. Bullish when short MA crosses above long MA. Short period must be less than long period.',
  bollingerBands: 'Buys when price hits the lower band (statistically cheap), sells at upper band. Period must fit within the candle window (50 bars).',
  macd: 'Trend-following momentum indicator. Buy on bullish crossover (MACD line crosses above signal). Fast EMA must be less than slow EMA.',
};

export async function validateStrategyConfig(config, options = {}) {
  if (!isElectronAvailable()) return { valid: true, errors: [] };
  const result = await window.electronAPI.strategy.validate(config, options);
  return result?.data || { valid: false, errors: ['Validation unavailable'] };
}

export const STRATEGY_OPTIONS = [
  { id: 'simpleMovingAverage', label: 'SMA Crossover', params: [
    { key: 'shortPeriod', label: 'Short Period', type: 'number', default: 5 },
    { key: 'longPeriod', label: 'Long Period', type: 'number', default: 20 },
  ]},
  { id: 'relativeStrengthIndex', label: 'RSI', params: [
    { key: 'period', label: 'Period', type: 'number', default: 14 },
    { key: 'overbought', label: 'Overbought', type: 'number', default: 70 },
    { key: 'oversold', label: 'Oversold', type: 'number', default: 30 },
  ]},
  { id: 'bollingerBands', label: 'Bollinger Bands', params: [
    { key: 'period', label: 'Period', type: 'number', default: 20 },
    { key: 'stdDevMultiplier', label: 'Std Dev', type: 'number', default: 2 },
  ]},
  { id: 'macd', label: 'MACD', params: [
    { key: 'fastPeriod', label: 'Fast EMA', type: 'number', default: 12 },
    { key: 'slowPeriod', label: 'Slow EMA', type: 'number', default: 26 },
    { key: 'signalPeriod', label: 'Signal', type: 'number', default: 9 },
  ]},
];
