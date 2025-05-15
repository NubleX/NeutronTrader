// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import React, { useState, useEffect } from 'react';
import { getAccountInfo, getPrices } from '../services/binanceService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function Dashboard({ apiConfig }) {
  const [accountInfo, setAccountInfo] = useState(null);
  const [priceData, setPriceData] = useState([]);
  const [selectedPair, setSelectedPair] = useState('BNBUSDT');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState({
    status: 'pending',
    message: 'Connecting to Binance Testnet...'
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setApiStatus({
          status: 'pending',
          message: 'Connecting to Binance Testnet...'
        });
        
        // Get account info
        const account = await getAccountInfo(apiConfig);
        setAccountInfo(account);
        
        setApiStatus({
          status: 'success',
          message: 'Successfully connected to Binance Testnet'
        });
        
        // Fetch price data for selected pair
        const prices = await getPrices(selectedPair, apiConfig);
        setPriceData(prices);
        
        setIsLoading(false);
        setError(null);
      } catch (err) {
        console.error('Dashboard error:', err);
        setError(err.message);
        setIsLoading(false);
        
        setApiStatus({
          status: 'error',
          message: `API Connection Error: ${err.message}`
        });
      }
    };

    fetchData();
    // Set up interval to refresh data
    const intervalId = setInterval(fetchData, 30000); // every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [apiConfig, selectedPair]);

  const renderApiStatus = () => {
    const { status, message } = apiStatus;
    
    if (status === 'pending') {
      return (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <div className="loading-message">{message}</div>
        </div>
      );
    }
    
    if (status === 'error') {
      return (
        <div className="api-status error">
          <div className="api-status-icon">⚠️</div>
          <div className="api-status-message">{message}</div>
          <div className="api-status-actions">
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        </div>
      );
    }
    
    if (status === 'success' && accountInfo) {
      return (
        <div className="api-status success">
          <div className="api-status-icon">✓</div>
          <div className="api-status-message">{message}</div>
        </div>
      );
    }
    
    return null;
  };

  if (isLoading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <div className="loading-message">Loading dashboard data...</div>
      </div>
    );
  }

  if (error && !accountInfo) {
    return (
      <div className="dashboard">
        <div className="api-status error">
          <div className="api-status-icon">⚠️</div>
          <div className="api-status-message">
            <strong>Error: {error}</strong>
            <p>Unable to connect to Binance Testnet. Please check your API keys and network connection.</p>
            <p>Make sure your API key has the "TRADE, USER_DATA, USER_STREAM" permissions.</p>
          </div>
          <div className="api-status-actions">
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {renderApiStatus()}
      
      <div className="balance-overview">
        <h3>Account Balance</h3>
        {accountInfo && accountInfo.balances && (
          <div className="balances">
            {accountInfo.balances
              .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
              .map(balance => (
                <div key={balance.asset} className="balance-item">
                  <span>{balance.asset}:</span>
                  <span>{parseFloat(balance.free).toFixed(8)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
      
      <div className="price-chart">
        <h3>{selectedPair} Price Chart</h3>
        <select 
          value={selectedPair}
          onChange={e => setSelectedPair(e.target.value)}
        >
          <option value="BNBUSDT">BNB/USDT</option>
          <option value="BTCUSDT">BTC/USDT</option>
          <option value="ETHUSDT">ETH/USDT</option>
        </select>
        
        {priceData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={priceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#2962ff" 
                activeDot={{ r: 8 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="api-status info" style={{ marginTop: '1rem' }}>
            <div className="api-status-icon">ℹ️</div>
            <div className="api-status-message">
              No price data available for {selectedPair}. Try selecting a different trading pair.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;