// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

export const NOTIFICATION_TYPES = {
    TRADE_EXECUTED: 'trade_executed',
    TRADE_FAILED: 'trade_failed',
    BOT_STARTED: 'bot_started',
    BOT_STOPPED: 'bot_stopped',
    BOT_ERROR: 'bot_error',
    BALANCE_LOW: 'balance_low',
    PROFIT_TARGET: 'profit_target',
    LOSS_LIMIT: 'loss_limit',
    API_ERROR: 'api_error',
    CONNECTION_RESTORED: 'connection_restored',
    SYSTEM_UPDATE: 'system_update'
};

export const NOTIFICATION_PRIORITY = {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    CRITICAL: 'critical'
};

export const NOTIFICATION_CHANNELS = {
    BROWSER: 'browser',
    SOUND: 'sound',
    TOAST: 'toast',
    LOG: 'log'
};

class NotificationService {
    constructor() {
        this.notifications = [];
        this.subscribers = new Map();
        this.settings = {
            enableBrowserNotifications: false,
            enableSounds: true,
            enableToasts: true,
            soundVolume: 0.5,
            autoHideDelay: 5000,
            maxNotifications: 100
        };
        this.soundCache = new Map();
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        // Request browser notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }

        // Load notification sounds
        await this.loadSounds();

        // Load settings from localStorage
        this.loadSettings();

        this.isInitialized = true;
        console.log('Notification service initialized');
    }

    async loadSounds() {
        const sounds = {
            success: '/sounds/success.mp3',
            error: '/sounds/error.mp3',
            warning: '/sounds/warning.mp3',
            info: '/sounds/info.mp3'
        };

        for (const [name, path] of Object.entries(sounds)) {
            try {
                const audio = new Audio(path);
                audio.preload = 'auto';
                audio.volume = this.settings.soundVolume;
                this.soundCache.set(name, audio);
            } catch (error) {
                console.warn(`Failed to load sound: ${name}`, error);
            }
        }
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('neutronTraderNotificationSettings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
            }
        } catch (error) {
            console.error('Failed to load notification settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('neutronTraderNotificationSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save notification settings:', error);
        }
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();

        // Update sound volume
        if (newSettings.soundVolume !== undefined) {
            this.soundCache.forEach(audio => {
                audio.volume = this.settings.soundVolume;
            });
        }
    }

    getSettings() {
        return { ...this.settings };
    }

    async notify(type, data = {}) {
        await this.initialize();

        const notification = this.createNotification(type, data);
        this.addNotification(notification);

        // Send notification through enabled channels
        await this.sendNotification(notification);

        // Notify subscribers
        this.notifySubscribers(notification);

        return notification;
    }

    createNotification(type, data) {
        const config = this.getNotificationConfig(type);

        return {
            id: this.generateId(),
            type,
            title: config.title,
            message: this.formatMessage(config.message, data),
            priority: config.priority,
            channels: config.channels,
            timestamp: new Date().toISOString(),
            data,
            read: false,
            persistent: config.persistent || false
        };
    }

