// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import { withErrorHandling } from '../utils/errorHandler';
import liveTradingPairsService from './liveTradingPairsService';
import notificationService from './notificationService';
import { storageService } from './storageService';

class IntegrationService {
    constructor() {
        this.isInitialized = false;
        this.watchedPairs = new Set();
        this.priceAlerts = new Map();
        this.marketDataCache = new Map();
        this.updateInterval = null;
    }

    /**
     * Initialize the integration service
     */
    async initialize(config = {}) {
        if (this.isInitialized) return;

        try {
            // Initialize live trading pairs service
            await liveTradingPairsService.initialize({
                coinGeckoApiKey: config.coinGeckoApiKey || process.env.REACT_APP_COINGECKO_API_KEY,
                coinMarketCapApiKey: config.coinMarketCapApiKey || process.env.REACT_APP_COINMARKETCAP_API_KEY
            });

            // Load saved user preferences
            await this.loadUserPreferences();

            // Start market data monitoring
            this.startMarketDataMonitoring();

            this.isInitialized = true;
            console.log('Integration service initialized successfully');

            // Notify about successful initialization
            await notificationService.systemUpdate('Live market data service connected');

        } catch (error) {
            console.error('Failed to initialize integration service:', error);
            throw error;
        }
    }

    /**
     * Get enhanced trading pairs for the trading setup component
     */
    async getEnhancedTradingPairs(options = {}) {
        return withErrorHandling(async () => {
            const defaultOptions = {
                includeInactive: false,
                minVolume: 500000, // $500k minimum daily volume
                maxResults: 30,
                sortBy: 'volume_desc'
            };

            const mergedOptions = { ...defaultOptions, ...options };
            const pairs = await liveTradingPairsService.getTradingPairs(mergedOptions);

            // Add user-specific enhancements
            const enhancedPairs = await Promise.all(
                pairs.map(async (pair) => await this.enhancePairWithUserData(pair))
            );

            // Save to cache for offline access
            await this.cacheMarketData(enhancedPairs);

            return enhancedPairs;
        }, { operation: 'get_enhanced_trading_pairs' });
    }

    /**
     * Enhance a trading pair with user-specific data
     */
    async enhancePairWithUserData(pair) {
        try {
            // Get user's trading history for this pair
            const tradingHistory = await storageService.getTrades({
                symbol: pair.symbol,
                limit: 50
            });

            // Calculate user-specific metrics
            const userMetrics = this.calculateUserMetrics(tradingHistory);

            // Get user's favorite pairs
            const favorites = await storageService.getSetting('favorite_pairs', []);
            const isFavorite = favorites.includes(pair.symbol);

            // Get user's risk preferences
            const riskPreference = await storageService.getSetting('risk_preference', 'medium');
            const riskCompatibility = this.calculateRiskCompatibility(pair.riskLevel, riskPreference);

            // Get price alerts for this pair
            const alerts = this.priceAlerts.get(pair.symbol) || [];

            return {
                ...pair,
                userMetrics,
                isFavorite,
                riskCompatibility,
                alerts,
                recommendation: this.generateRecommendation(pair, userMetrics, riskCompatibility),
                lastTraded: userMetrics.lastTradeTime,
                userProfitLoss: userMetrics.totalProfitLoss
            };
        } catch (error) {
            console.warn(`Failed to enhance pair ${pair.symbol}:`, error);
            return pair;
        }
    }

    /**
     * Calculate user-specific trading metrics
     */
    calculateUserMetrics(trades) {
        if (!trades || trades.length === 0) {
            return {
                totalTrades: 0,
                totalProfitLoss: 0,
                winRate: 0,
                avgTradeSize: 0,
                lastTradeTime: null,
                favoriteStrategy: null
            };
        }

        const totalTrades = trades.length;
        const totalProfitLoss = trades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
        const winningTrades = trades.filter(trade => (trade.profit || 0) > 0).length;
        const winRate = (winningTrades / totalTrades) * 100;
        const avgTradeSize = trades.reduce((sum, trade) => sum + (trade.quantity || 0), 0) / totalTrades;
        const lastTradeTime = Math.max(...trades.map(trade => trade.timestamp));

        // Find most used strategy
        const strategyCount = {};
        trades.forEach(trade => {
            if (trade.strategy) {
                strategyCount[trade.strategy] = (strategyCount[trade.strategy] || 0) + 1;
            }
        });
        const favoriteStrategy = Object.keys(strategyCount).reduce((a, b) =>
            strategyCount[a] > strategyCount[b] ? a : b, null
        );

        return {
            totalTrades,
            totalProfitLoss,
            winRate,
            avgTradeSize,
            lastTradeTime,
            favoriteStrategy
        };
    }

