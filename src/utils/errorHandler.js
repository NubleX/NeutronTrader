// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

export class TradingError extends Error {
    constructor(message, code, category, details = {}) {
        super(message);
        this.name = 'TradingError';
        this.code = code;
        this.category = category;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

export const ERROR_CATEGORIES = {
    NETWORK: 'network',
    API: 'api',
    AUTHENTICATION: 'authentication',
    VALIDATION: 'validation',
    TRADING: 'trading',
    RATE_LIMIT: 'rate_limit',
    SYSTEM: 'system'
};

export const ERROR_CODES = {
    // Network errors
    NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
    NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
    CONNECTION_FAILED: 'CONNECTION_FAILED',

    // API errors
    API_RESPONSE_ERROR: 'API_RESPONSE_ERROR',
    INVALID_API_RESPONSE: 'INVALID_API_RESPONSE',
    API_MAINTENANCE: 'API_MAINTENANCE',

    // Authentication errors
    INVALID_API_KEY: 'INVALID_API_KEY',
    INVALID_SIGNATURE: 'INVALID_SIGNATURE',
    API_KEY_EXPIRED: 'API_KEY_EXPIRED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

    // Validation errors
    INVALID_SYMBOL: 'INVALID_SYMBOL',
    INVALID_QUANTITY: 'INVALID_QUANTITY',
    INVALID_PRICE: 'INVALID_PRICE',
    MIN_NOTIONAL_ERROR: 'MIN_NOTIONAL_ERROR',

    // Trading errors
    INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
    ORDER_REJECTED: 'ORDER_REJECTED',
    MARKET_CLOSED: 'MARKET_CLOSED',
    SYMBOL_NOT_TRADING: 'SYMBOL_NOT_TRADING',

    // Rate limiting
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    IP_BANNED: 'IP_BANNED',

    // System errors
    STORAGE_ERROR: 'STORAGE_ERROR',
    CALCULATION_ERROR: 'CALCULATION_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

export const USER_FRIENDLY_MESSAGES = {
    [ERROR_CODES.NETWORK_TIMEOUT]: {
        title: 'Connection Timeout',
        message: 'The request took too long to complete. Please check your internet connection and try again.',
        suggestions: [
            'Check your internet connection',
            'Try again in a few moments',
            'Reduce the request complexity'
        ]
    },

    [ERROR_CODES.NETWORK_UNAVAILABLE]: {
        title: 'Network Unavailable',
        message: 'Unable to connect to the trading services. Please check your internet connection.',
        suggestions: [
            'Check your internet connection',
            'Verify that Binance services are not under maintenance',
            'Try connecting to a different network'
        ]
    },

    [ERROR_CODES.INVALID_API_KEY]: {
        title: 'Invalid API Key',
        message: 'The provided API key is invalid or has been revoked.',
        suggestions: [
            'Double-check your API key is entered correctly',
            'Generate a new API key from Binance Testnet',
            'Ensure the API key has not expired'
        ]
    },

    [ERROR_CODES.INVALID_SIGNATURE]: {
        title: 'Authentication Failed',
        message: 'Failed to authenticate with the trading API. Please check your API secret.',
        suggestions: [
            'Verify your API secret is correct',
            'Check that your system time is synchronized',
            'Generate new API credentials if the issue persists'
        ]
    },

    [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: {
        title: 'Insufficient Permissions',
        message: 'Your API key does not have the required permissions for this operation.',
        suggestions: [
            'Ensure your API key has TRADE, USER_DATA, and USER_STREAM permissions',
            'Regenerate your API key with the correct permissions',
            'Contact support if permissions appear correct'
        ]
    },

    [ERROR_CODES.INSUFFICIENT_BALANCE]: {
        title: 'Insufficient Balance',
        message: 'You do not have enough balance to complete this trade.',
        suggestions: [
            'Check your account balance',
            'Reduce the trade amount',
            'Deposit more funds to your testnet account'
        ]
    },

    [ERROR_CODES.INVALID_QUANTITY]: {
        title: 'Invalid Trade Quantity',
        message: 'The specified quantity does not meet the minimum requirements or step size.',
        suggestions: [
            'Check the minimum quantity for this trading pair',
            'Ensure quantity follows the correct step size',
            'Verify you have sufficient balance'
        ]
    },

    [ERROR_CODES.RATE_LIMIT_EXCEEDED]: {
        title: 'Rate Limit Exceeded',
        message: 'Too many requests have been made. Please wait before trying again.',
        suggestions: [
            'Wait a few minutes before making more requests',
            'Reduce the frequency of your trading bot',
            'Consider using longer time intervals'
        ]
    },

    [ERROR_CODES.MARKET_CLOSED]: {
        title: 'Market Unavailable',
        message: 'The market for this trading pair is currently closed or unavailable.',
        suggestions: [
            'Try a different trading pair',
            'Wait for the market to reopen',
            'Check Binance status for maintenance updates'
        ]
    },

    [ERROR_CODES.UNKNOWN_ERROR]: {
        title: 'Unexpected Error',
        message: 'An unexpected error occurred. Please try again or contact support.',
        suggestions: [
            'Try the operation again',
            'Check the application logs for more details',
            'Contact support if the problem persists'
        ]
    }
};

export class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 1000;
    }

    handleError(error, context = {}) {
        const processedError = this.processError(error, context);
        this.logError(processedError);
        return processedError;
    }

    processError(error, context) {
        // If it's already a TradingError, return as is
        if (error instanceof TradingError) {
            return error;
        }

        let errorCode = ERROR_CODES.UNKNOWN_ERROR;
        let category = ERROR_CATEGORIES.SYSTEM;
        let details = { ...context };

        // Process different error types
        if (error.code) {
            // Binance API errors
            switch (error.code) {
                case -1022:
                    errorCode = ERROR_CODES.INVALID_SIGNATURE;
                    category = ERROR_CATEGORIES.AUTHENTICATION;
                    break;
                case -2015:
                    errorCode = ERROR_CODES.INVALID_API_KEY;
                    category = ERROR_CATEGORIES.AUTHENTICATION;
                    break;
                case -1021:
                    errorCode = ERROR_CODES.INVALID_SIGNATURE;
                    category = ERROR_CATEGORIES.AUTHENTICATION;
                    details.reason = 'Timestamp outside recvWindow';
                    break;
                case -2010:
                    errorCode = ERROR_CODES.ORDER_REJECTED;
                    category = ERROR_CATEGORIES.TRADING;
                    break;
                case -2011:
                    errorCode = ERROR_CODES.ORDER_REJECTED;
                    category = ERROR_CATEGORIES.TRADING;
                    details.reason = 'Unknown order';
                    break;
                case -1013:
                    errorCode = ERROR_CODES.INVALID_QUANTITY;
                    category = ERROR_CATEGORIES.VALIDATION;
                    break;
                case -1010:
                    errorCode = ERROR_CODES.MIN_NOTIONAL_ERROR;
                    category = ERROR_CATEGORIES.VALIDATION;
                    break;
                case -2019:
                    errorCode = ERROR_CODES.INSUFFICIENT_BALANCE;
                    category = ERROR_CATEGORIES.TRADING;
                    break;
                case -1003:
                    errorCode = ERROR_CODES.RATE_LIMIT_EXCEEDED;
                    category = ERROR_CATEGORIES.RATE_LIMIT;
                    break;
                default:
                    errorCode = ERROR_CODES.API_RESPONSE_ERROR;
                    category = ERROR_CATEGORIES.API;
                    details.binanceCode = error.code;
            }
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorCode = ERROR_CODES.NETWORK_UNAVAILABLE;
            category = ERROR_CATEGORIES.NETWORK;
        } else if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
            errorCode = ERROR_CODES.NETWORK_TIMEOUT;
            category = ERROR_CATEGORIES.NETWORK;
        } else if (error.message.includes('CORS')) {
            errorCode = ERROR_CODES.CONNECTION_FAILED;
            category = ERROR_CATEGORIES.NETWORK;
            details.reason = 'CORS policy restriction';
        }

        return new TradingError(
            error.message || 'An unexpected error occurred',
            errorCode,
            category,
            details
        );
    }

    logError(error) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                code: error.code,
                category: error.category,
                details: error.details
            },
            stack: error.stack
        };

        this.errorLog.push(logEntry);

        // Keep log size manageable
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(-this.maxLogSize / 2);
        }

        // Console logging for development
        console.error(`[${error.category.toUpperCase()}] ${error.code}: ${error.message}`, error.details);
    }

    getUserFriendlyMessage(error) {
        const friendlyError = USER_FRIENDLY_MESSAGES[error.code];

        if (friendlyError) {
            return {
                title: friendlyError.title,
                message: friendlyError.message,
                suggestions: friendlyError.suggestions,
                category: error.category,
                code: error.code
            };
        }

        // Fallback for unknown errors
        return {
            title: 'Unexpected Error',
            message: error.message || 'An unexpected error occurred',
            suggestions: [
                'Try the operation again',
                'Check your internet connection',
                'Contact support if the problem persists'
            ],
            category: error.category,
            code: error.code
        };
    }

    getErrorLog(limit = 50) {
        return this.errorLog.slice(-limit);
    }

    clearErrorLog() {
        this.errorLog = [];
    }

    getErrorStatistics() {
        const stats = {
            total: this.errorLog.length,
            byCategory: {},
            byCode: {},
            recent: this.errorLog.slice(-10)
        };

        this.errorLog.forEach(entry => {
            const category = entry.error.category;
            const code = entry.error.code;

            stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
            stats.byCode[code] = (stats.byCode[code] || 0) + 1;
        });

        return stats;
    }
}

