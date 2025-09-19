// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import { withErrorHandling, withRetry } from '../utils/errorHandler';
import { storageService } from './storageService';

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
const COINMARKETCAP_API_BASE = 'https://pro-api.coinmarketcap.com/v1';
const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// Cache duration in milliseconds
const CACHE_DURATION = {
    EXCHANGE_INFO: 24 * 60 * 60 * 1000, // 24 hours
    MARKET_DATA: 5 * 60 * 1000,         // 5 minutes
    PRICE_DATA: 30 * 1000,              // 30 seconds
    VOLUME_DATA: 60 * 1000              // 1 minute
};

class LiveTradingPairsService {
    constructor() {
        this.cache = new Map();
        this.coinGeckoApiKey = null; // Optional, for higher rate limits
        this.coinMarketCapApiKey = null; // Required for CMC
        this.lastUpdate = new Map();
        this.rateLimits = {
            coinGecko: { requests: 0, resetTime: 0, limit: 10 }, // 10 requests per minute for free tier
            coinMarketCap: { requests: 0, resetTime: 0, limit: 333 }, // 333 requests per day for basic plan
            binance: { requests: 0, resetTime: 0, limit: 1200 } // 1200 requests per minute
        };
    }

    /**
     * Initialize the service with API keys
     */
    async initialize(config = {}) {
        this.coinGeckoApiKey = config.coinGeckoApiKey;
        this.coinMarketCapApiKey = config.coinMarketCapApiKey;

        // Load cached data on startup
        await this.loadCachedData();

        // Fetch initial exchange info
        await this.fetchBinanceExchangeInfo();

        console.log('Live Trading Pairs Service initialized');
    }

    /**
     * Get all available trading pairs with live market data
     */
    async getTradingPairs(options = {}) {
        const {
            includeInactive = false,
            minVolume = 1000000, // Minimum 24h volume in USDT
            maxResults = 50,
            sortBy = 'volume_desc'
        } = options;

        return withErrorHandling(async () => {
            // Get Binance exchange info
            const exchangeInfo = await this.getBinanceExchangeInfo();

            // Filter for USDT pairs only (most liquid)
            const usdtPairs = exchangeInfo.symbols.filter(symbol =>
                symbol.quoteAsset === 'USDT' &&
                symbol.status === 'TRADING' &&
                !symbol.isSpotTradingAllowed === false
            );

            // Get market data for these pairs
            const marketData = await this.getMarketData(usdtPairs.map(s => s.symbol));

            // Combine exchange info with market data
            const tradingPairs = usdtPairs.map(symbol => {
                const market = marketData.find(m => m.symbol === symbol.symbol);
                return this.createTradingPair(symbol, market);
            }).filter(pair => {
                // Apply filters
                if (!includeInactive && !pair.isActive) return false;
                if (pair.volume24h < minVolume) return false;
                return true;
            });

            // Sort pairs
            this.sortTradingPairs(tradingPairs, sortBy);

            // Limit results
            return tradingPairs.slice(0, maxResults);
        }, { operation: 'get_trading_pairs' });
    }

    /**
     * Get detailed information for a specific trading pair
     */
    async getTradingPairDetails(symbol) {
        return withErrorHandling(async () => {
            const [exchangeInfo, marketData, coinData] = await Promise.all([
                this.getBinanceSymbolInfo(symbol),
                this.getSymbolMarketData(symbol),
                this.getCoinGeckoData(symbol)
            ]);

            return this.createDetailedTradingPair(exchangeInfo, marketData, coinData);
        }, { operation: 'get_trading_pair_details', symbol });
    }

