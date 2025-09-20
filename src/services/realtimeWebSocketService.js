// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

/**
 * Advanced WebSocket service for real-time trading data
 * Bypasses CORS and provides institutional-grade data feeds
 */
class RealtimeWebSocketService {
    constructor() {
        this.connections = new Map();
        this.subscriptions = new Map();
        this.messageQueue = [];
        this.reconnectAttempts = new Map();
        this.maxReconnectAttempts = 5;
        this.isElectronAvailable = typeof window !== 'undefined' && window.electronAPI;
    }

    /**
     * Initialize WebSocket connections through Electron main process
     */
    async initialize() {
        if (!this.isElectronAvailable) {
            console.warn('Electron API not available. WebSocket connections will be limited by CORS.');
            return this.initializeBrowserWebSockets();
        }

        console.log('Initializing WebSocket connections via Electron...');

        const feeds = [
            {
                name: 'binance_spot',
                url: 'wss://stream.binance.com:9443/ws',
                active: true
            },
            {
                name: 'binance_futures',
                url: 'wss://fstream.binance.com/ws',
                active: false // Enable for futures trading
            }
        ];

        for (const feed of feeds) {
            if (feed.active) {
                await this.createElectronWebSocket(feed);
            }
        }
    }

    /**
     * Create WebSocket connection via Electron main process
     */
    async createElectronWebSocket(feed) {
        try {
            // Use Electron's main process to create WebSocket
            const connectionId = await window.electronAPI.websocket.create({
                url: feed.url,
                name: feed.name
            });

            const connection = {
                id: connectionId,
                name: feed.name,
                url: feed.url,
                status: 'connected',
                lastMessage: Date.now(),
                reconnectCount: 0
            };

            this.connections.set(feed.name, connection);

            // Listen for messages from this connection
            window.electronAPI.websocket.onMessage(connectionId, (data) => {
                this.handleWebSocketMessage(data, feed.name);
            });

            // Listen for connection events
            window.electronAPI.websocket.onClose(connectionId, () => {
                this.handleWebSocketClose(feed.name);
            });

            window.electronAPI.websocket.onError(connectionId, (error) => {
                this.handleWebSocketError(feed.name, error);
            });

            console.log(`✓ WebSocket connected: ${feed.name}`);
            return connection;

        } catch (error) {
            console.error(`Failed to create WebSocket for ${feed.name}:`, error);
            throw error;
        }
    }

    /**
     * Fallback browser WebSocket (limited by CORS)
     */
    initializeBrowserWebSockets() {
        console.log('Initializing browser WebSockets (CORS-limited)...');

        // Only public endpoints that allow CORS
        const publicFeeds = [
            {
                name: 'binance_public',
                url: 'wss://stream.binance.com:9443/ws/bnbusdt@ticker'
            }
        ];

        publicFeeds.forEach(feed => {
            this.createBrowserWebSocket(feed);
        });
    }

