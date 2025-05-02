import React, { useState } from 'react';
import { getStrategies } from '../utils/tradingStrategies';
const { ipcRenderer } = window.require('electron');

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

  const strategies = getStrategies();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Send configuration to Electron main process
    ipcRenderer.send('start-trading-bot', {
      ...formData,
      apiConfig
    });
    
    setFormData({
      ...formData,
      isActive: true
    });
  };

  const handleStopBot = () => {
    ipcRenderer.send('stop-trading-bot');
    setFormData({
      ...formData,
      isActive: false
    });
  };

  return (
    <div className="trade-setup">
      <h2>Trading Bot Setup</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="symbol">Trading Pair:</label>
          <select 
            id="symbol" 
            name="symbol" 
            value={formData.symbol}
            onChange={handleChange}
            disabled={formData.isActive}
          >
            <option value="BTCUSDT">BTC/USDT</option>
            <option value="ETHUSDT">ETH/USDT</option>
            <option value="BNBUSDT">BNB/USDT</option>
            <option value="ADAUSDT">ADA/USDT</option>
            <option value="DOGEUSDT">DOGE/USDT</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="strategy">Trading Strategy:</label>
          <select 
            id="strategy" 
            name="strategy" 
            value={formData.strategy}
            onChange={handleChange}
            disabled={formData.isActive}
          >
            {Object.keys(strategies).map(strategy => (
              <option key={strategy} value={strategy}>
                {strategies[strategy].name}
              </option>
            ))}
          </select>
          
          {formData.strategy && (
            <p className="strategy-description">
              {strategies[formData.strategy].description}
            </p>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="amount">Trade Amount:</label>
          <input 
            type="number" 
            id="amount" 
            name="amount" 
            step="0.0001"
            min="0.0001"
            value={formData.amount}
            onChange={handleChange}
            disabled={formData.isActive}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="interval">Time Interval:</label>
          <select 
            id="interval" 
            name="interval" 
            value={formData.interval}
            onChange={handleChange}
            disabled={formData.isActive}
          >
            <option value="1m">1 minute</option>
            <option value="5m">5 minutes</option>
            <option value="15m">15 minutes</option>
            <option value="1h">1 hour</option>
            <option value="4h">4 hours</option>
            <option value="1d">1 day</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="takeProfit">Take Profit (%):</label>
          <input 
            type="number" 
            id="takeProfit" 
            name="takeProfit" 
            step="0.1"
            min="0.1"
            value={formData.takeProfit}
            onChange={handleChange}
            disabled={formData.isActive}
          />
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
            onChange={handleChange}
            disabled={formData.isActive}
          />
        </div>
        
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
