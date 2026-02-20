// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

const crypto = require('crypto');
const { app } = require('electron');
const fs = require('fs/promises');
const path = require('path');

class StorageService {
    constructor() {
        this.userDataPath = app?.getPath('userData') || './data';
        this.dbPath = path.join(this.userDataPath, 'neutrontrader.db');
        this.backupPath = path.join(this.userDataPath, 'backups');
        this.initialized = false;

        this.cache = {
            trades: new Map(),
            strategies: new Map(),
            settings: new Map()
        };
    }

    async initialize() {
        if (this.initialized) return;

        try {
            await fs.mkdir(this.userDataPath, { recursive: true });
            await fs.mkdir(this.backupPath, { recursive: true });
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

            if (parsed.trades) {
                parsed.trades.forEach(trade => this.cache.trades.set(trade.id, trade));
            }
            if (parsed.strategies) {
                parsed.strategies.forEach(strategy => this.cache.strategies.set(strategy.id, strategy));
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

            await this.createBackup();

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
                    time: fs.stat(path.join(this.backupPath, f)).then(s => s.mtime)
                }));

            for (const file of backupFiles) {
                file.time = await file.time;
            }

            backupFiles.sort((a, b) => b.time - a.time);

            for (const file of backupFiles.slice(10)) {
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

        trades.sort((a, b) => b.timestamp - a.timestamp);

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
        if (deleted) await this.saveData();
        return deleted;
    }

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

    async getTradeStatistics(filters = {}) {
        const trades = await this.getTrades(filters);

        if (trades.length === 0) {
            return {
                totalTrades: 0, totalVolume: 0, totalProfit: 0,
                winRate: 0, avgProfit: 0, avgLoss: 0,
                profitableTrades: 0, losingTrades: 0
            };
        }

        const winning = trades.filter(t => (t.profit || 0) > 0);
        const losing = trades.filter(t => (t.profit || 0) < 0);
        const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
        const totalVolume = trades.reduce((sum, t) => sum + (t.volume || 0), 0);

        return {
            totalTrades: trades.length,
            totalVolume,
            totalProfit,
            winRate: (winning.length / trades.length) * 100,
            avgProfit: winning.length > 0
                ? winning.reduce((s, t) => s + t.profit, 0) / winning.length : 0,
            avgLoss: losing.length > 0
                ? losing.reduce((s, t) => s + Math.abs(t.profit), 0) / losing.length : 0,
            profitableTrades: winning.length,
            losingTrades: losing.length,
            bestTrade: winning.reduce((b, t) => t.profit > (b?.profit || 0) ? t : b, null),
            worstTrade: losing.reduce((w, t) => t.profit < (w?.profit || 0) ? t : w, null)
        };
    }

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

            if (data.trades) {
                data.trades.forEach(trade => this.cache.trades.set(trade.id, trade));
            }
            if (data.strategies) {
                data.strategies.forEach(s => this.cache.strategies.set(s.id, s));
            }
            if (data.settings) {
                Object.entries(data.settings).forEach(([k, v]) => this.cache.settings.set(k, v));
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

const storageService = new StorageService();
module.exports = { storageService };