    /**
     * Calculate risk compatibility score
     */
    calculateRiskCompatibility(pairRisk, userRiskPreference) {
        const riskLevels = {
            'very-low': 1,
            'low': 2,
            'medium': 3,
            'high': 4,
            'very-high': 5
        };

        const pairRiskScore = riskLevels[pairRisk] || 3;
        const userRiskScore = riskLevels[userRiskPreference] || 3;
        const difference = Math.abs(pairRiskScore - userRiskScore);

        if (difference === 0) return 'perfect';
        if (difference === 1) return 'good';
        if (difference === 2) return 'moderate';
        return 'poor';
    }

    /**
     * Generate trading recommendation
     */
    generateRecommendation(pair, userMetrics, riskCompatibility) {
        let score = 0;
        let reasons = [];

        // Volume scoring
        if (pair.volume24h > 10000000) {
            score += 2;
            reasons.push('High liquidity');
        } else if (pair.volume24h > 1000000) {
            score += 1;
            reasons.push('Good liquidity');
        }

        // Risk compatibility
        switch (riskCompatibility) {
            case 'perfect':
                score += 3;
                reasons.push('Perfect risk match');
                break;
            case 'good':
                score += 2;
                reasons.push('Good risk match');
                break;
            case 'moderate':
                score += 1;
                reasons.push('Moderate risk match');
                break;
            default:
                reasons.push('Risk mismatch');
        }

        // User experience
        if (userMetrics.totalTrades > 5 && userMetrics.winRate > 60) {
            score += 2;
            reasons.push('Strong trading history');
        } else if (userMetrics.totalTrades > 0) {
            score += 1;
            reasons.push('Some trading experience');
        }

        // Market performance
        if (Math.abs(pair.priceChange24h) < 5) {
            score += 1;
            reasons.push('Stable price action');
        } else if (pair.priceChange24h > 10) {
            reasons.push('High volatility - caution advised');
        }

        // Generate recommendation
        let recommendation;
        if (score >= 6) recommendation = 'highly-recommended';
        else if (score >= 4) recommendation = 'recommended';
        else if (score >= 2) recommendation = 'neutral';
        else recommendation = 'not-recommended';

        return {
            level: recommendation,
            score,
            reasons: reasons.slice(0, 3) // Limit to top 3 reasons
        };
    }

    /**
     * Set up price alerts for a trading pair
     */
    async setPriceAlert(symbol, alertConfig) {
        return withErrorHandling(async () => {
            const alerts = this.priceAlerts.get(symbol) || [];

            const newAlert = {
                id: Date.now().toString(),
                symbol,
                type: alertConfig.type, // 'above', 'below', 'change'
                value: alertConfig.value,
                enabled: true,
                createdAt: Date.now(),
                ...alertConfig
            };

            alerts.push(newAlert);
            this.priceAlerts.set(symbol, alerts);

            // Save to persistent storage
            await storageService.saveSetting(`price_alerts_${symbol}`, alerts);

            return newAlert;
        }, { operation: 'set_price_alert', symbol });
    }

    /**
     * Remove a price alert
     */
    async removePriceAlert(symbol, alertId) {
        const alerts = this.priceAlerts.get(symbol) || [];
        const filteredAlerts = alerts.filter(alert => alert.id !== alertId);

        this.priceAlerts.set(symbol, filteredAlerts);
        await storageService.saveSetting(`price_alerts_${symbol}`, filteredAlerts);
    }

