const { validateApiKeyFormat } = require('../security/encryption');

const VALID_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
const VALID_STRATEGIES = ['simpleMovingAverage', 'relativeStrengthIndex', 'bollingerBands'];
const MIN_AMOUNT = 0.00001;
const MAX_AMOUNT = 1_000_000;

class TradingBotValidator {
  constructor(riskManagerConfig = {}) {
    this.maxPosition = riskManagerConfig.maxPositionUSDT ?? 500;
  }

  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be a valid object');
    }

    this._validateAmount(config.amount);
    this._validateSymbol(config.symbol);
    this._validateInterval(config.interval);
    this._validateStrategy(config.strategy);
    this._validateApiConfig(config.apiConfig);

    return true;
  }

  _validateAmount(amount) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new Error('Amount must be a finite number');
    }
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    if (amount < MIN_AMOUNT) {
      throw new Error(`Amount must be at least ${MIN_AMOUNT}`);
    }
    if (amount > MAX_AMOUNT) {
      throw new Error(`Amount exceeds maximum allowed (${MAX_AMOUNT})`);
    }
    if (amount > this.maxPosition) {
      throw new Error(`Amount (${amount}) exceeds max position size (${this.maxPosition})`);
    }
  }

  _validateSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Symbol must be a non-empty string');
    }
    if (!/^[A-Z0-9]{4,20}$/.test(symbol)) {
      throw new Error('Symbol must be an uppercase trading pair (e.g. BNBUSDT)');
    }
  }

  _validateInterval(interval) {
    if (!interval || typeof interval !== 'string') {
      throw new Error('Interval must be a non-empty string');
    }
    if (!VALID_INTERVALS.includes(interval)) {
      throw new Error(`Interval must be one of: ${VALID_INTERVALS.join(', ')}`);
    }
  }

  _validateStrategy(strategy) {
    if (!strategy || typeof strategy !== 'string') {
      throw new Error('Strategy must be a non-empty string');
    }
    if (!VALID_STRATEGIES.includes(strategy)) {
      throw new Error(`Strategy must be one of: ${VALID_STRATEGIES.join(', ')}`);
    }
  }

  _validateApiConfig(apiConfig) {
    if (!apiConfig || typeof apiConfig !== 'object') {
      throw new Error('API configuration must be a valid object');
    }
    if (!validateApiKeyFormat(apiConfig.apiKey)) {
      throw new Error('API key is missing or invalid');
    }
    if (!apiConfig.apiSecret || typeof apiConfig.apiSecret !== 'string' || apiConfig.apiSecret.length < 16) {
      throw new Error('API secret is missing or invalid');
    }
  }
}

module.exports = TradingBotValidator;
