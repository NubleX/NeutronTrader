// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import React from 'react';
import notificationService from '../../services/notificationService';
import { globalErrorHandler } from '../../utils/errorHandler';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        const processedError = globalErrorHandler.handleError(error, {
            component: this.props.componentName || 'Unknown',
            errorInfo
        });

        this.setState({
            error: processedError,
            errorInfo
        });

        // Notify user of critical error
        notificationService.notify('system_error', {
            error: processedError.message,
            component: this.props.componentName
        });
    }

    render() {
        if (this.state.hasError) {
            const friendlyMessage = globalErrorHandler.getUserFriendlyMessage(this.state.error);

            return (
                <div className="error-boundary">
                    <div className="error-boundary-content">
                        <h2>{friendlyMessage.title}</h2>
                        <p>{friendlyMessage.message}</p>

                        <div className="error-suggestions">
                            <h4>What you can do:</h4>
                            <ul>
                                {friendlyMessage.suggestions.map((suggestion, index) => (
                                    <li key={index}>{suggestion}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="error-actions">
                            <button
                                onClick={() => window.location.reload()}
                                className="primary-btn"
                            >
                                Reload Application
                            </button>

                            {this.props.onRetry && (
                                <button
                                    onClick={() => {
                                        this.setState({ hasError: false, error: null });
                                        this.props.onRetry();
                                    }}
                                    className="secondary-btn"
                                >
                                    Try Again
                                </button>
                            )}
                        </div>

                        {process.env.NODE_ENV === 'development' && (
                            <details className="error-details">
                                <summary>Technical Details (Development)</summary>
                                <pre>{this.state.error?.stack}</pre>
                                <pre>{JSON.stringify(this.state.errorInfo, null, 2)}</pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// src/components/enhanced/NotificationCenter.jsx
import { useEffect, useState } from 'react';
import { NOTIFICATION_PRIORITY, useNotifications } from '../../services/notificationService';

export const NotificationCenter = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState('all');

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread') return !n.read;
        if (filter === 'critical') return n.priority === NOTIFICATION_PRIORITY.CRITICAL;
        return true;
    });

    return (
        <div className="notification-center">
            <button
                className="notification-trigger"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="notification-icon">🔔</span>
                {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="notification-panel">
                    <div className="notification-header">
                        <h3>Notifications</h3>
                        <div className="notification-controls">
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="notification-filter"
                            >
                                <option value="all">All</option>
                                <option value="unread">Unread</option>
                                <option value="critical">Critical</option>
                            </select>

                            {unreadCount > 0 && (
                                <button onClick={markAllAsRead} className="mark-all-read">
                                    Mark All Read
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="notification-list">
                        {filteredNotifications.length === 0 ? (
                            <div className="no-notifications">
                                <p>No notifications</p>
                            </div>
                        ) : (
                            filteredNotifications.map(notification => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkAsRead={markAsRead}
                                    onDelete={deleteNotification}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const NotificationItem = ({ notification, onMarkAsRead, onDelete }) => {
    const getPriorityClass = (priority) => {
        switch (priority) {
            case NOTIFICATION_PRIORITY.CRITICAL: return 'critical';
            case NOTIFICATION_PRIORITY.HIGH: return 'high';
            case NOTIFICATION_PRIORITY.NORMAL: return 'normal';
            default: return 'low';
        }
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    return (
        <div className={`notification-item ${getPriorityClass(notification.priority)} ${notification.read ? 'read' : 'unread'}`}>
            <div className="notification-content">
                <h4>{notification.title}</h4>
                <p>{notification.message}</p>
                <span className="notification-time">{formatTime(notification.timestamp)}</span>
            </div>

            <div className="notification-actions">
                {!notification.read && (
                    <button
                        onClick={() => onMarkAsRead(notification.id)}
                        className="mark-read-btn"
                        title="Mark as read"
                    >
                        ✓
                    </button>
                )}

                <button
                    onClick={() => onDelete(notification.id)}
                    className="delete-btn"
                    title="Delete notification"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

// src/components/enhanced/ToastNotifications.jsx
export const ToastNotifications = () => {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const unsubscribe = notificationService.subscribe((data) => {
            if (data.type && data.channels?.includes('toast')) {
                const toast = {
                    id: data.id,
                    title: data.title,
                    message: data.message,
                    priority: data.priority,
                    timestamp: Date.now()
                };

                setToasts(prev => [...prev, toast]);

                // Auto-hide non-critical toasts
                if (data.priority !== NOTIFICATION_PRIORITY.CRITICAL) {
                    setTimeout(() => {
                        setToasts(prev => prev.filter(t => t.id !== toast.id));
                    }, 5000);
                }
            }
        });

        return unsubscribe;
    }, []);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`toast toast-${toast.priority}`}
                >
                    <div className="toast-content">
                        <h4>{toast.title}</h4>
                        <p>{toast.message}</p>
                    </div>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="toast-close"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
};

// src/components/enhanced/EnhancedTradeSetup.jsx
import { TRADING_PAIRS, getTradingPairDisplayData, validateTradeAmount } from '../../config/tradingPairs';
import { withErrorHandling, withRetry } from '../../utils/errorHandler';

export const EnhancedTradeSetup = ({ apiConfig }) => {
    const [formData, setFormData] = useState({
        symbol: 'BNBUSDT',
        strategy: 'simpleMovingAverage',
        amount: 0.1,
        interval: '15m',
        takeProfit: 3.0,
        stopLoss: 2.0
    });

    const [selectedPairData, setSelectedPairData] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const pairData = getTradingPairDisplayData(formData.symbol);
        setSelectedPairData(pairData);

        if (pairData) {
            setFormData(prev => ({
                ...prev,
                amount: pairData.defaultAmount
            }));
        }
    }, [formData.symbol]);

    const validateForm = () => {
        const errors = {};

        // Validate amount
        if (selectedPairData) {
            const amountValidation = validateTradeAmount(formData.symbol, formData.amount);
            if (!amountValidation.valid) {
                errors.amount = amountValidation.error;
            }
        }

        // Validate take profit and stop loss
        if (formData.takeProfit <= 0) {
            errors.takeProfit = 'Take profit must be greater than 0';
        }

        if (formData.stopLoss <= 0) {
            errors.stopLoss = 'Stop loss must be greater than 0';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            notificationService.notify('validation_error', {
                message: 'Please fix the validation errors before starting the bot'
            });
            return;
        }

        setIsLoading(true);

        try {
            await withRetry(async () => {
                const result = await withErrorHandling(async () => {
                    // This would call your actual trading bot start function
                    if (window.electronAPI) {
                        return await window.electronAPI.tradingBot.start({
                            ...formData,
                            apiConfig
                        });
                    } else {
                        // Browser simulation
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        return { status: 'started', message: 'Bot started in simulation mode' };
                    }
                }, { operation: 'start_trading_bot', formData });

                await notificationService.botStarted({
                    symbol: formData.symbol,
                    strategy: formData.strategy
                });

                return result;
            });

        } catch (error) {
            await notificationService.botError(error.message, formData);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ErrorBoundary componentName="EnhancedTradeSetup">
            <div className="enhanced-trade-setup">
                <h2>Enhanced Trading Bot Setup</h2>

                {selectedPairData && (
                    <div className="pair-info-card">
                        <h3>{selectedPairData.displayName}</h3>
                        <p>{selectedPairData.description}</p>

                        <div className="pair-metrics">
                            <div className="metric">
                                <span className="label">Category:</span>
                                <span className="value" style={{ color: selectedPairData.categoryInfo.color }}>
                                    {selectedPairData.categoryInfo.name}
                                </span>
                            </div>

                            <div className="metric">
                                <span className="label">Risk Level:</span>
                                <span className="value" style={{ color: selectedPairData.riskInfo.color }}>
                                    {selectedPairData.riskInfo.label}
                                </span>
                            </div>

                            <div className="metric">
                                <span className="label">Volatility:</span>
                                <span className="value" style={{ color: selectedPairData.volatilityInfo.color }}>
                                    {selectedPairData.volatilityInfo.label}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="enhanced-form">
                    <div className="form-section">
                        <h4>Trading Pair Selection</h4>

                        <div className="form-group">
                            <label htmlFor="symbol">Trading Pair:</label>
                            <select
                                id="symbol"
                                name="symbol"
                                value={formData.symbol}
                                onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
                                disabled={isLoading}
                            >
                                {Object.values(TRADING_PAIRS).map(pair => (
                                    <option key={pair.symbol} value={pair.symbol}>
                                        {pair.displayName} ({pair.category})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-section">
                        <h4>Trading Parameters</h4>

                        <div className="form-group">
                            <label htmlFor="amount">
                                Trade Amount ({selectedPairData?.baseAsset}):
                            </label>
                            <input
                                type="number"
                                id="amount"
                                name="amount"
                                step={selectedPairData?.stepSize || 0.001}
                                min={selectedPairData?.minQty || 0.001}
                                max={selectedPairData?.maxQty || 100000}
                                value={formData.amount}
                                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                                disabled={isLoading}
                            />
                            {validationErrors.amount && (
                                <span className="error-message">{validationErrors.amount}</span>
                            )}

                            {selectedPairData && (
                                <div className="amount-hints">
                                    <small>
                                        Min: {selectedPairData.minQty} |
                                        Step: {selectedPairData.stepSize} |
                                        Default: {selectedPairData.defaultAmount}
                                    </small>
                                </div>
                            )}
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="takeProfit">Take Profit (%):</label>
                                <input
                                    type="number"
                                    id="takeProfit"
                                    name="takeProfit"
                                    step="0.1"
                                    min="0.1"
                                    value={formData.takeProfit}
                                    onChange={(e) => setFormData(prev => ({ ...prev, takeProfit: parseFloat(e.target.value) }))}
                                    disabled={isLoading}
                                />
                                {validationErrors.takeProfit && (
                                    <span className="error-message">{validationErrors.takeProfit}</span>
                                )}
                            </div>

                            <div className="form-group">
                                <label htmlFor="stopLoss">Stop Loss (%):</label>
                                <input
                                    type="number"
                                    id="stopLoss"
                                    name="stopLoss"
                                    step="0.1"
                                    min="0.1"
                                    value={formData.stopLoss}
                                    onChange={(e) => setFormData(prev => ({ ...prev, stopLoss: parseFloat(e.target.value) }))}
                                    disabled={isLoading}
                                />
                                {validationErrors.stopLoss && (
                                    <span className="error-message">{validationErrors.stopLoss}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="submit"
                            disabled={isLoading || !apiConfig.isConfigured}
                            className="start-bot enhanced"
                        >
                            {isLoading ? (
                                <>
                                    <span className="loading-spinner small"></span>
                                    Starting Bot...
                                </>
                            ) : (
                                'Start Enhanced Trading Bot'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </ErrorBoundary>
    );
};