    /**
     * Add/remove pair from favorites
     */
    async toggleFavoritePair(symbol) {
        const favorites = await storageService.getSetting('favorite_pairs', []);
        const index = favorites.indexOf(symbol);

        if (index === -1) {
            favorites.push(symbol);
            await notificationService.systemUpdate(`${symbol} added to favorites`);
        } else {
            favorites.splice(index, 1);
            await notificationService.systemUpdate(`${symbol} removed from favorites`);
        }

        await storageService.saveSetting('favorite_pairs', favorites);
        return !favorites.includes(symbol);
    }

    /**
     * Start monitoring market data for price alerts and notifications
     */
    startMarketDataMonitoring() {
        if (this.updateInterval) return;

        this.updateInterval = setInterval(async () => {
            try {
                await this.checkPriceAlerts();
                await this.updateWatchedPairs();
            } catch (error) {
                console.error('Market data monitoring error:', error);
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Check price alerts and send notifications
     */
    async checkPriceAlerts() {
        if (this.priceAlerts.size === 0) return;

        const symbols = Array.from(this.priceAlerts.keys());
        const prices = await liveTradingPairsService.getLivePrices(symbols);

        for (const [symbol, alerts] of this.priceAlerts.entries()) {
            const currentPrice = prices[symbol]?.price;
            if (!currentPrice) continue;

            for (const alert of alerts.filter(a => a.enabled)) {
                let shouldTrigger = false;
                let message = '';

                switch (alert.type) {
                    case 'above':
                        if (currentPrice >= alert.value) {
                            shouldTrigger = true;
                            message = `${symbol} price (${currentPrice}) is above your alert level of ${alert.value}`;
                        }
                        break;
                    case 'below':
                        if (currentPrice <= alert.value) {
                            shouldTrigger = true;
                            message = `${symbol} price (${currentPrice}) is below your alert level of ${alert.value}`;
                        }
                        break;
                    case 'change':
                        const stats = await liveTradingPairsService.get24hStats([symbol]);
                        const priceChange = stats[symbol]?.priceChangePercent || 0;
                        if (Math.abs(priceChange) >= alert.value) {
                            shouldTrigger = true;
                            message = `${symbol} price changed ${priceChange.toFixed(2)}%, exceeding your ${alert.value}% alert`;
                        }
                        break;
                }

                if (shouldTrigger) {
                    await notificationService.notify('price_alert', {
                        symbol,
                        price: currentPrice,
                        message,
                        alertType: alert.type,
                        alertValue: alert.value
                    });

                    // Disable alert after triggering (or implement cooldown)
                    alert.enabled = false;
                    await this.savePriceAlerts(symbol);
                }
            }
        }
    }

    /**
     * Update data for watched pairs
     */
    async updateWatchedPairs() {
        if (this.watchedPairs.size === 0) return;

        const symbols = Array.from(this.watchedPairs);
        const marketData = await liveTradingPairsService.getMarketData(symbols);

        marketData.forEach(data => {
            this.marketDataCache.set(data.symbol, {
                ...data,
                timestamp: Date.now()
            });
        });
    }

    /**
     * Add pair to watch list
     */
    addToWatchList(symbol) {
        this.watchedPairs.add(symbol);
    }

    /**
     * Remove pair from watch list
     */
    removeFromWatchList(symbol) {
        this.watchedPairs.delete(symbol);
        this.marketDataCache.delete(symbol);
    }

    /**
     * Get cached market data
     */
    getCachedMarketData(symbol) {
        const cached = this.marketDataCache.get(symbol);
        if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
            return cached;
        }
        return null;
    }

    /**
     * Cache market data for offline access
     */
    async cacheMarketData(pairs) {
        try {
            const cacheData = {
                timestamp: Date.now(),
                pairs: pairs.map(pair => ({
                    symbol: pair.symbol,
                    price: pair.price,
                    volume24h: pair.volume24h,
                    priceChange24h: pair.priceChange24h,
                    riskLevel: pair.riskLevel,
                    category: pair.category
                }))
            };

            await storageService.saveSetting('market_data_cache', cacheData);
        } catch (error) {
            console.warn('Failed to cache market data:', error);
        }
    }

    /**
     * Load cached market data for offline mode
     */
    async loadCachedMarketData() {
        try {
            const cached = await storageService.getSetting('market_data_cache');
            if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour
                return cached.pairs;
            }
        } catch (error) {
            console.warn('Failed to load cached market data:', error);
        }
        return [];
    }

    /**
     * Load user preferences
     */
    async loadUserPreferences() {
        try {
            // Load favorite pairs
            const favorites = await storageService.getSetting('favorite_pairs', []);
            favorites.forEach(symbol => this.addToWatchList(symbol));

            // Load price alerts
            const alertKeys = await storageService.getAllSettings();
            for (const [key, value] of Object.entries(alertKeys)) {
                if (key.startsWith('price_alerts_')) {
                    const symbol = key.replace('price_alerts_', '');
                    this.priceAlerts.set(symbol, value);
                    this.addToWatchList(symbol);
                }
            }
        } catch (error) {
            console.warn('Failed to load user preferences:', error);
        }
    }

    /**
     * Save price alerts to storage
     */
    async savePriceAlerts(symbol) {
        const alerts = this.priceAlerts.get(symbol) || [];
        await storageService.saveSetting(`price_alerts_${symbol}`, alerts);
    }

    /**
     * Get trading pair validation rules
     */
    async getValidationRules(symbol) {
        try {
            const pairDetails = await liveTradingPairsService.getTradingPairDetails(symbol);
            return {
                minQty: pairDetails.minQty,
                maxQty: pairDetails.maxQty,
                stepSize: pairDetails.stepSize,
                tickSize: pairDetails.tickSize,
                minNotional: pairDetails.minNotional
            };
        } catch (error) {
            console.warn(`Failed to get validation rules for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Get market summary for dashboard
     */
    async getMarketSummary() {
        return withErrorHandling(async () => {
            const topPairs = await liveTradingPairsService.getTradingPairs({
                maxResults: 10,
                sortBy: 'volume_desc'
            });

            const summary = {
                totalPairs: topPairs.length,
                totalVolume: topPairs.reduce((sum, pair) => sum + pair.volume24h, 0),
                topGainers: topPairs
                    .filter(pair => pair.priceChange24h > 0)
                    .sort((a, b) => b.priceChange24h - a.priceChange24h)
                    .slice(0, 3),
                topLosers: topPairs
                    .filter(pair => pair.priceChange24h < 0)
                    .sort((a, b) => a.priceChange24h - b.priceChange24h)
                    .slice(0, 3),
                timestamp: Date.now()
            };

            return summary;
        }, { operation: 'get_market_summary' });
    }

    /**
     * Cleanup and shutdown
     */
    async cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        await liveTradingPairsService.cleanup();
        this.watchedPairs.clear();
        this.priceAlerts.clear();
        this.marketDataCache.clear();
        this.isInitialized = false;
    }

    /**
     * Health check for the service
     */
    async healthCheck() {
        try {
            // Test API connectivity
            const testPairs = await liveTradingPairsService.getTradingPairs({
                maxResults: 1
            });

            return {
                status: 'healthy',
                timestamp: Date.now(),
                pairsAvailable: testPairs.length > 0,
                watchedPairs: this.watchedPairs.size,
                activeAlerts: Array.from(this.priceAlerts.values()).flat().filter(a => a.enabled).length
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                timestamp: Date.now(),
                error: error.message
            };
        }
    }
}

// Global service instance
export const integrationService = new IntegrationService();
export default integrationService;

// Utility functions for components
export const useLiveMarketData = (symbol) => {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const pairData = await liveTradingPairsService.getTradingPairDetails(symbol);
                setData(pairData);
            } catch (error) {
                console.error('Failed to fetch market data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (symbol) {
            fetchData();
            integrationService.addToWatchList(symbol);
        }

        return () => {
            if (symbol) {
                integrationService.removeFromWatchList(symbol);
            }
        };
    }, [symbol]);

    return { data, loading };
};

export const useMarketSummary = () => {
    const [summary, setSummary] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchSummary = async () => {
            try {
                const marketSummary = await integrationService.getMarketSummary();
                setSummary(marketSummary);
            } catch (error) {
                console.error('Failed to fetch market summary:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();

        // Update every 5 minutes
        const interval = setInterval(fetchSummary, 300000);
        return () => clearInterval(interval);
    }, []);

    return { summary, loading };
};