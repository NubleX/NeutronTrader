// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import React, { useState, useEffect } from 'react';
import { getTradeHistory } from '../services/binanceService';

function TradingHistory({ apiConfig }) {
  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({
    symbol: 'all',
    dateRange: '7days'
  });

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        setIsLoading(true);
        const history = await getTradeHistory(apiConfig, filter);
        setTrades(history);
        setIsLoading(false);
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchTrades();
  }, [apiConfig, filter]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Calculate profit/loss statistics
  const calculateStats = () => {
    if (!trades.length) return { total: 0, profit: 0, loss: 0 };
    
    const total = trades.reduce((sum, trade) => sum + trade.profit, 0);
    const profitTrades = trades.filter(t => t.profit > 0);
    const lossTrades = trades.filter(t => t.profit < 0);
    
    const profit = profitTrades.reduce((sum, t) => sum + t.profit, 0);
    const loss = lossTrades.reduce((sum, t) => sum + t.profit, 0);
    
    return { total, profit, loss };
  };

  const stats = calculateStats();

  if (isLoading) return <div className="loading">Loading trade history...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="trading-history">
      <h2>Trading History</h2>
      
      <div className="filter-controls">
        <div className="form-group">
          <label htmlFor="symbol">Symbol:</label>
          <select 
            id="symbol" 
            name="symbol" 
            value={filter.symbol}
            onChange={handleFilterChange}
          >
            <option value="all">All Pairs</option>
            <option value="BTCUSDT">BTC/USDT</option>
            <option value="ETHUSDT">ETH/USDT</option>
            <option value="BNBUSDT">BNB/USDT</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="dateRange">Date Range:</label>
          <select 
            id="dateRange" 
            name="dateRange" 
            value={filter.dateRange}
            onChange={handleFilterChange}
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>
      
      <div className="stats-summary">
        <div className="stat">
          <h4>Total P/L</h4>
          <span className={stats.total >= 0 ? 'profit' : 'loss'}>
            ${stats.total.toFixed(2)}
          </span>
        </div>
        <div className="stat">
          <h4>Total Profit</h4>
          <span className="profit">${stats.profit.toFixed(2)}</span>
        </div>
        <div className="stat">
          <h4>Total Loss</h4>
          <span className="loss">${stats.loss.toFixed(2)}</span>
        </div>
      </div>
      
      {trades.length === 0 ? (
        <p>No trades found for the selected filters.</p>
      ) : (
        <table className="trades-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Type</th>
              <th>Price</th>
              <th>Amount</th>
              <th>Total</th>
              <th>P/L</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(trade => (
              <tr key={trade.id}>
                <td>{new Date(trade.time).toLocaleString()}</td>
                <td>{trade.symbol}</td>
                <td>{trade.side}</td>
                <td>${parseFloat(trade.price).toFixed(2)}</td>
                <td>{parseFloat(trade.qty).toFixed(8)}</td>
                <td>${(trade.price * trade.qty).toFixed(2)}</td>
                <td className={trade.profit >= 0 ? 'profit' : 'loss'}>
                  ${trade.profit.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default TradingHistory;