// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import EventEmitter from 'events';

/**
 * Professional-grade market data service
 * Inspired by Bloomberg Terminal and TradingView architecture
 */
class ProfessionalDataService extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
        this.subscriptions = new Map();
        this.dataFeeds = {
            primary: null,
            secondary: null,
            tertiary: null
        };
        this.latencyMonitor = new LatencyMonitor();
        this.dataQualityTracker = new DataQualityTracker();
        this.isInitialized = false;
    }

    /**
     * Initialize multiple data sources with failover
     */
    async initialize() {
        console.log('Initializing professional data feeds...');

        // Primary: Real-time WebSocket feeds
        await this.initializePrimaryFeeds();

        // Secondary: REST API fallbacks
        await this.initializeSecondaryFeeds();

        // Tertiary: Cache and offline data
        await this.initializeTertiaryFeeds();

        this.isInitialized = true;
        this.emit('initialized');
    }

    /**
     * Primary data feeds - WebSocket connections for real-time data
     */
    async initializePrimaryFeeds() {
        const feeds = [
            {
                name: 'binance_ws',
                url: 'wss://stream.binance.com:9443/ws/',
                priority: 1,
                latencyTarget: 50 // ms
            },
            {
                name: 'coinbase_ws',
                url: 'wss://ws-feed.pro.coinbase.com',
                priority: 2,
                latencyTarget: 100
            },
            {
                name: 'kraken_ws',
                url: 'wss://ws.kraken.com',
                priority: 3,
                latencyTarget: 150
            }
        ];

        for (const feed of feeds) {
            try {
                const connection = await this.createWebSocketConnection(feed);
                this.connections.set(feed.name, connection);
                console.log(`✓ Connected to ${feed.name}`);
            } catch (error) {
                console.warn(`Failed to connect to ${feed.name}:`, error.message);
            }
        }
    }

    /**
     * Create optimized WebSocket connection
     */
    async createWebSocketConnection(feed) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(feed.url);
            const connection = {
                ws,
                feed,
                lastPing: Date.now(),
                latency: 0,
                status: 'connecting'
            };

            ws.onopen = () => {
                connection.status = 'connected';
                this.setupHeartbeat(connection);
                resolve(connection);
            };

            ws.onmessage = (event) => {
                this.handleRealtimeData(event.data, feed.name);
            };

            ws.onerror = (error) => {
                connection.status = 'error';
                reject(error);
            };

            ws.onclose = () => {
                connection.status = 'disconnected';
                this.handleDisconnection(feed.name);
            };
        });
    }

    /**
     * Handle real-time market data with microsecond precision
     */
    handleRealtimeData(rawData, source) {
        const receiveTime = performance.now();

        try {
            const data = JSON.parse(rawData);
            const processedData = this.processMarketData(data, source, receiveTime);

            // Emit to subscribers with source attribution
            this.emit('marketData', {
                ...processedData,
                source,
                receiveTime,
                latency: this.latencyMonitor.getLatency(source)
            });

            // Update data quality metrics
            this.dataQualityTracker.recordDataPoint(source, processedData);

        } catch (error) {
            console.error(`Failed to process data from ${source}:`, error);
        }
    }

    /**
     * Process and normalize market data from different sources
     */
    processMarketData(rawData, source) {
        const processors = {
            binance_ws: this.processBinanceData,
            coinbase_ws: this.processCoinbaseData,
            kraken_ws: this.processKrakenData
        };

        const processor = processors[source];
        if (!processor) {
            throw new Error(`No processor for source: ${source}`);
        }

        return processor.call(this, rawData);
    }

    /**
     * Subscribe to specific symbols with real-time updates
     */
    subscribe(symbol, options = {}) {
        const subscription = {
            symbol: symbol.toUpperCase(),
            options,
            subscribers: new Set(),
            lastUpdate: null,
            dataPoints: []
        };

        this.subscriptions.set(symbol, subscription);

        // Subscribe on all available connections
        this.connections.forEach((connection, source) => {
            this.subscribeOnConnection(connection, symbol, options);
        });

        return {
            symbol,
            unsubscribe: () => this.unsubscribe(symbol)
        };
    }

    /**
     * Get aggregated market data with quality scoring
     */
    getAggregatedData(symbol) {
        const subscription = this.subscriptions.get(symbol);
        if (!subscription || !subscription.dataPoints.length) {
            return null;
        }

        // Aggregate data from multiple sources
        const sources = [...new Set(subscription.dataPoints.map(dp => dp.source))];
        const aggregated = {
            symbol,
            price: this.calculateWeightedAverage(subscription.dataPoints, 'price'),
            volume: this.sumBySource(subscription.dataPoints, 'volume'),
            spread: this.calculateSpread(subscription.dataPoints),
            sources: sources.length,
            quality: this.dataQualityTracker.getQualityScore(symbol),
            lastUpdate: Math.max(...subscription.dataPoints.map(dp => dp.timestamp))
        };

        return aggregated;
    }

    /**
     * Calculate weighted average based on source reliability
     */
    calculateWeightedAverage(dataPoints, field) {
        const weights = {
            binance_ws: 0.4,
            coinbase_ws: 0.35,
            kraken_ws: 0.25
        };

        const weightedSum = dataPoints.reduce((sum, dp) => {
            const weight = weights[dp.source] || 0.1;
            return sum + (dp[field] * weight);
        }, 0);

        const totalWeight = dataPoints.reduce((sum, dp) => {
            return sum + (weights[dp.source] || 0.1);
        }, 0);

        return weightedSum / totalWeight;
    }

    /**
     * Setup heartbeat monitoring for connection health
     */
    setupHeartbeat(connection) {
        const heartbeat = setInterval(() => {
            if (connection.ws.readyState === WebSocket.OPEN) {
                const pingTime = Date.now();
                connection.ws.ping();
                connection.lastPing = pingTime;
            } else {
                clearInterval(heartbeat);
            }
        }, 30000); // 30-second heartbeat

        connection.heartbeat = heartbeat;
    }

    /**
     * Get current latency statistics
     */
    getLatencyStats() {
        return this.latencyMonitor.getStats();
    }

    /**
     * Get data quality report
     */
    getDataQualityReport() {
        return this.dataQualityTracker.getReport();
    }
}