    getNotificationConfig(type) {
        const configs = {
            [NOTIFICATION_TYPES.TRADE_EXECUTED]: {
                title: 'Trade Executed',
                message: '{side} {quantity} {symbol} at {price}',
                priority: NOTIFICATION_PRIORITY.NORMAL,
                channels: [NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.SOUND, NOTIFICATION_CHANNELS.TOAST],
                sound: 'success'
            },

            [NOTIFICATION_TYPES.TRADE_FAILED]: {
                title: 'Trade Failed',
                message: 'Failed to execute {side} order for {symbol}: {error}',
                priority: NOTIFICATION_PRIORITY.HIGH,
                channels: [NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.SOUND, NOTIFICATION_CHANNELS.TOAST],
                sound: 'error'
            },

            [NOTIFICATION_TYPES.BOT_STARTED]: {
                title: 'Trading Bot Started',
                message: 'Bot started for {symbol} using {strategy} strategy',
                priority: NOTIFICATION_PRIORITY.NORMAL,
                channels: [NOTIFICATION_CHANNELS.TOAST, NOTIFICATION_CHANNELS.SOUND],
                sound: 'info'
            },

            [NOTIFICATION_TYPES.BOT_STOPPED]: {
                title: 'Trading Bot Stopped',
                message: 'Trading bot for {symbol} has been stopped',
                priority: NOTIFICATION_PRIORITY.NORMAL,
                channels: [NOTIFICATION_CHANNELS.TOAST],
                sound: 'info'
            },

            [NOTIFICATION_TYPES.BOT_ERROR]: {
                title: 'Bot Error',
                message: 'Trading bot encountered an error: {error}',
                priority: NOTIFICATION_PRIORITY.HIGH,
                channels: [NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.SOUND, NOTIFICATION_CHANNELS.TOAST],
                sound: 'error',
                persistent: true
            },

            [NOTIFICATION_TYPES.BALANCE_LOW]: {
                title: 'Low Balance Warning',
                message: 'Your {asset} balance is running low: {balance}',
                priority: NOTIFICATION_PRIORITY.HIGH,
                channels: [NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.TOAST],
                sound: 'warning'
            },

            [NOTIFICATION_TYPES.PROFIT_TARGET]: {
                title: 'Profit Target Reached',
                message: 'Profit target reached: {profit}% gain on {symbol}',
                priority: NOTIFICATION_PRIORITY.HIGH,
                channels: [NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.SOUND, NOTIFICATION_CHANNELS.TOAST],
                sound: 'success'
            },

            [NOTIFICATION_TYPES.LOSS_LIMIT]: {
                title: 'Loss Limit Reached',
                message: 'Stop loss triggered: {loss}% loss on {symbol}',
                priority: NOTIFICATION_PRIORITY.CRITICAL,
                channels: [NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.SOUND, NOTIFICATION_CHANNELS.TOAST],
                sound: 'error',
                persistent: true
            },

            [NOTIFICATION_TYPES.API_ERROR]: {
                title: 'API Connection Error',
                message: 'Connection to trading API failed: {error}',
                priority: NOTIFICATION_PRIORITY.HIGH,
                channels: [NOTIFICATION_CHANNELS.TOAST],
                sound: 'error'
            },

            [NOTIFICATION_TYPES.CONNECTION_RESTORED]: {
                title: 'Connection Restored',
                message: 'Connection to trading API has been restored',
                priority: NOTIFICATION_PRIORITY.NORMAL,
                channels: [NOTIFICATION_CHANNELS.TOAST],
                sound: 'success'
            },

            [NOTIFICATION_TYPES.SYSTEM_UPDATE]: {
                title: 'System Update',
                message: '{message}',
                priority: NOTIFICATION_PRIORITY.LOW,
                channels: [NOTIFICATION_CHANNELS.TOAST]
            }
        };

        return configs[type] || {
            title: 'Notification',
            message: '{message}',
            priority: NOTIFICATION_PRIORITY.NORMAL,
            channels: [NOTIFICATION_CHANNELS.TOAST]
        };
    }