    /**
     * Get live price data for multiple symbols
     */
    async getLivePrices(symbols) {
        return withErrorHandling(async () => {
            const cacheKey = `prices_${symbols.sort().join('_')}`;

            if (this.isCacheValid(cacheKey, CACHE_DURATION.PRICE_DATA)) {
                return this.cache.get(cacheKey);
            }

            const response = await this.binanceRequest('/ticker/price');
            const allPrices = response.data;

            const requestedPrices = symbols.reduce((acc, symbol) => {
                const price = allPrices.find(p => p.symbol === symbol);
                if (price) {
                    acc[symbol] = {
                        symbol: price.symbol,
                        price: parseFloat(price.price),
                        timestamp: Date.now()
                    };
                }
                return acc;
            }, {});

            this.cache.set(cacheKey, requestedPrices);
            this.lastUpdate.set(cacheKey, Date.now());

            return requestedPrices;
        }, { operation: 'get_live_prices', symbols });
    }

    /**
     * Get 24h ticker statistics
     */
    async get24hStats(symbols) {
        return withErrorHandling(async () => {
            const cacheKey = `stats_24h_${symbols.sort().join('_')}`;

            if (this.isCacheValid(cacheKey, CACHE_DURATION.VOLUME_DATA)) {
                return this.cache.get(cacheKey);
            }

            const response = await this.binanceRequest('/ticker/24hr');
            const allStats = response.data;

            const requestedStats = symbols.reduce((acc, symbol) => {
                const stats = allStats.find(s => s.symbol === symbol);
                if (stats) {
                    acc[symbol] = {
                        symbol: stats.symbol,
                        priceChange: parseFloat(stats.priceChange),
                        priceChangePercent: parseFloat(stats.priceChangePercent),
                        weightedAvgPrice: parseFloat(stats.weightedAvgPrice),
                        prevClosePrice: parseFloat(stats.prevClosePrice),
                        lastPrice: parseFloat(stats.lastPrice),
                        bidPrice: parseFloat(stats.bidPrice),
                        askPrice: parseFloat(stats.askPrice),
                        openPrice: parseFloat(stats.openPrice),
                        highPrice: parseFloat(stats.highPrice),
                        lowPrice: parseFloat(stats.lowPrice),
                        volume: parseFloat(stats.volume),
                        quoteVolume: parseFloat(stats.quoteVolume),
                        count: parseInt(stats.count),
                        timestamp: Date.now()
                    };
                }
                return acc;
            }, {});

            this.cache.set(cacheKey, requestedStats);
            this.lastUpdate.set(cacheKey, Date.now());

            return requestedStats;
        }, { operation: 'get_24h_stats', symbols });
    }

