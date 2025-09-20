// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * WebSocket manager for the main process
 * Handles all real-time connections and bypasses CORS completely
 */
class ElectronWebSocketManager extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
        this.nextConnectionId = 1;
        this.messageBuffer = new Map();
        this.setupCleanup();
    }

    /**
     * Create a new WebSocket connection
     */
    async createConnection(options) {
        const connectionId = `ws_${this.nextConnectionId++}`;

        try {
            console.log(`Creating WebSocket connection ${connectionId} to ${options.url}`);

            const ws = new WebSocket(options.url, {
                headers: {
                    'User-Agent': 'NeutronTrader/2.0.0'
                },
                handshakeTimeout: 10000,
                perMessageDeflate: false
            });

            const connection = {
                id: connectionId,
                ws,
                url: options.url,
                name: options.name,
                status: 'connecting',
                createdAt: Date.now(),
                lastMessage: null,
                messageCount: 0,
                reconnectAttempts: 0,
                subscriptions: new Set()
            };

            // Setup WebSocket event handlers
            this.setupWebSocketEvents(connection);

            // Store connection
            this.connections.set(connectionId, connection);

            console.log(`✓ WebSocket connection ${connectionId} created successfully`);
            return connectionId;

        } catch (error) {
            console.error(`Failed to create WebSocket connection:`, error);
            throw new Error(`WebSocket creation failed: ${error.message}`);
        }
    }

    /**
     * Setup WebSocket event handlers
     */
    setupWebSocketEvents(connection) {
        const { ws, id } = connection;

        ws.on('open', () => {
            console.log(`WebSocket ${id} connected to ${connection.url}`);
            connection.status = 'connected';
            connection.reconnectAttempts = 0;
            this.emit('connectionOpen', { connectionId: id });
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                connection.lastMessage = Date.now();
                connection.messageCount++;

                // Emit message to renderer process
                this.emit('message', {
                    connectionId: id,
                    data: message,
                    timestamp: Date.now()
                });

                // Buffer recent messages for debugging
                this.bufferMessage(id, message);

            } catch (error) {
                console.error(`Failed to parse WebSocket message from ${id}:`, error);
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`WebSocket ${id} closed with code ${code}: ${reason}`);
            connection.status = 'closed';
            this.emit('connectionClose', { connectionId: id, code, reason });

            // Attempt reconnection for important connections
            if (connection.name && connection.reconnectAttempts < 5) {
                this.attemptReconnection(connection);
            }
        });

        ws.on('error', (error) => {
            console.error(`WebSocket ${id} error:`, error.message);
            connection.status = 'error';
            this.emit('connectionError', { connectionId: id, error: error.message });
        });

        ws.on('ping', (data) => {
            ws.pong(data);
        });

        ws.on('pong', (data) => {
            // Handle pong for latency measurement
            const pongTime = Date.now();
            this.emit('pong', { connectionId: id, timestamp: pongTime });
        });
    }

    /**
     * Send a subscription message
     */
    async subscribe(connectionId, subscriptionData) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            throw new Error(`Connection ${connectionId} not found`);
        }

        if (connection.status !== 'connected') {
            throw new Error(`Connection ${connectionId} is not connected`);
        }

        try {
            const message = JSON.stringify(subscriptionData);
            connection.ws.send(message);

            // Track subscription
            if (subscriptionData.params) {
                subscriptionData.params.forEach(param => {
                    connection.subscriptions.add(param);
                });
            }

            console.log(`Subscription sent on ${connectionId}:`, subscriptionData);
            return { success: true, subscriptionData };

        } catch (error) {
            console.error(`Failed to send subscription on ${connectionId}:`, error);
            throw new Error(`Subscription failed: ${error.message}`);
        }
    }

    /**
     * Send an unsubscription message
     */
    async unsubscribe(connectionId, unsubscriptionData) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            throw new Error(`Connection ${connectionId} not found`);
        }

        if (connection.status !== 'connected') {
            throw new Error(`Connection ${connectionId} is not connected`);
        }

        try {
            const message = JSON.stringify(unsubscriptionData);
            connection.ws.send(message);

            // Remove from tracked subscriptions
            if (unsubscriptionData.params) {
                unsubscriptionData.params.forEach(param => {
                    connection.subscriptions.delete(param);
                });
            }

            console.log(`Unsubscription sent on ${connectionId}:`, unsubscriptionData);
            return { success: true, unsubscriptionData };

        } catch (error) {
            console.error(`Failed to send unsubscription on ${connectionId}:`, error);
            throw new Error(`Unsubscription failed: ${error.message}`);
        }
    }

    /**
     * Send a raw message
     */
    async sendMessage(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            throw new Error(`Connection ${connectionId} not found`);
        }

        if (connection.status !== 'connected') {
            throw new Error(`Connection ${connectionId} is not connected`);
        }

        try {
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            connection.ws.send(messageStr);
            return { success: true };
        } catch (error) {
            console.error(`Failed to send message on ${connectionId}:`, error);
            throw new Error(`Send message failed: ${error.message}`);
        }
    }

    /**
     * Close a WebSocket connection
     */
    async closeConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            throw new Error(`Connection ${connectionId} not found`);
        }

        try {
            if (connection.ws.readyState === WebSocket.OPEN) {
                connection.ws.close(1000, 'Closed by client');
            }

            this.connections.delete(connectionId);
            console.log(`WebSocket connection ${connectionId} closed`);
            return { success: true };

        } catch (error) {
            console.error(`Failed to close connection ${connectionId}:`, error);
            throw new Error(`Close connection failed: ${error.message}`);
        }
    }

    /**
     * Get connection status
     */
    getConnectionStatus(connectionId) {
        if (connectionId) {
            const connection = this.connections.get(connectionId);
            if (!connection) return null;

            return {
                id: connection.id,
                status: connection.status,
                url: connection.url,
                name: connection.name,
                uptime: Date.now() - connection.createdAt,
                messageCount: connection.messageCount,
                lastMessage: connection.lastMessage,
                subscriptions: Array.from(connection.subscriptions)
            };
        }

        // Return status for all connections
        const allStatus = {};
        this.connections.forEach((connection, id) => {
            allStatus[id] = this.getConnectionStatus(id);
        });

        return allStatus;
    }

    /**
     * Attempt to reconnect a WebSocket
     */
    async attemptReconnection(connection) {
        connection.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, connection.reconnectAttempts - 1), 30000);

        console.log(`Attempting to reconnect ${connection.id} in ${delay}ms (attempt ${connection.reconnectAttempts})`);

        setTimeout(async () => {
            try {
                const newWs = new WebSocket(connection.url);
                connection.ws = newWs;
                connection.status = 'connecting';

                this.setupWebSocketEvents(connection);

            } catch (error) {
                console.error(`Reconnection failed for ${connection.id}:`, error);

                if (connection.reconnectAttempts < 5) {
                    this.attemptReconnection(connection);
                }
            }
        }, delay);
    }

    /**
     * Buffer recent messages for debugging
     */
    bufferMessage(connectionId, message) {
        if (!this.messageBuffer.has(connectionId)) {
            this.messageBuffer.set(connectionId, []);
        }

        const buffer = this.messageBuffer.get(connectionId);
        buffer.push({
            message,
            timestamp: Date.now()
        });

        // Keep only last 100 messages
        if (buffer.length > 100) {
            buffer.splice(0, buffer.length - 100);
        }
    }

    /**
     * Get recent messages for debugging
     */
    getRecentMessages(connectionId, count = 10) {
        const buffer = this.messageBuffer.get(connectionId);
        if (!buffer) return [];

        return buffer.slice(-count);
    }

    /**
     * Setup cleanup on app exit
     */
    setupCleanup() {
        process.on('exit', () => {
            this.cleanup();
        });

        process.on('SIGINT', () => {
            this.cleanup();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            this.cleanup();
            process.exit(0);
        });
    }

    /**
     * Cleanup all connections
     */
    cleanup() {
        console.log('Cleaning up WebSocket connections...');

        this.connections.forEach((connection, id) => {
            try {
                if (connection.ws.readyState === WebSocket.OPEN) {
                    connection.ws.close(1000, 'Application shutting down');
                }
            } catch (error) {
                console.error(`Error closing WebSocket ${id}:`, error);
            }
        });

        this.connections.clear();
        this.messageBuffer.clear();
    }
}