/**
 * Latency monitoring for professional trading requirements
 */
class LatencyMonitor {
    constructor() {
        this.measurements = new Map();
    }

    recordLatency(source, latency) {
        if (!this.measurements.has(source)) {
            this.measurements.set(source, []);
        }

        const measurements = this.measurements.get(source);
        measurements.push({
            latency,
            timestamp: Date.now()
        });

        // Keep only last 1000 measurements
        if (measurements.length > 1000) {
            measurements.splice(0, measurements.length - 1000);
        }
    }

    getLatency(source) {
        const measurements = this.measurements.get(source);
        if (!measurements || measurements.length === 0) return null;

        const recent = measurements.slice(-10); // Last 10 measurements
        return recent.reduce((sum, m) => sum + m.latency, 0) / recent.length;
    }

    getStats() {
        const stats = {};

        this.measurements.forEach((measurements, source) => {
            if (measurements.length === 0) return;

            const latencies = measurements.map(m => m.latency);
            stats[source] = {
                avg: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
                min: Math.min(...latencies),
                max: Math.max(...latencies),
                p95: this.percentile(latencies, 0.95),
                p99: this.percentile(latencies, 0.99)
            };
        });

        return stats;
    }

    percentile(arr, p) {
        const sorted = arr.sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[index];
    }
}

/**
 * Data quality tracking for institutional standards
 */
class DataQualityTracker {
    constructor() {
        this.qualityMetrics = new Map();
    }

    recordDataPoint(source, data) {
        const symbol = data.symbol;
        const key = `${symbol}_${source}`;

        if (!this.qualityMetrics.has(key)) {
            this.qualityMetrics.set(key, {
                totalPoints: 0,
                errorCount: 0,
                gapCount: 0,
                lastTimestamp: null,
                priceValidation: { valid: 0, invalid: 0 }
            });
        }

        const metrics = this.qualityMetrics.get(key);
        metrics.totalPoints++;

        // Validate data quality
        if (this.isValidPrice(data.price)) {
            metrics.priceValidation.valid++;
        } else {
            metrics.priceValidation.invalid++;
            metrics.errorCount++;
        }

        // Check for gaps
        if (metrics.lastTimestamp && data.timestamp - metrics.lastTimestamp > 5000) {
            metrics.gapCount++;
        }

        metrics.lastTimestamp = data.timestamp;
    }

    isValidPrice(price) {
        return typeof price === 'number' && price > 0 && !isNaN(price) && isFinite(price);
    }

    getQualityScore(symbol) {
        const sourceScores = [];

        this.qualityMetrics.forEach((metrics, key) => {
            if (key.startsWith(symbol)) {
                const score = this.calculateSourceScore(metrics);
                sourceScores.push(score);
            }
        });

        if (sourceScores.length === 0) return 0;
        return sourceScores.reduce((sum, score) => sum + score, 0) / sourceScores.length;
    }

    calculateSourceScore(metrics) {
        if (metrics.totalPoints === 0) return 0;

        const accuracyScore = metrics.priceValidation.valid / metrics.totalPoints;
        const reliabilityScore = 1 - (metrics.errorCount / metrics.totalPoints);
        const continuityScore = 1 - (metrics.gapCount / (metrics.totalPoints / 100));

        return (accuracyScore * 0.4 + reliabilityScore * 0.4 + continuityScore * 0.2) * 100;
    }

    getReport() {
        const report = {
            totalSources: this.qualityMetrics.size,
            averageQuality: 0,
            sourceDetails: {}
        };

        let totalQuality = 0;
        let sourceCount = 0;

        this.qualityMetrics.forEach((metrics, key) => {
            const score = this.calculateSourceScore(metrics);
            totalQuality += score;
            sourceCount++;

            report.sourceDetails[key] = {
                score,
                totalPoints: metrics.totalPoints,
                accuracy: metrics.priceValidation.valid / metrics.totalPoints,
                gaps: metrics.gapCount
            };
        });

        report.averageQuality = sourceCount > 0 ? totalQuality / sourceCount : 0;
        return report;
    }
}

// Global service instance
export const professionalDataService = new ProfessionalDataService();
export default professionalDataService;