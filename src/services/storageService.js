// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import * as crypto from 'crypto';
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

class StorageService {
    constructor() {
        this.userDataPath = app?.getPath('userData') || './data';
        this.dbPath = path.join(this.userDataPath, 'neutrontrader.db');
        this.backupPath = path.join(this.userDataPath, 'backups');
        this.initialized = false;

        // In-memory cache for better performance
        this.cache = {
            trades: new Map(),
            strategies: new Map(),
            settings: new Map()
        };
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Ensure directories exist
            await fs.mkdir(this.userDataPath, { recursive: true });
            await fs.mkdir(this.backupPath, { recursive: true });

            // Load existing data
            await this.loadData();

            this.initialized = true;
            console.log('Storage service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize storage service:', error);
            throw error;
        }
    }

    async loadData() {
        try {
            const data = await fs.readFile(this.dbPath, 'utf8');
            const parsed = JSON.parse(data);

            // Load into cache
            if (parsed.trades) {
                parsed.trades.forEach(trade => {
                    this.cache.trades.set(trade.id, trade);
                });
            }

            if (parsed.strategies) {
                parsed.strategies.forEach(strategy => {
                    this.cache.strategies.set(strategy.id, strategy);
                });
            }

            if (parsed.settings) {
                Object.entries(parsed.settings).forEach(([key, value]) => {
                    this.cache.settings.set(key, value);
                });
            }

        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading data:', error);
            }
            // File doesn't exist yet, which is fine for first run
        }
    }

    async saveData() {
        try {
            const data = {
                trades: Array.from(this.cache.trades.values()),
                strategies: Array.from(this.cache.strategies.values()),
                settings: Object.fromEntries(this.cache.settings.entries()),
                lastUpdated: new Date().toISOString(),
                version: '1.0'
            };

            // Create backup before saving
            await this.createBackup();

            // Write to temporary file first, then rename (atomic operation)
            const tempPath = this.dbPath + '.tmp';
            await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
            await fs.rename(tempPath, this.dbPath);

        } catch (error) {
            console.error('Error saving data:', error);
            throw error;
        }
    }

    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupPath, `backup-${timestamp}.json`);

            if (await this.fileExists(this.dbPath)) {
                await fs.copyFile(this.dbPath, backupFile);

                // Clean up old backups (keep only last 10)
                await this.cleanupBackups();
            }
        } catch (error) {
            console.error('Error creating backup:', error);
        }
    }

    async cleanupBackups() {
        try {
            const files = await fs.readdir(this.backupPath);
            const backupFiles = files
                .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
                .map(f => ({
                    name: f,
                    path: path.join(this.backupPath, f),
                    time: fs.stat(path.join(this.backupPath, f)).then(stats => stats.mtime)
                }));

            // Wait for all stat operations
            for (const file of backupFiles) {
                file.time = await file.time;
            }

            // Sort by modification time, newest first
            backupFiles.sort((a, b) => b.time - a.time);

            // Delete files beyond the 10 most recent
            const filesToDelete = backupFiles.slice(10);
            for (const file of filesToDelete) {
                await fs.unlink(file.path);
            }
        } catch (error) {
            console.error('Error cleaning up backups:', error);
        }
    }

    async fileExists(filepath) {
        try {
            await fs.access(filepath);
            return true;
        } catch {
            return false;
        }
    }

    // Trade operations
    async saveTrade(trade) {
        await this.initialize();

        const tradeWithId = {
            ...trade,
            id: trade.id || this.generateId(),
            timestamp: trade.timestamp || Date.now(),
            version: '1.0'
        };

        this.cache.trades.set(tradeWithId.id, tradeWithId);
        await this.saveData();

        return tradeWithId;
    }

    async getTrades(filters = {}) {
        await this.initialize();

        let trades = Array.from(this.cache.trades.values());

        // Apply filters
        if (filters.symbol && filters.symbol !== 'all') {
            trades = trades.filter(t => t.symbol === filters.symbol);
        }

        if (filters.strategy) {
            trades = trades.filter(t => t.strategy === filters.strategy);
        }

        if (filters.startTime) {
            trades = trades.filter(t => t.timestamp >= filters.startTime);
        }

        if (filters.endTime) {
            trades = trades.filter(t => t.timestamp <= filters.endTime);
        }

        if (filters.side) {
            trades = trades.filter(t => t.side === filters.side);
        }

        // Sort by timestamp, newest first
        trades.sort((a, b) => b.timestamp - a.timestamp);

        // Apply limit
        if (filters.limit) {
            trades = trades.slice(0, filters.limit);
        }

        return trades;
    }

    async getTradeById(id) {
        await this.initialize();
        return this.cache.trades.get(id);
    }

    async deleteTrade(id) {
        await this.initialize();
        const deleted = this.cache.trades.delete(id);
        if (deleted) {
            await this.saveData();
        }
        return deleted;
    }

    // Strategy performance tracking
    async saveStrategyPerformance(strategyData) {
        await this.initialize();

        const strategy = {
            ...strategyData,
            id: strategyData.id || this.generateId(),
            lastUpdated: Date.now()
        };

        this.cache.strategies.set(strategy.id, strategy);
        await this.saveData();

        return strategy;
    }

    async getStrategyPerformance(strategyName) {
        await this.initialize();

        return Array.from(this.cache.strategies.values())
            .filter(s => s.name === strategyName);
    }

    // Settings operations
    async saveSetting(key, value) {
        await this.initialize();
        this.cache.settings.set(key, value);
        await this.saveData();
    }

    async getSetting(key, defaultValue = null) {
        await this.initialize();
        return this.cache.settings.get(key) || defaultValue;
    }

    async getAllSettings() {
        await this.initialize();
        return Object.fromEntries(this.cache.settings.entries());
    }

    // Statistics and analytics
    async getTradeStatistics(filters = {}) {
        const trades = await this.getTrades(filters);

        if (trades.length === 0) {
            return {
                totalTrades: 0,
                totalVolume: 0,
                totalProfit: 0,
                winRate: 0,
                avgProfit: 0,
                avgLoss: 0,
                profitableTrades: 0,
                losingTrades: 0
            };
        }

        const winningTrades = trades.filter(t => (t.profit || 0) > 0);
        const losingTrades = trades.filter(t => (t.profit || 0) < 0);

        const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
        const totalVolume = trades.reduce((sum, t) => sum + (t.volume || 0), 0);

        const avgProfit = winningTrades.length > 0
            ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length
            : 0;

        const avgLoss = losingTrades.length > 0
            ? losingTrades.reduce((sum, t) => sum + Math.abs(t.profit), 0) / losingTrades.length
            : 0;

        return {
            totalTrades: trades.length,
            totalVolume: totalVolume,
            totalProfit: totalProfit,
            winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
            avgProfit: avgProfit,
            avgLoss: avgLoss,
            profitableTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            bestTrade: winningTrades.reduce((best, t) => t.profit > (best?.profit || 0) ? t : best, null),
            worstTrade: losingTrades.reduce((worst, t) => t.profit < (worst?.profit || 0) ? t : worst, null)
        };
    }

    // Utility methods
    generateId() {
        return crypto.randomBytes(16).toString('hex');
    }

    async exportData(filepath) {
        await this.initialize();

        const data = {
            trades: Array.from(this.cache.trades.values()),
            strategies: Array.from(this.cache.strategies.values()),
            settings: Object.fromEntries(this.cache.settings.entries()),
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
    }

    async importData(filepath) {
        try {
            const data = JSON.parse(await fs.readFile(filepath, 'utf8'));

            // Merge imported data with existing data
            if (data.trades) {
                data.trades.forEach(trade => {
                    this.cache.trades.set(trade.id, trade);
                });
            }

            if (data.strategies) {
                data.strategies.forEach(strategy => {
                    this.cache.strategies.set(strategy.id, strategy);
                });
            }

            if (data.settings) {
                Object.entries(data.settings).forEach(([key, value]) => {
                    this.cache.settings.set(key, value);
                });
            }

            await this.saveData();
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            throw error;
        }
    }

    async clearAllData() {
        this.cache.trades.clear();
        this.cache.strategies.clear();
        this.cache.settings.clear();
        await this.saveData();
    }
}

// Export singleton instance
export const storageService = new StorageService();
export default storageService;