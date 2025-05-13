// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import React, { useState, useEffect } from 'react';
import { getStrategies } from '../utils/tradingStrategies';

function TradeSetup({ apiConfig }) {
  const [formData, setFormData] = useState({
    symbol: 'BTCUSDT',
    strategy: 'simpleMovingAverage',
    amount: 0.001,
    interval: '15m',
    takeProfit: 3.0, // percentage
    stopLoss: 2.0,   // percentage
    isActive: false
  });
  const [statusMessage, setStatusMessage] = useState('');

  const strategies = getStrategies();

  useEffect(() => {
    // Set up listeners for trading status messages
    if (window.api) {
      window.api.receive('trading-status', (data) => {
        console.log('Received trading status:', data);
        setFormData(prev => ({
          ...prev,
          isActive: data.status === 'started'
        }));
        
        setStatusMessage(
          data.status === 'started' 
            ? 'Trading bot started successfully' 
            : 'Trading bot stopped'
        );
      });
      
      window.api.receive('trading-error', (error) => {
        console.error('Trading error:', error);
        setStatusMessage(`Error: ${error}`);
      });
    }
    
    return () => {
      // Cleanup could go here if needed
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (window.api) {
      // Send configuration to Electron main process using the secure bridge
      window.api.send('start-trading-bot', {
        ...formData,
        apiConfig
      });
      
      setStatusMessage('Starting trading bot...');
    } else {
      console.log('Running in browser mode - would start trading with:', {
        ...formData,
        apiConfig
      });
      
      // For browser testing only
      setFormData({
        ...formData,
        isActive: true
      });
      
      setStatusMessage('Browser mode: Trading bot would start (simulation)');
    }
  };

  const handleStopBot = () => {
    if (window.api) {
      window.api.send('stop-trading-bot');
      setStatusMessage('Stopping trading bot...');
    } else {
      console.log('Running in browser mode - would stop trading');
      setFormData({
        ...formData,
        isActive: false
      });
      setStatusMessage('Browser mode: Trading bot would stop (simulation)');
    }
  };

  // Rest of your component remains the same
  return (
    <div className="trade-setup">
      <h2>Trading Bot Setup</h2>
      
      {statusMessage && (
        <div className={`status-message ${formData.isActive ? 'active' : ''}`}>
          {statusMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* Form groups as before */}
        
        {!formData.isActive ? (
          <button type="submit" className="start-bot">Start Trading Bot</button>
        ) : (
          <button type="button" className="stop-bot" onClick={handleStopBot}>
            Stop Trading Bot
          </button>
        )}
      </form>
      
      {formData.isActive && (
        <div className="bot-status active">
          <h3>Bot is currently active</h3>
          <p>Trading {formData.symbol} using {strategies[formData.strategy].name} strategy</p>
          <p>Amount per trade: {formData.amount}</p>
          <p>Checking market every: {formData.interval}</p>
        </div>
      )}
    </div>
  );
}

export default TradeSetup;