    /**
     * Get market data from CoinGecko
     */
    async getCoinGeckoMarketData(symbols) {
        return withRetry(async () => {
            await this.checkRateLimit('coinGecko');

            // Convert Binance symbols to CoinGecko IDs
            const coinIds = await this.symbolsToCoinGeckoIds(symbols);

            const params = new URLSearchParams({
                ids: coinIds.join(','),
                vs_currency: 'usd',
                include_24hr_vol: 'true',
                include_24hr_change: 'true',
                include_market_cap: 'true'
            });

            if (this.coinGeckoApiKey) {
                params.append('x_cg_pro_api_key', this.coinGeckoApiKey);
            }

            const response = await fetch(`${COINGECKO_API_BASE}/coins/markets?${params}`);

            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
            }

            this.updateRateLimit('coinGecko');
            return await response.json();
        });
    }

    /**
     * Get data from CoinMarketCap
     */
    async getCoinMarketCapData(symbols) {
        if (!this.coinMarketCapApiKey) {
            console.warn('CoinMarketCap API key not provided, skipping CMC data');
            return [];
        }

        return withRetry(async () => {
            await this.checkRateLimit('coinMarketCap');

            const params = new URLSearchParams({
                symbol: symbols.map(s => s.replace('USDT', '')).join(','),
                convert: 'USD'
            });

            const response = await fetch(`${COINMARKETCAP_API_BASE}/cryptocurrency/quotes/latest?${params}`, {
                headers: {
                    'X-CMC_PRO_API_KEY': this.coinMarketCapApiKey,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`CoinMarketCap API error: ${response.status} ${response.statusText}`);
            }

            this.updateRateLimit('coinMarketCap');
            const data = await response.json();
            return data.data;
        });
    }

    /**
     * Get Binance exchange information
     */
    async getBinanceExchangeInfo() {
        const cacheKey = 'binance_exchange_info';

        if (this.isCacheValid(cacheKey, CACHE_DURATION.EXCHANGE_INFO)) {
            return this.cache.get(cacheKey);
        }

        const response = await this.binanceRequest('/exchangeInfo');
        const data = response.data;

        this.cache.set(cacheKey, data);
        this.lastUpdate.set(cacheKey, Date.now());

        return data;
    }

    /**
     * Make a request to Binance API with rate limiting
     */
    async binanceRequest(endpoint, params = {}) {
        await this.checkRateLimit('binance');

        const url = new URL(`${BINANCE_API_BASE}${endpoint}`);
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
        }

        this.updateRateLimit('binance');
        return { data: await response.json() };
    }

    /**
     * Create a trading pair object from exchange and market data
     */
    createTradingPair(symbolInfo, marketData) {
        const baseAsset = symbolInfo.baseAsset;
        const quoteAsset = symbolInfo.quoteAsset;

        // Extract trading constraints
        const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
        const priceFilter = symbolInfo.filters.find(f => f.filterType === 'PRICE_FILTER');
        const notionalFilter = symbolInfo.filters.find(f => f.filterType === 'MIN_NOTIONAL');

        const pair = {
            symbol: symbolInfo.symbol,
            baseAsset,
            quoteAsset,
            displayName: `${baseAsset} / ${quoteAsset}`,
            isActive: symbolInfo.status === 'TRADING',

            // Trading constraints
            minQty: parseFloat(lotSizeFilter?.minQty || '0'),
            maxQty: parseFloat(lotSizeFilter?.maxQty || '999999999'),
            stepSize: parseFloat(lotSizeFilter?.stepSize || '1'),
            tickSize: parseFloat(priceFilter?.tickSize || '0.01'),
            minNotional: parseFloat(notionalFilter?.minNotional || '10'),

            // Market data
            price: marketData ? parseFloat(marketData.lastPrice) : 0,
            volume24h: marketData ? parseFloat(marketData.quoteVolume) : 0,
            priceChange24h: marketData ? parseFloat(marketData.priceChangePercent) : 0,
            high24h: marketData ? parseFloat(marketData.highPrice) : 0,
            low24h: marketData ? parseFloat(marketData.lowPrice) : 0,

            // Calculated fields
            category: this.categorizeAsset(baseAsset),
            riskLevel: this.calculateRiskLevel(marketData),
            volatility: this.calculateVolatility(marketData),
            defaultAmount: this.getDefaultAmount(baseAsset, marketData),

            // Metadata
            lastUpdated: Date.now(),
            dataSource: 'binance_live'
        };

        return pair;
    }

    /**
     * Create detailed trading pair with additional market data
     */
    createDetailedTradingPair(exchangeInfo, marketData, coinData) {
        const basicPair = this.createTradingPair(exchangeInfo, marketData);

        // Add CoinGecko data if available
        if (coinData) {
            return {
                ...basicPair,
                marketCap: coinData.market_cap,
                marketCapRank: coinData.market_cap_rank,
                totalSupply: coinData.total_supply,
                circulatingSupply: coinData.circulating_supply,
                description: coinData.description?.en,
                website: coinData.links?.homepage?.[0],
                whitepaper: coinData.links?.whitepaper,
                githubRepos: coinData.links?.repos_url?.github,
                allTimeHigh: coinData.ath,
                allTimeLow: coinData.atl,
                priceChange7d: coinData.price_change_percentage_7d,
                priceChange30d: coinData.price_change_percentage_30d,
                volume7dAvg: coinData.total_volume,
                developers: coinData.developer_data,
                communityData: coinData.community_data
            };
        }

        return basicPair;
    }

    /**
     * Categorize assets based on their characteristics
     */
    categorizeAsset(baseAsset) {
        const categories = {
            major: ['BTC', 'ETH', 'BNB', 'ADA', 'DOT', 'SOL', 'AVAX'],
            defi: ['UNI', 'LINK', 'AAVE', 'COMP', 'MKR', 'SNX', 'YFI', 'SUSHI'],
            layer2: ['MATIC', 'LRC', 'OMG', 'METIS'],
            exchange: ['BNB', 'FTT', 'CRO', 'HT', 'OKB', 'LEO'],
            meme: ['DOGE', 'SHIB', 'FLOKI', 'PEPE'],
            gaming: ['AXS', 'SAND', 'MANA', 'ENJ', 'GALA'],
            ai: ['FET', 'OCEAN', 'AGI', 'NMR'],
            privacy: ['XMR', 'ZEC', 'DASH', 'SCRT']
        };

        for (const [category, assets] of Object.entries(categories)) {
            if (assets.includes(baseAsset)) {
                return category;
            }
        }

        return 'other';
    }

    /**
     * Calculate risk level based on market data
     */
    calculateRiskLevel(marketData) {
        if (!marketData) return 'unknown';

        const volume = parseFloat(marketData.quoteVolume);
        const priceChange = Math.abs(parseFloat(marketData.priceChangePercent));

        // Risk scoring based on volume and volatility
        let riskScore = 0;

        // Volume risk (lower volume = higher risk)
        if (volume < 1000000) riskScore += 2;
        else if (volume < 10000000) riskScore += 1;

        // Volatility risk
        if (priceChange > 20) riskScore += 2;
        else if (priceChange > 10) riskScore += 1;

        if (riskScore >= 3) return 'very-high';
        if (riskScore >= 2) return 'high';
        if (riskScore >= 1) return 'medium';
        return 'low';
    }

    /**
     * Calculate volatility level
     */
    calculateVolatility(marketData) {
        if (!marketData) return 'unknown';

        const priceChange = Math.abs(parseFloat(marketData.priceChangePercent));

        if (priceChange > 15) return 'very-high';
        if (priceChange > 8) return 'high';
        if (priceChange > 3) return 'medium';
        if (priceChange > 1) return 'low';
        return 'very-low';
    }

    /**
     * Get default trading amount for an asset
     */
    getDefaultAmount(baseAsset, marketData) {
        const price = marketData ? parseFloat(marketData.lastPrice) : 0;

        // Target ~$50 worth for default amount
        const targetValue = 50;

        if (price > 0) {
            const amount = targetValue / price;

            // Round to reasonable precision
            if (amount < 0.001) return Math.max(0.0001, Number(amount.toFixed(6)));
            if (amount < 0.1) return Number(amount.toFixed(4));
            if (amount < 10) return Number(amount.toFixed(2));
            return Math.floor(amount);
        }

        // Fallback defaults
        const defaults = {
            'BTC': 0.001,
            'ETH': 0.01,
            'BNB': 0.1,
            'ADA': 10,
            'DOT': 1,
            'SOL': 0.1
        };

        return defaults[baseAsset] || 1;
    }

    /**
     * Sort trading pairs by various criteria
     */
    sortTradingPairs(pairs, sortBy) {
        switch (sortBy) {
            case 'volume_desc':
                pairs.sort((a, b) => b.volume24h - a.volume24h);
                break;
            case 'volume_asc':
                pairs.sort((a, b) => a.volume24h - b.volume24h);
                break;
            case 'price_desc':
                pairs.sort((a, b) => b.price - a.price);
                break;
            case 'price_asc':
                pairs.sort((a, b) => a.price - b.price);
                break;
            case 'change_desc':
                pairs.sort((a, b) => b.priceChange24h - a.priceChange24h);
                break;
            case 'change_asc':
                pairs.sort((a, b) => a.priceChange24h - b.priceChange24h);
                break;
            case 'alphabetical':
                pairs.sort((a, b) => a.symbol.localeCompare(b.symbol));
                break;
            default:
                // Default to volume desc
                pairs.sort((a, b) => b.volume24h - a.volume24h);
        }
    }

    /**
     * Convert Binance symbols to CoinGecko coin IDs
     */
    async symbolsToCoinGeckoIds(symbols) {
        const cacheKey = 'coingecko_symbol_map';

        if (!this.isCacheValid(cacheKey, CACHE_DURATION.EXCHANGE_INFO)) {
            // Fetch mapping from CoinGecko
            const response = await fetch(`${COINGECKO_API_BASE}/coins/list`);
            const coins = await response.json();

            const symbolMap = new Map();
            coins.forEach(coin => {
                if (coin.symbol) {
                    symbolMap.set(coin.symbol.toUpperCase(), coin.id);
                }
            });

            this.cache.set(cacheKey, symbolMap);
            this.lastUpdate.set(cacheKey, Date.now());
        }

        const symbolMap = this.cache.get(cacheKey);

        return symbols
            .map(symbol => symbol.replace('USDT', ''))
            .map(symbol => symbolMap.get(symbol))
            .filter(id => id);
    }

    /**
     * Cache management
     */
    isCacheValid(key, duration) {
        const lastUpdate = this.lastUpdate.get(key);
        return lastUpdate && (Date.now() - lastUpdate) < duration;
    }

    async loadCachedData() {
        try {
            const cachedData = await storageService.getSetting('trading_pairs_cache');
            if (cachedData && cachedData.timestamp > Date.now() - CACHE_DURATION.EXCHANGE_INFO) {
                Object.entries(cachedData.data).forEach(([key, value]) => {
                    this.cache.set(key, value);
                    this.lastUpdate.set(key, cachedData.timestamp);
                });
            }
        } catch (error) {
            console.warn('Failed to load cached trading pairs data:', error);
        }
    }

    async saveCacheData() {
        try {
            const cacheData = {
                timestamp: Date.now(),
                data: Object.fromEntries(this.cache.entries())
            };
            await storageService.saveSetting('trading_pairs_cache', cacheData);
        } catch (error) {
            console.warn('Failed to save trading pairs cache:', error);
        }
    }

    /**
     * Rate limiting
     */
    async checkRateLimit(service) {
        const limit = this.rateLimits[service];
        const now = Date.now();

        // Reset counter if enough time has passed
        if (now > limit.resetTime) {
            limit.requests = 0;
            // Set next reset time based on service
            switch (service) {
                case 'coinGecko':
                    limit.resetTime = now + 60 * 1000; // 1 minute
                    break;
                case 'coinMarketCap':
                    limit.resetTime = now + 24 * 60 * 60 * 1000; // 24 hours
                    break;
                case 'binance':
                    limit.resetTime = now + 60 * 1000; // 1 minute
                    break;
            }
        }

        // Check if we've exceeded the limit
        if (limit.requests >= limit.limit) {
            const waitTime = limit.resetTime - now;
            console.warn(`Rate limit exceeded for ${service}, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            limit.requests = 0;
        }
    }

    updateRateLimit(service) {
        this.rateLimits[service].requests++;
    }

    /**
     * Get market data for specific symbols
     */
    async getMarketData(symbols) {
        const batchSize = 50; // Process in batches to avoid API limits
        const results = [];

        for (let i = 0; i < symbols.length; i += batchSize) {
            const batch = symbols.slice(i, i + batchSize);
            const stats = await this.get24hStats(batch);
            results.push(...Object.values(stats));
        }

        return results;
    }

    async getSymbolMarketData(symbol) {
        const stats = await this.get24hStats([symbol]);
        return stats[symbol];
    }

    async getBinanceSymbolInfo(symbol) {
        const exchangeInfo = await this.getBinanceExchangeInfo();
        return exchangeInfo.symbols.find(s => s.symbol === symbol);
    }

    async getCoinGeckoData(symbol) {
        try {
            const coinIds = await this.symbolsToCoinGeckoIds([symbol]);
            if (coinIds.length === 0) return null;

            const response = await fetch(`${COINGECKO_API_BASE}/coins/${coinIds[0]}`);
            if (!response.ok) return null;

            return await response.json();
        } catch (error) {
            console.warn(`Failed to fetch CoinGecko data for ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Cleanup and shutdown
     */
    async cleanup() {
        await this.saveCacheData();
        this.cache.clear();
        this.lastUpdate.clear();
    }
}

// Global service instance
export const liveTradingPairsService = new LiveTradingPairsService();
export default liveTradingPairsService;