// Create global instance
const wsManager = new ElectronWebSocketManager();

/**
 * Setup IPC handlers for WebSocket operations
 */
function setupWebSocketIPC(ipcMain) {
    // Create WebSocket connection
    ipcMain.handle('websocket:create', async (event, options) => {
        try {
            const connectionId = await wsManager.createConnection(options);
            return { success: true, connectionId };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Subscribe to streams
    ipcMain.handle('websocket:subscribe', async (event, connectionId, subscriptionData) => {
        try {
            const result = await wsManager.subscribe(connectionId, subscriptionData);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Unsubscribe from streams
    ipcMain.handle('websocket:unsubscribe', async (event, connectionId, unsubscriptionData) => {
        try {
            const result = await wsManager.unsubscribe(connectionId, unsubscriptionData);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Send raw message
    ipcMain.handle('websocket:send', async (event, connectionId, message) => {
        try {
            const result = await wsManager.sendMessage(connectionId, message);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Close connection
    ipcMain.handle('websocket:close', async (event, connectionId) => {
        try {
            const result = await wsManager.closeConnection(connectionId);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Get connection status
    ipcMain.handle('websocket:status', async (event, connectionId) => {
        try {
            const status = wsManager.getConnectionStatus(connectionId);
            return { success: true, status };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Setup event forwarding to renderer
    wsManager.on('message', (data) => {
        // Forward WebSocket messages to all renderer processes
        const allWindows = require('electron').BrowserWindow.getAllWindows();
        allWindows.forEach(window => {
            window.webContents.send('websocket:message', data);
        });
    });

    wsManager.on('connectionOpen', (data) => {
        const allWindows = require('electron').BrowserWindow.getAllWindows();
        allWindows.forEach(window => {
            window.webContents.send('websocket:open', data);
        });
    });

    wsManager.on('connectionClose', (data) => {
        const allWindows = require('electron').BrowserWindow.getAllWindows();
        allWindows.forEach(window => {
            window.webContents.send('websocket:close', data);
        });
    });

    wsManager.on('connectionError', (data) => {
        const allWindows = require('electron').BrowserWindow.getAllWindows();
        allWindows.forEach(window => {
            window.webContents.send('websocket:error', data);
        });
    });

    console.log('WebSocket IPC handlers registered');
}

module.exports = {
    ElectronWebSocketManager,
    setupWebSocketIPC,
    wsManager
};