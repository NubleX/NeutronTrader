// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import { useEffect, useRef, useState } from 'react';

const BloombergTerminalDashboard = () => {
  const [marketData, setMarketData] = useState({});
  const [connectionStatus, setConnectionStatus] = useState({});
  const [orderBook, setOrderBook] = useState({});
  const [trades, setTrades] = useState([]);
  const [watchlist, setWatchlist] = useState(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT']);
  const [isInitialized, setIsInitialized] = useState(false);
  const [dataFeedStatus, setDataFeedStatus] = useState('CONNECTING...');
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  // Check if Electron API is available
  const isElectronAvailable = typeof window !== 'undefined' && window.electronAPI;

  useEffect(() => {
    initializeTerminal();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const initializeTerminal = async () => {
    if (!isElectronAvailable) {
      setError('Electron API not available. Please run in Electron environment.');
      setDataFeedStatus('ERROR - REQUIRES ELECTRON');
      return;
    }

    try {
      console.log('Initializing professional trading terminal...');

      // Test API connectivity
      const pingResult = await window.electronAPI.binance.ping();
      if (!pingResult.success) {
        throw new Error(`API ping failed: ${pingResult.error}`);
      }

      setConnectionStatus({
        binance_api: { status: 'connected', lastPing: Date.now() }
      });

      // Start real data feeds
      await startRealDataFeeds();

      setIsInitialized(true);
      setDataFeedStatus('LIVE');
      console.log('✓ Terminal initialized with real data feeds');

    } catch (error) {
      console.error('Failed to initialize terminal:', error);
      setError(`Initialization failed: ${error.message}`);
      setDataFeedStatus('ERROR');
    }
  };

  const startRealDataFeeds = async () => {
    // Get initial market data for watchlist
    for (const symbol of watchlist) {
      await updateSymbolData(symbol);
    }

    // Set up continuous updates
    intervalRef.current = setInterval(async () => {
      for (const symbol of watchlist) {
        await updateSymbolData(symbol);
      }

      // Update connection status
      await updateConnectionStatus();
    }, 2000); // Update every 2 seconds
  };

  const updateSymbolData = async (symbol) => {
    try {
      // Get current price
      const priceResult = await window.electronAPI.binance.getPrices(symbol);
      if (priceResult.success) {
        const priceData = priceResult.data;

        setMarketData(prev => ({
          ...prev,
          [symbol]: {
            price: parseFloat(priceData.price || priceData),
            lastUpdate: Date.now(),
            source: 'binance_api'
          }
        }));
      }

      // Get 24hr ticker stats for additional data
      try {
        const candleResult = await window.electronAPI.binance.getCandles(symbol, '1h', { limit: 24 });
        if (candleResult.success && candleResult.data.length > 0) {
          const candles = candleResult.data;
          const latest = candles[candles.length - 1];
          const previous = candles[candles.length - 2];

          if (latest && previous) {
            const currentPrice = parseFloat(latest.close);
            const previousPrice = parseFloat(previous.close);
            const change = ((currentPrice - previousPrice) / previousPrice) * 100;

            // Calculate 24h high/low/volume from candles
            const high24h = Math.max(...candles.map(c => parseFloat(c.high)));
            const low24h = Math.min(...candles.map(c => parseFloat(c.low)));
            const volume24h = candles.reduce((sum, c) => sum + parseFloat(c.volume), 0);

            setMarketData(prev => ({
              ...prev,
              [symbol]: {
                ...prev[symbol],
                price: currentPrice,
                change: change,
                volume: volume24h,
                high: high24h,
                low: low24h,
                lastUpdate: Date.now(),
                source: 'binance_api'
              }
            }));
          }
        }
      } catch (candleError) {
        console.warn(`Could not get candle data for ${symbol}:`, candleError);
      }

    } catch (error) {
      console.error(`Failed to update data for ${symbol}:`, error);

      setMarketData(prev => ({
        ...prev,
        [symbol]: {
          ...prev[symbol],
          error: error.message,
          lastUpdate: Date.now(),
          source: 'error'
        }
      }));
    }
  };

  const updateConnectionStatus = async () => {
    try {
      const pingResult = await window.electronAPI.binance.ping();
      const pingTime = Date.now();

      setConnectionStatus(prev => ({
        ...prev,
        binance_api: {
          status: pingResult.success ? 'connected' : 'disconnected',
          lastPing: pingTime,
          error: pingResult.success ? null : pingResult.error
        }
      }));
    } catch (error) {
      setConnectionStatus(prev => ({
        ...prev,
        binance_api: {
          status: 'error',
          lastPing: Date.now(),
          error: error.message
        }
      }));
    }
  };

  const addToWatchlist = async (symbol) => {
    const upperSymbol = symbol.toUpperCase();
    if (!watchlist.includes(upperSymbol)) {
      const newWatchlist = [...watchlist, upperSymbol];
      setWatchlist(newWatchlist);

      // Immediately fetch data for new symbol
      await updateSymbolData(upperSymbol);
    }
  };

  const removeFromWatchlist = (symbol) => {
    const newWatchlist = watchlist.filter(s => s !== symbol);
    setWatchlist(newWatchlist);

    // Clean up market data
    setMarketData(prev => {
      const newData = { ...prev };
      delete newData[symbol];
      return newData;
    });
  };

  const formatPrice = (price) => {
    if (!price || isNaN(price)) return '-.--';
    return parseFloat(price).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    });
  };

  const formatChange = (change) => {
    if (!change || isNaN(change)) return 'N/A';
    const formatted = parseFloat(change).toFixed(2);
    return `${change >= 0 ? '+' : ''}${formatted}%`;
  };

  const getPriceColor = (change) => {
    if (!change || isNaN(change)) return '#ffffff';
    return change >= 0 ? '#00ff88' : '#ff4444';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return '#00ff88';
      case 'connecting': return '#ffaa00';
      case 'disconnected':
      case 'error':
      default: return '#ff4444';
    }
  };

  if (error) {
    return (
      <div style={{
        backgroundColor: '#000000',
        color: '#ff4444',
        fontFamily: 'Monaco, Consolas, monospace',
        fontSize: '14px',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#ff4444', marginBottom: '20px' }}>NEUTRON TERMINAL - ERROR</h1>
        <div style={{ marginBottom: '20px' }}>{error}</div>
        <div style={{ color: '#888', fontSize: '12px' }}>
          This terminal requires Electron environment with Binance API access.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#000000',
      color: '#ffffff',
      fontFamily: 'Monaco, Consolas, monospace',
      fontSize: '12px',
      height: '100vh',
      overflow: 'hidden',
      padding: '10px'
    }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid #333',
        paddingBottom: '10px',
        marginBottom: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{
          color: '#00ff88',
          fontSize: '18px',
          margin: 0,
          fontWeight: 'bold'
        }}>
          NEUTRON TERMINAL v2.0 - REAL DATA
        </h1>

        <div style={{ display: 'flex', gap: '20px', fontSize: '10px' }}>
          {Object.entries(connectionStatus).map(([feed, status]) => (
            <div key={feed} style={{
              color: getStatusColor(status.status)
            }}>
              {feed.toUpperCase()}: {status.status.toUpperCase()}
              {status.error && ` (${status.error})`}
            </div>
          ))}
          <div style={{
            color: isInitialized ? '#00ff88' : '#ffaa00'
          }}>
            STATUS: {dataFeedStatus}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', height: 'calc(100% - 60px)' }}>

        {/* Market Watch Panel */}
        <div style={{
          border: '1px solid #333',
          borderRadius: '4px',
          padding: '10px',
          backgroundColor: '#111'
        }}>
          <div style={{
            borderBottom: '1px solid #333',
            paddingBottom: '5px',
            marginBottom: '10px',
            color: '#00ff88',
            fontWeight: 'bold'
          }}>
            LIVE MARKET WATCH
          </div>

          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Add symbol (e.g., BTCUSDT)"
              style={{
                backgroundColor: '#222',
                border: '1px solid #333',
                color: '#fff',
                padding: '5px',
                width: '100%',
                fontSize: '11px'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addToWatchlist(e.target.value);
                  e.target.value = '';
                }
              }}
            />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto auto auto',
            gap: '5px',
            fontSize: '10px',
            borderBottom: '1px solid #333',
            paddingBottom: '5px',
            marginBottom: '5px'
          }}>
            <div style={{ color: '#888' }}>SYMBOL</div>
            <div style={{ color: '#888', textAlign: 'right' }}>PRICE</div>
            <div style={{ color: '#888', textAlign: 'right' }}>CHANGE</div>
            <div style={{ color: '#888', textAlign: 'right' }}>VOLUME</div>
            <div style={{ color: '#888' }}>STATUS</div>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {watchlist.map(symbol => {
              const data = marketData[symbol];
              const hasData = data && data.price && !data.error;
              const isStale = data && Date.now() - data.lastUpdate > 10000; // 10 seconds

              return (
                <div key={symbol} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto auto',
                  gap: '5px',
                  padding: '3px 0',
                  borderBottom: '1px solid #222',
                  fontSize: '10px',
                  backgroundColor: isStale ? 'rgba(255, 170, 0, 0.1)' : 'transparent'
                }}>
                  <div style={{
                    color: '#fff',
                    cursor: 'pointer'
                  }} onClick={() => removeFromWatchlist(symbol)}>
                    {symbol}
                  </div>
                  <div style={{
                    textAlign: 'right',
                    color: hasData ? '#fff' : '#666'
                  }}>
                    {hasData ? formatPrice(data.price) : 'NO DATA'}
                  </div>
                  <div style={{
                    textAlign: 'right',
                    color: hasData ? getPriceColor(data.change) : '#666'
                  }}>
                    {hasData ? formatChange(data.change) : 'N/A'}
                  </div>
                  <div style={{
                    textAlign: 'right',
                    color: '#888'
                  }}>
                    {hasData && data.volume ? (data.volume / 1000000).toFixed(1) + 'M' : 'N/A'}
                  </div>
                  <div style={{
                    color: data?.error ? '#ff4444' : (hasData ? '#00ff88' : '#888'),
                    fontSize: '8px'
                  }}>
                    {data?.error ? 'ERR' : (hasData ? 'LIVE' : 'WAIT')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real Data Info Panel */}
        <div style={{
          border: '1px solid #333',
          borderRadius: '4px',
          padding: '10px',
          backgroundColor: '#111'
        }}>
          <div style={{
            borderBottom: '1px solid #333',
            paddingBottom: '5px',
            marginBottom: '10px',
            color: '#00ff88',
            fontWeight: 'bold'
          }}>
            REAL-TIME DATA STATUS
          </div>

          <div style={{ fontSize: '11px', lineHeight: '1.5' }}>
            <div style={{ marginBottom: '15px' }}>
              <div style={{ color: '#888', marginBottom: '5px' }}>Data Sources:</div>
              <div style={{ color: '#00ff88' }}>• Binance Testnet API</div>
              <div style={{ color: '#fff' }}>• Real-time price feeds</div>
              <div style={{ color: '#fff' }}>• Live candlestick data</div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ color: '#888', marginBottom: '5px' }}>Update Frequency:</div>
              <div style={{ color: '#fff' }}>Every 2 seconds</div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ color: '#888', marginBottom: '5px' }}>Symbols Monitored:</div>
              <div style={{ color: '#fff' }}>{watchlist.length} active symbols</div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ color: '#888', marginBottom: '5px' }}>Last Update:</div>
              {Object.keys(marketData).length > 0 ? (
                <div style={{ color: '#fff' }}>
                  {new Date(Math.max(...Object.values(marketData).map(d => d.lastUpdate || 0))).toLocaleTimeString()}
                </div>
              ) : (
                <div style={{ color: '#666' }}>No data yet</div>
              )}
            </div>

            <div style={{
              border: '1px solid #333',
              padding: '10px',
              backgroundColor: '#000',
              borderRadius: '4px'
            }}>
              <div style={{ color: '#00ff88', marginBottom: '5px' }}>ARCHITECTURE:</div>
              <div style={{ color: '#fff', fontSize: '9px' }}>
                React UI → Electron IPC → Binance API<br />
                No CORS restrictions<br />
                Real market data only<br />
                Professional-grade feeds
              </div>
            </div>
          </div>
        </div>

        {/* Live Metrics Panel */}
        <div style={{
          border: '1px solid #333',
          borderRadius: '4px',
          padding: '10px',
          backgroundColor: '#111'
        }}>
          <div style={{
            borderBottom: '1px solid #333',
            paddingBottom: '5px',
            marginBottom: '10px',
            color: '#00ff88',
            fontWeight: 'bold'
          }}>
            LIVE METRICS
          </div>

          <div style={{ fontSize: '10px' }}>
            {watchlist.map(symbol => {
              const data = marketData[symbol];
              if (!data || data.error) return null;

              return (
                <div key={symbol} style={{
                  marginBottom: '15px',
                  padding: '8px',
                  border: '1px solid #333',
                  borderRadius: '3px',
                  backgroundColor: '#000'
                }}>
                  <div style={{
                    color: '#00ff88',
                    fontWeight: 'bold',
                    marginBottom: '5px'
                  }}>
                    {symbol}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '5px'
                  }}>
                    <div>
                      <span style={{ color: '#888' }}>Price: </span>
                      <span style={{ color: '#fff' }}>{formatPrice(data.price)}</span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>24h: </span>
                      <span style={{ color: getPriceColor(data.change) }}>
                        {formatChange(data.change)}
                      </span>
                    </div>
                    {data.high && (
                      <div>
                        <span style={{ color: '#888' }}>High: </span>
                        <span style={{ color: '#fff' }}>{formatPrice(data.high)}</span>
                      </div>
                    )}
                    {data.low && (
                      <div>
                        <span style={{ color: '#888' }}>Low: </span>
                        <span style={{ color: '#fff' }}>{formatPrice(data.low)}</span>
                      </div>
                    )}
                  </div>

                  <div style={{
                    fontSize: '8px',
                    color: '#666',
                    marginTop: '5px'
                  }}>
                    Updated: {new Date(data.lastUpdate).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#000',
        borderTop: '1px solid #333',
        padding: '5px 10px',
        fontSize: '10px',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <div style={{ color: '#888' }}>
          NeutronTrader Professional Terminal - Live Market Data Only
        </div>
        <div style={{ color: isInitialized ? '#00ff88' : '#ff4444' }}>
          {dataFeedStatus}
        </div>
      </div>
    </div>
  );
};

export default BloombergTerminalDashboard;