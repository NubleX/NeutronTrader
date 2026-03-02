/**
 * TradingBotValidator
 * 
 * Validates trading bot configuration before execution.
 * Prevents invalid amounts, intervals, strategies, and API keys from reaching the bot engine.
 */

class TradingBotValidator {
  /**
   * Create validator with risk manager config
   * @param {Object} riskManagerConfig - Contains max position size and other limits
   */
  constructor(riskManagerConfig) {
    this.riskConfig = riskManagerConfig || {};
    
    // Define what values are allowed
    this.VALID_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
    this.VALID_STRATEGIES = ['simpleMovingAverage', 'relativeStrengthIndex', 'bollingerBands'];
    this.MAX_AMOUNT = 1000000; // Sanity check: no single trade > 1M units
    this.MIN_AMOUNT = 0.00001; // Minimum tradeable amount
  }

  /**
   * Validate entire config object
   * Throws error if any validation fails
   * 
   * @param {Object} config - Bot configuration from user
   * @throws {Error} If validation fails
   * @returns {true} If validation passes
   */
  validateConfig(config) {
    // Step 1: Check if config exists
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be a valid object');
    }

    // Step 2: Validate amount (money/quantity to trade)
    this._validateAmount(config.amount);

    // Step 3: Validate symbol (BTC/USD, ETH/USDT, etc.)
    this._validateSymbol(config.symbol);

    // Step 4: Validate interval (how often to check: 1m, 5m, etc.)
    this._validateInterval(config.interval);

    // Step 5: Validate strategy (which trading logic to use)
    this._validateStrategy(config.strategy);

    // Step 6: Validate API credentials
    this._validateApiConfig(config.apiConfig);

    // All checks passed!
    return true;
  }

  /**
   * Check amount is valid and within risk limits
   * @private
   */
  _validateAmount(amount) {
    // Is amount a number?
    if (typeof amount !== 'number') {
      throw new Error('Amount must be a number');
    }

    // Is amount positive?
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Is amount too small?
    if (amount < this.MIN_AMOUNT) {
      throw new Error(`Amount must be at least ${this.MIN_AMOUNT}`);
    }

    // Is amount suspiciously large?
    if (amount > this.MAX_AMOUNT) {
      throw new Error(`Amount exceeds maximum allowed (${this.MAX_AMOUNT})`);
    }

    // Does amount exceed risk manager's max position size?
    const maxPosition = this.riskConfig.maxPositionSize || 100;
    if (amount > maxPosition) {
      throw new Error(`Amount (${amount}) exceeds max position size (${maxPosition})`);
    }
  }

  /**
   * Check symbol format is valid (e.g., BTC/USD)
   * @private
   */
  _validateSymbol(symbol) {
    // Is symbol a string?
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Symbol must be a non-empty string');
    }

    // Does symbol match pattern: BASE/QUOTE (e.g., BTC/USD)?
    if (!/^[A-Z0-9]{1,10}\/[A-Z0-9]{1,10}$/.test(symbol)) {
      throw new Error('Symbol must match format: BASE/QUOTE (e.g., BTC/USD, ETH/USDT)');
    }
  }

  /**
   * Check interval is in the list of allowed values
   * @private
   */
  _validateInterval(interval) {
    // Is interval a string?
    if (!interval || typeof interval !== 'string') {
      throw new Error('Interval must be a non-empty string');
    }

    // Is interval one of the allowed values?
    if (!this.VALID_INTERVALS.includes(interval)) {
      throw new Error(`Interval must be one of: ${this.VALID_INTERVALS.join(', ')}`);
    }
  }

  /**
   * Check strategy is in the list of allowed strategies
   * @private
   */
  _validateStrategy(strategy) {
    // Is strategy a string?
    if (!strategy || typeof strategy !== 'string') {
      throw new Error('Strategy must be a non-empty string');
    }

    // Is strategy one of the allowed values?
    if (!this.VALID_STRATEGIES.includes(strategy)) {
      throw new Error(`Strategy must be one of: ${this.VALID_STRATEGIES.join(', ')}`);
    }
  }

  /**
   * Check API credentials exist and have valid format
   * @private
   */
  _validateApiConfig(apiConfig) {
    // Does apiConfig exist?
    if (!apiConfig || typeof apiConfig !== 'object') {
      throw new Error('API configuration must be a valid object');
    }

    // Does apiKey exist and is it a string?
    if (!apiConfig.apiKey || typeof apiConfig.apiKey !== 'string') {
      throw new Error('API key is missing or invalid');
    }

    // Is apiKey long enough? (Real keys are 50+ chars)
    if (apiConfig.apiKey.length < 10) {
      throw new Error('API key appears to be invalid (too short)');
    }

    // Does apiSecret exist and is it a string?
    if (!apiConfig.apiSecret || typeof apiConfig.apiSecret !== 'string') {
      throw new Error('API secret is missing or invalid');
    }

    // Is apiSecret long enough?
    if (apiConfig.apiSecret.length < 10) {
      throw new Error('API secret appears to be invalid (too short)');
    }
  }
}

module.exports = TradingBotValidator;
