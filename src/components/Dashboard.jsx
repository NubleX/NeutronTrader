// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import React, { useState, useEffect } from 'react';
import { getAccountInfo, getPrices } from '../services/binanceService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function Dashboard({ apiConfig }) {
  const [accountInfo, setAccountInfo] = useState(null);
  const [priceData, setPriceData] = useState([]);
  const [selectedPair, setSelectedPair] = useState('BTCUSDT');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const account = await getAccountInfo(apiConfig);
        setAccountInfo(account);
        
        // Fetch price data for selected pair
        const prices = await getPrices(selectedPair);
        setPriceData(prices);
        
        setIsLoading(false);
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchData();
    // Set up interval to refresh data
    const intervalId = setInterval(fetchData, 30000); // every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [apiConfig, selectedPair]);

  if (isLoading) return <div className="loading">Loading dashboard data...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="dashboard">
      <div className="balance-overview">
        <h3>Account Balance</h3>
        {accountInfo && accountInfo.balances && (
          <div className="balances">
            {accountInfo.balances
              .filter(b => parseFloat(b.free) > 0)
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
          <option value="BTCUSDT">BTC/USDT</option>
          <option value="ETHUSDT">ETH/USDT</option>
          <option value="BNBUSDT">BNB/USDT</option>
        </select>
        
        {priceData.length > 0 && (
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
        )}
      </div>
    </div>
  );
}

export default Dashboard;