// Validation utilities
export const validateTradingParameters = (symbol, quantity, price = null) => {
    const errors = [];

    if (!symbol || typeof symbol !== 'string') {
        errors.push(new TradingError(
            'Invalid symbol provided',
            ERROR_CODES.INVALID_SYMBOL,
            ERROR_CATEGORIES.VALIDATION
        ));
    }

    if (!quantity || isNaN(quantity) || quantity <= 0) {
        errors.push(new TradingError(
            'Invalid quantity provided',
            ERROR_CODES.INVALID_QUANTITY,
            ERROR_CATEGORIES.VALIDATION
        ));
    }

    if (price !== null && (isNaN(price) || price <= 0)) {
        errors.push(new TradingError(
            'Invalid price provided',
            ERROR_CODES.INVALID_PRICE,
            ERROR_CATEGORIES.VALIDATION
        ));
    }

    return errors;
};

export const validateApiConfiguration = (apiConfig) => {
    const errors = [];

    if (!apiConfig) {
        errors.push(new TradingError(
            'API configuration is required',
            ERROR_CODES.INVALID_API_KEY,
            ERROR_CATEGORIES.AUTHENTICATION
        ));
        return errors;
    }

    if (!apiConfig.apiKey || typeof apiConfig.apiKey !== 'string' || apiConfig.apiKey.length < 10) {
        errors.push(new TradingError(
            'Valid API key is required',
            ERROR_CODES.INVALID_API_KEY,
            ERROR_CATEGORIES.AUTHENTICATION
        ));
    }

    if (!apiConfig.apiSecret || typeof apiConfig.apiSecret !== 'string' || apiConfig.apiSecret.length < 10) {
        errors.push(new TradingError(
            'Valid API secret is required',
            ERROR_CODES.INVALID_SIGNATURE,
            ERROR_CATEGORIES.AUTHENTICATION
        ));
    }

    return errors;
};