    /**
     * Create browser WebSocket connection
     */
    createBrowserWebSocket(feed) {
        try {
            const ws = new WebSocket(feed.url);

            const connection = {
                ws,
                name: feed.name,
                url: feed.url,
                status: 'connecting',
                lastMessage: Date.now(),
                reconnectCount: 0
            };

            ws.onopen = () => {
                connection.status = 'connected';
                console.log(`✓ Browser WebSocket connected: ${feed.name}`);
            };

            ws.onmessage = (event) => {
                this.handleWebSocketMessage(event.data, feed.name);
            };

            ws.onclose = () => {
                this.handleWebSocketClose(feed.name);
            };

            ws.onerror = (error) => {
                this.handleWebSocketError(feed.name, error);
            };

            this.connections.set(feed.name, connection);

        } catch (error) {
            console.error(`Failed to create browser WebSocket for ${feed.name}:`, error);
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleWebSocketMessage(data, source) {
        const timestamp = performance.now();

        try {
            const message = typeof data === 'string' ? JSON.parse(data) : data;

            // Process different message types
            if (message.e) { // Binance event type
                this.processBinanceMessage(message, source, timestamp);
            } else {
                this.processGenericMessage(message, source, timestamp);
            }

        } catch (error) {
            console.error(`Failed to process WebSocket message from ${source}:`, error);
        }
    }

    /**
     * Process Binance-specific messages
     */
    processBinanceMessage(message, source, timestamp) {
        const eventType = message.e;

        switch (eventType) {
            case '24hrTicker':
                this.emit('priceUpdate', {
                    symbol: message.s,
                    price: parseFloat(message.c),
                    change: parseFloat(message.P),
                    volume: parseFloat(message.v),
                    high: parseFloat(message.h),
                    low: parseFloat(message.l),
                    source,
                    timestamp,
                    eventType
                });
                break;

            case 'kline':
                this.emit('candleUpdate', {
                    symbol: message.s,
                    interval: message.k.i,
                    open: parseFloat(message.k.o),
                    high: parseFloat(message.k.h),
                    low: parseFloat(message.k.l),
                    close: parseFloat(message.k.c),
                    volume: parseFloat(message.k.v),
                    source,
                    timestamp,
                    isClosed: message.k.x
                });
                break;

            case 'depthUpdate':
                this.emit('orderBookUpdate', {
                    symbol: message.s,
                    bids: message.b.map(([price, qty]) => [parseFloat(price), parseFloat(qty)]),
                    asks: message.a.map(([price, qty]) => [parseFloat(price), parseFloat(qty)]),
                    source,
                    timestamp
                });
                break;

            case 'trade':
                this.emit('tradeUpdate', {
                    symbol: message.s,
                    price: parseFloat(message.p),
                    quantity: parseFloat(message.q),
                    isBuyerMaker: message.m,
                    source,
                    timestamp
                });
                break;

            default:
                console.log(`Unhandled Binance message type: ${eventType}`);
        }
    }

    /**
     * Subscribe to real-time price feeds
     */
    async subscribeToPrices(symbols) {
        if (!Array.isArray(symbols)) symbols = [symbols];

        if (this.isElectronAvailable) {
            return this.subscribeViaElectron(symbols);
        } else {
            return this.subscribeViaBrowser(symbols);
        }
    }

    /**
     * Subscribe via Electron main process
     */
    async subscribeViaElectron(symbols) {
        const binanceConnection = this.connections.get('binance_spot');
        if (!binanceConnection) {
            throw new Error('Binance WebSocket not connected');
        }

        // Create subscription streams
        const streams = symbols.map(symbol => {
            const baseSymbol = symbol.toLowerCase();
            return [
                `${baseSymbol}@ticker`,      // 24hr ticker
                `${baseSymbol}@kline_1m`,    // 1-minute klines
                `${baseSymbol}@depth20@100ms`, // Order book depth
                `${baseSymbol}@trade`        // Individual trades
            ];
        }).flat();

        try {
            await window.electronAPI.websocket.subscribe(binanceConnection.id, {
                method: 'SUBSCRIBE',
                params: streams,
                id: Date.now()
            });

            // Track subscriptions
            symbols.forEach(symbol => {
                this.subscriptions.set(symbol, {
                    streams,
                    active: true,
                    subscribeTime: Date.now()
                });
            });

            console.log(`✓ Subscribed to ${symbols.length} symbols via Electron`);
            return { success: true, symbols, streams: streams.length };

        } catch (error) {
            console.error('Failed to subscribe via Electron:', error);
            throw error;
        }
    }

    /**
     * Subscribe via browser (limited)
     */
    subscribeViaBrowser(symbols) {
        console.log('Browser WebSocket subscriptions are limited due to CORS');

        // For browser mode, we'd need to use public streams only
        symbols.forEach(symbol => {
            this.subscriptions.set(symbol, {
                active: true,
                subscribeTime: Date.now(),
                limitation: 'Browser CORS restrictions apply'
            });
        });

        return { success: true, symbols, limitation: 'Limited by CORS' };
    }

    /**
     * Unsubscribe from symbols
     */
    async unsubscribe(symbols) {
        if (!Array.isArray(symbols)) symbols = [symbols];

        if (this.isElectronAvailable) {
            const binanceConnection = this.connections.get('binance_spot');
            if (binanceConnection) {
                const streams = symbols.map(symbol => {
                    const baseSymbol = symbol.toLowerCase();
                    return [
                        `${baseSymbol}@ticker`,
                        `${baseSymbol}@kline_1m`,
                        `${baseSymbol}@depth20@100ms`,
                        `${baseSymbol}@trade`
                    ];
                }).flat();

                await window.electronAPI.websocket.unsubscribe(binanceConnection.id, {
                    method: 'UNSUBSCRIBE',
                    params: streams,
                    id: Date.now()
                });
            }
        }

        symbols.forEach(symbol => {
            this.subscriptions.delete(symbol);
        });
    }

    /**
     * Handle WebSocket disconnection
     */
    handleWebSocketClose(feedName) {
        const connection = this.connections.get(feedName);
        if (connection) {
            connection.status = 'disconnected';
            console.warn(`WebSocket disconnected: ${feedName}`);

            // Attempt reconnection
            this.attemptReconnection(feedName);
        }
    }

    /**
     * Handle WebSocket errors
     */
    handleWebSocketError(feedName, error) {
        console.error(`WebSocket error on ${feedName}:`, error);
        this.emit('connectionError', { feedName, error });
    }

    /**
     * Attempt to reconnect WebSocket
     */
    async attemptReconnection(feedName) {
        const reconnectCount = this.reconnectAttempts.get(feedName) || 0;

        if (reconnectCount >= this.maxReconnectAttempts) {
            console.error(`Max reconnection attempts reached for ${feedName}`);
            return;
        }

        this.reconnectAttempts.set(feedName, reconnectCount + 1);

        console.log(`Attempting to reconnect ${feedName} (attempt ${reconnectCount + 1})`);

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectCount), 30000);

        setTimeout(async () => {
            try {
                const connection = this.connections.get(feedName);
                if (connection) {
                    if (this.isElectronAvailable) {
                        await this.createElectronWebSocket({
                            name: feedName,
                            url: connection.url
                        });
                    } else {
                        this.createBrowserWebSocket({
                            name: feedName,
                            url: connection.url
                        });
                    }

                    // Reset reconnect count on success
                    this.reconnectAttempts.set(feedName, 0);
                }
            } catch (error) {
                console.error(`Reconnection failed for ${feedName}:`, error);
            }
        }, delay);
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        const status = {};

        this.connections.forEach((connection, name) => {
            status[name] = {
                status: connection.status,
                reconnectCount: this.reconnectAttempts.get(name) || 0,
                lastMessage: connection.lastMessage,
                uptime: Date.now() - connection.lastMessage
            };
        });

        return status;
    }

    /**
     * Get active subscriptions
     */
    getActiveSubscriptions() {
        return Array.from(this.subscriptions.keys());
    }

    /**
     * Simple event emitter functionality
     */
    emit(event, data) {
        if (this.listeners && this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    on(event, callback) {
        if (!this.listeners) this.listeners = {};
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (this.listeners && this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Cleanup and close all connections
     */
    async cleanup() {
        console.log('Cleaning up WebSocket connections...');

        if (this.isElectronAvailable) {
            // Close all Electron WebSocket connections
            for (const [name, connection] of this.connections) {
                try {
                    await window.electronAPI.websocket.close(connection.id);
                } catch (error) {
                    console.error(`Failed to close WebSocket ${name}:`, error);
                }
            }
        } else {
            // Close browser WebSocket connections
            this.connections.forEach((connection, name) => {
                if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
                    connection.ws.close();
                }
            });
        }

        this.connections.clear();
        this.subscriptions.clear();
        this.reconnectAttempts.clear();
    }
}

// Global service instance
export const realtimeWebSocketService = new RealtimeWebSocketService();
export default realtimeWebSocketService;