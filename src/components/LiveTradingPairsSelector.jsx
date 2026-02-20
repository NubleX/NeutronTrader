// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import { useEffect, useMemo, useState } from 'react';
import liveTradingPairsService from '../services/liveTradingPairsService';
import notificationService from '../services/notificationService';
import { withErrorHandling } from '../utils/errorHandler';

const CATEGORY_COLORS = {
    major: '#2196F3',
    defi: '#9C27B0',
    layer2: '#4CAF50',
    exchange: '#FF9800',
    meme: '#E91E63',
    gaming: '#795548',
    ai: '#607D8B',
    privacy: '#424242',
    other: '#9E9E9E'
};

const RISK_COLORS = {
    'very-low': '#4CAF50',
    'low': '#8BC34A',
    'medium': '#FF9800',
    'high': '#FF5722',
    'very-high': '#F44336',
    'unknown': '#9E9E9E'
};

export const LiveTradingPairsSelector = ({
    selectedSymbol,
    onSymbolSelect,
    disabled = false,
    showDetails = true,
    maxResults = 50
}) => {
    const [tradingPairs, setTradingPairs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('volume_desc');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [riskFilter, setRiskFilter] = useState('all');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Fetch trading pairs data
    const fetchTradingPairs = async () => {
        try {
            setLoading(true);
            setError(null);

            const pairs = await withErrorHandling(async () => {
                return await liveTradingPairsService.getTradingPairs({
                    includeInactive: false,
                    minVolume: 100000, // Minimum $100k daily volume
                    maxResults: maxResults,
                    sortBy: sortBy
                });
            }, { operation: 'fetch_trading_pairs' });

            setTradingPairs(pairs);
            setLastUpdated(new Date());

        } catch (err) {
            setError(err.message);
            notificationService.notify('api_error', { error: err.message });
        } finally {
            setLoading(false);
        }
    };

    // Initialize and fetch data
    useEffect(() => {
        const initializeService = async () => {
            try {
                await liveTradingPairsService.initialize({
                    coinGeckoApiKey: process.env.REACT_APP_COINGECKO_API_KEY,
                    coinMarketCapApiKey: process.env.REACT_APP_COINMARKETCAP_API_KEY
                });
                await fetchTradingPairs();
            } catch (err) {
                setError('Failed to initialize trading pairs service');
                console.error('Service initialization error:', err);
            }
        };

        initializeService();
    }, [sortBy, maxResults]);

    // Auto-refresh data every 30 seconds
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            if (!loading) {
                fetchTradingPairs();
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [autoRefresh, loading, sortBy]);

    // Filter and search trading pairs
    const filteredPairs = useMemo(() => {
        return tradingPairs.filter(pair => {
            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!pair.symbol.toLowerCase().includes(term) &&
                    !pair.baseAsset.toLowerCase().includes(term) &&
                    !pair.displayName.toLowerCase().includes(term)) {
                    return false;
                }
            }

            // Category filter
            if (categoryFilter !== 'all' && pair.category !== categoryFilter) {
                return false;
            }

            // Risk filter
            if (riskFilter !== 'all' && pair.riskLevel !== riskFilter) {
                return false;
            }

            return true;
        });
    }, [tradingPairs, searchTerm, categoryFilter, riskFilter]);

    // Get available categories and risk levels
    const availableCategories = useMemo(() => {
        const categories = [...new Set(tradingPairs.map(pair => pair.category))];
        return categories.sort();
    }, [tradingPairs]);

    const formatNumber = (num, decimals = 2) => {
        if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
        if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
        if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
        return num.toFixed(decimals);
    };

    const formatPrice = (price) => {
        if (price >= 1) return price.toFixed(2);
        if (price >= 0.01) return price.toFixed(4);
        return price.toFixed(6);
    };

    const formatPercentage = (percent) => {
        const sign = percent >= 0 ? '+' : '';
        return `${sign}${percent.toFixed(2)}%`;
    };

    const getPercentageColor = (percent) => {
        return percent >= 0 ? '#4CAF50' : '#F44336';
    };

    if (loading && tradingPairs.length === 0) {
        return (
            <div className="live-pairs-selector loading">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading live trading pairs...</p>
                </div>
            </div>
        );
    }

    if (error && tradingPairs.length === 0) {
        return (
            <div className="live-pairs-selector error">
                <div className="error-message">
                    <h3>Failed to load trading pairs</h3>
                    <p>{error}</p>
                    <button onClick={fetchTradingPairs} className="retry-btn">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="live-pairs-selector">
            <div className="pairs-header">
                <div className="header-title">
                    <h3>Live Trading Pairs</h3>
                    {lastUpdated && (
                        <span className="last-updated">
                            Last updated: {lastUpdated.toLocaleTimeString()}
                            {loading && <span className="updating"> (updating...)</span>}
                        </span>
                    )}
                </div>

                <div className="header-controls">
                    <button
                        onClick={fetchTradingPairs}
                        disabled={loading}
                        className="refresh-btn"
                        title="Refresh data"
                    >
                        🔄
                    </button>

                    <label className="auto-refresh-toggle">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto-refresh
                    </label>
                </div>
            </div>

            <div className="pairs-filters">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search pairs (e.g., BTC, ETH, BNB)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="filter-controls">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="sort-select"
                    >
                        <option value="volume_desc">Volume (High to Low)</option>
                        <option value="volume_asc">Volume (Low to High)</option>
                        <option value="change_desc">Gainers</option>
                        <option value="change_asc">Losers</option>
                        <option value="price_desc">Price (High to Low)</option>
                        <option value="price_asc">Price (Low to High)</option>
                        <option value="alphabetical">Alphabetical</option>
                    </select>

                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="category-select"
                    >
                        <option value="all">All Categories</option>
                        {availableCategories.map(category => (
                            <option key={category} value={category}>
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                            </option>
                        ))}
                    </select>

                    <select
                        value={riskFilter}
                        onChange={(e) => setRiskFilter(e.target.value)}
                        className="risk-select"
                    >
                        <option value="all">All Risk Levels</option>
                        {availableRiskLevels.map(risk => (
                            <option key={risk} value={risk}>
                                {risk.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="pairs-list">
                {filteredPairs.length === 0 ? (
                    <div className="no-pairs">
                        <p>No trading pairs match your filters</p>
                    </div>
                ) : (
                    filteredPairs.map(pair => (
                        <TradingPairCard
                            key={pair.symbol}
                            pair={pair}
                            isSelected={selectedSymbol === pair.symbol}
                            onSelect={() => onSymbolSelect(pair)}
                            disabled={disabled}
                            showDetails={showDetails}
                        />
                    ))
                )}
            </div>

            {filteredPairs.length > 0 && (
                <div className="pairs-footer">
                    <p>
                        Showing {filteredPairs.length} of {tradingPairs.length} pairs
                        {tradingPairs.length >= maxResults && (
                            <span> (limited to top {maxResults})</span>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
};

const TradingPairCard = ({ pair, isSelected, onSelect, disabled, showDetails }) => {
    const [detailsExpanded, setDetailsExpanded] = useState(false);

    const handleCardClick = () => {
        if (!disabled) {
            onSelect(pair);
        }
    };

    return (
        <div
            className={`pair-card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={handleCardClick}
        >
            <div className="pair-main-info">
                <div className="pair-identity">
                    <div className="pair-symbol">
                        <span className="base-asset">{pair.baseAsset}</span>
                        <span className="quote-asset">/{pair.quoteAsset}</span>
                    </div>

                    <div className="pair-badges">
                        <span
                            className="category-badge"
                            style={{ backgroundColor: CATEGORY_COLORS[pair.category] }}
                        >
                            {pair.category}
                        </span>

                        <span
                            className="risk-badge"
                            style={{ backgroundColor: RISK_COLORS[pair.riskLevel] }}
                        >
                            {pair.riskLevel.replace('-', ' ')}
                        </span>
                    </div>
                </div>

                <div className="pair-metrics">
                    <div className="price-info">
                        <span className="current-price">${formatPrice(pair.price)}</span>
                        <span
                            className="price-change"
                            style={{ color: getPercentageColor(pair.priceChange24h) }}
                        >
                            {formatPercentage(pair.priceChange24h)}
                        </span>
                    </div>

                    <div className="volume-info">
                        <span className="volume-label">24h Vol:</span>
                        <span className="volume-value">${formatNumber(pair.volume24h)}</span>
                    </div>
                </div>

                {showDetails && (
                    <button
                        className="details-toggle"
                        onClick={(e) => {
                            e.stopPropagation();
                            setDetailsExpanded(!detailsExpanded);
                        }}
                    >
                        {detailsExpanded ? '▲' : '▼'}
                    </button>
                )}
            </div>

            {showDetails && detailsExpanded && (
                <div className="pair-details">
                    <div className="details-grid">
                        <div className="detail-item">
                            <span className="label">24h High:</span>
                            <span className="value">${formatPrice(pair.high24h)}</span>
                        </div>

                        <div className="detail-item">
                            <span className="label">24h Low:</span>
                            <span className="value">${formatPrice(pair.low24h)}</span>
                        </div>

                        <div className="detail-item">
                            <span className="label">Min Quantity:</span>
                            <span className="value">{pair.minQty}</span>
                        </div>

                        <div className="detail-item">
                            <span className="label">Step Size:</span>
                            <span className="value">{pair.stepSize}</span>
                        </div>

                        <div className="detail-item">
                            <span className="label">Min Notional:</span>
                            <span className="value">${pair.minNotional}</span>
                        </div>

                        <div className="detail-item">
                            <span className="label">Default Amount:</span>
                            <span className="value">{pair.defaultAmount} {pair.baseAsset}</span>
                        </div>
                    </div>

                    <div className="volatility-indicator">
                        <span className="label">Volatility:</span>
                        <div className="volatility-bar">
                            <div
                                className="volatility-fill"
                                style={{
                                    width: `${Math.min(Math.abs(pair.priceChange24h) * 5, 100)}%`,
                                    backgroundColor: RISK_COLORS[pair.volatility] || '#9E9E9E'
                                }}
                            />
                        </div>
                        <span className="volatility-text">{pair.volatility.replace('-', ' ')}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// Hook for using live trading pairs data
export const useLiveTradingPairs = (options = {}) => {
    const [pairs, setPairs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPairs = async () => {
            try {
                setLoading(true);
                setError(null);

                const tradingPairs = await liveTradingPairsService.getTradingPairs(options);
                setPairs(tradingPairs);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPairs();
    }, [JSON.stringify(options)]);

    const refreshPairs = async () => {
        try {
            setError(null);
            const tradingPairs = await liveTradingPairsService.getTradingPairs(options);
            setPairs(tradingPairs);
        } catch (err) {
            setError(err.message);
        }
    };

    return {
        pairs,
        loading,
        error,
        refreshPairs
    };
};

// Hook for live price updates
export const useLivePrices = (symbols, updateInterval = 30000) => {
    const [prices, setPrices] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!symbols || symbols.length === 0) return;

        const fetchPrices = async () => {
            try {
                const livePrices = await liveTradingPairsService.getLivePrices(symbols);
                setPrices(livePrices);
                setLoading(false);
            } catch (error) {
                console.error('Failed to fetch live prices:', error);
            }
        };

        // Initial fetch
        fetchPrices();

        // Set up interval for updates
        const interval = setInterval(fetchPrices, updateInterval);

        return () => clearInterval(interval);
    }, [symbols, updateInterval]);

    return { prices, loading };
};

export default LiveTradingPairsSelector;

const availableRiskLevels = useMemo(() => {
    const risks = [...new Set(tradingPairs.map(pair => pair.riskLevel))];
    return risks.sort((a, b) => {
        const order = ['very-low', 'low', 'medium', 'high', 'very-high'];
        return order.indexOf(a) - order.indexOf(b);
    });
})