// Retry utility with exponential backoff
export class RetryHandler {
    constructor(maxRetries = 3, baseDelay = 1000) {
        this.maxRetries = maxRetries;
        this.baseDelay = baseDelay;
    }

    async executeWithRetry(operation, context = {}) {
        let lastError;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                // Don't retry on certain error types
                if (this.shouldNotRetry(error)) {
                    throw error;
                }

                if (attempt < this.maxRetries) {
                    const delay = this.calculateDelay(attempt);
                    console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                    await this.delay(delay);
                }
            }
        }

        throw lastError;
    }

    shouldNotRetry(error) {
        // Don't retry on authentication, validation, or trading errors
        if (error instanceof TradingError) {
            return [
                ERROR_CATEGORIES.AUTHENTICATION,
                ERROR_CATEGORIES.VALIDATION,
                ERROR_CATEGORIES.TRADING
            ].includes(error.category);
        }

        return false;
    }

    calculateDelay(attempt) {
        // Exponential backoff with jitter
        const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * exponentialDelay;
        return Math.floor(exponentialDelay + jitter);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler();
export const retryHandler = new RetryHandler();

// Helper function for wrapping async operations
export const withErrorHandling = async (operation, context = {}) => {
    try {
        return await operation();
    } catch (error) {
        throw globalErrorHandler.handleError(error, context);
    }
};

// Helper function for wrapping operations with retry
export const withRetry = async (operation, context = {}) => {
    return await retryHandler.executeWithRetry(operation, context);
};