    formatMessage(template, data) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] || match;
        });
    }

    async sendNotification(notification) {
        const config = this.getNotificationConfig(notification.type);

        // Browser notification
        if (notification.channels.includes(NOTIFICATION_CHANNELS.BROWSER) &&
            this.settings.enableBrowserNotifications &&
            Notification.permission === 'granted') {
            try {
                new Notification(notification.title, {
                    body: notification.message,
                    icon: '/icons/neutron-icon.png',
                    tag: notification.type
                });
            } catch (error) {
                console.error('Failed to show browser notification:', error);
            }
        }

        // Sound notification
        if (notification.channels.includes(NOTIFICATION_CHANNELS.SOUND) &&
            this.settings.enableSounds && config.sound) {
            this.playSound(config.sound);
        }

        // Toast notifications are handled by the UI components
    }

    playSound(soundName) {
        try {
            const audio = this.soundCache.get(soundName);
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(error => {
                    console.warn('Failed to play notification sound:', error);
                });
            }
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    }

    addNotification(notification) {
        this.notifications.unshift(notification);

        // Keep notifications list manageable
        if (this.notifications.length > this.settings.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.settings.maxNotifications);
        }
    }

    getNotifications(filters = {}) {
        let filtered = [...this.notifications];

        if (filters.type) {
            filtered = filtered.filter(n => n.type === filters.type);
        }

        if (filters.priority) {
            filtered = filtered.filter(n => n.priority === filters.priority);
        }

        if (filters.unreadOnly) {
            filtered = filtered.filter(n => !n.read);
        }

        if (filters.limit) {
            filtered = filtered.slice(0, filters.limit);
        }

        return filtered;
    }

    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            this.notifySubscribers({ type: 'notification_updated', notification });
        }
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.notifySubscribers({ type: 'notifications_updated', notifications: this.notifications });
    }

    deleteNotification(notificationId) {
        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index !== -1) {
            this.notifications.splice(index, 1);
            this.notifySubscribers({ type: 'notification_deleted', notificationId });
        }
    }

    clearNotifications() {
        this.notifications = [];
        this.notifySubscribers({ type: 'notifications_cleared' });
    }

    // Subscription system for UI components
    subscribe(callback) {
        const id = this.generateId();
        this.subscribers.set(id, callback);

        return () => {
            this.subscribers.delete(id);
        };
    }

    notifySubscribers(data) {
        this.subscribers.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in notification subscriber:', error);
            }
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Convenience methods for common notifications
    async tradeExecuted(tradeData) {
        return this.notify(NOTIFICATION_TYPES.TRADE_EXECUTED, tradeData);
    }

    async tradeFailed(error, tradeData = {}) {
        return this.notify(NOTIFICATION_TYPES.TRADE_FAILED, { ...tradeData, error });
    }

    async botStarted(botConfig) {
        return this.notify(NOTIFICATION_TYPES.BOT_STARTED, botConfig);
    }

    async botStopped(botConfig) {
        return this.notify(NOTIFICATION_TYPES.BOT_STOPPED, botConfig);
    }

    async botError(error, botConfig = {}) {
        return this.notify(NOTIFICATION_TYPES.BOT_ERROR, { ...botConfig, error });
    }

    async balanceLow(asset, balance) {
        return this.notify(NOTIFICATION_TYPES.BALANCE_LOW, { asset, balance });
    }

    async profitTarget(symbol, profit) {
        return this.notify(NOTIFICATION_TYPES.PROFIT_TARGET, { symbol, profit });
    }

    async lossLimit(symbol, loss) {
        return this.notify(NOTIFICATION_TYPES.LOSS_LIMIT, { symbol, loss });
    }

    async apiError(error) {
        return this.notify(NOTIFICATION_TYPES.API_ERROR, { error });
    }

    async connectionRestored() {
        return this.notify(NOTIFICATION_TYPES.CONNECTION_RESTORED);
    }

    async systemUpdate(message) {
        return this.notify(NOTIFICATION_TYPES.SYSTEM_UPDATE, { message });
    }

    // Statistics
    getStatistics() {
        const total = this.notifications.length;
        const unread = this.notifications.filter(n => !n.read).length;
        const byType = {};
        const byPriority = {};

        this.notifications.forEach(n => {
            byType[n.type] = (byType[n.type] || 0) + 1;
            byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
        });

        return {
            total,
            unread,
            read: total - unread,
            byType,
            byPriority
        };
    }
}

// React hook for notification management
export const useNotifications = () => {
    const [notifications, setNotifications] = React.useState([]);
    const [unreadCount, setUnreadCount] = React.useState(0);

    React.useEffect(() => {
        const unsubscribe = notificationService.subscribe((data) => {
            if (data.type === 'notification_added' || data.type === 'notifications_updated') {
                const allNotifications = notificationService.getNotifications();
                setNotifications(allNotifications);
                setUnreadCount(allNotifications.filter(n => !n.read).length);
            }
        });

        // Initial load
        const initialNotifications = notificationService.getNotifications();
        setNotifications(initialNotifications);
        setUnreadCount(initialNotifications.filter(n => !n.read).length);

        return unsubscribe;
    }, []);

    return {
        notifications,
        unreadCount,
        markAsRead: (id) => notificationService.markAsRead(id),
        markAllAsRead: () => notificationService.markAllAsRead(),
        deleteNotification: (id) => notificationService.deleteNotification(id),
        clearNotifications: () => notificationService.clearNotifications()
    };
};

// Global notification service instance
export const notificationService = new NotificationService();
export default notificationService;