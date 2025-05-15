// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import React, { useState, useEffect } from 'react';
import { getStrategies } from '../utils/tradingStrategies';
import { 
  getAssetBalance, 
  startTradingBot, 
  stopTradingBot, 
  registerTradingBotListeners 
} from '../services/binanceService';

// Safely get the api object (for Electron)
const getApi = () => {
  return window.api || null;
};

function TradeSetup({ apiConfig }) {
  const [formData, setFormData] = useState({
    symbol: 'BNBUSDT', // Default to BNB/USDT
    strategy: 'simpleMovingAverage',
    amount: 0.1, // Amount in BNB (or base asset)
    interval: '15m',
    takeProfit: 3.0, // percentage
    stopLoss: 2.0,   // percentage
    isActive: false
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [balances, setBalances] = useState({
    base: { asset: 'BNB', free: 0 },
    quote: { asset: 'USDT', free: 0 }
  });

  const strategies = getStrategies();
  const api = getApi();

  // Get current base and quote asset from symbol
  const getAssets = (symbol) => {
    // Assuming all symbols end with 'USDT'
    const baseAsset = symbol.replace('USDT', '');
    const quoteAsset = 'USDT';
    return { baseAsset, quoteAsset };
  };

  // Define fetchBalances function to be reused
  const fetchBalances = async () => {
    if (apiConfig.isConfigured) {
      try {
        const { baseAsset, quoteAsset } = getAssets(formData.symbol);
        
        const baseBalance = await getAssetBalance(apiConfig, baseAsset);
        const quoteBalance = await getAssetBalance(apiConfig, quoteAsset);
        
        setBalances({
          base: { asset: baseAsset, free: baseBalance.free },
          quote: { asset: quoteAsset, free: quoteBalance.free }
        });
      } catch (err) {
        console.error('Error fetching balances:', err);
        setStatusMessage(`Error fetching balances: ${err.message}`);
      }
    }
  };

  // Fetch balances when component mounts or symbol/apiConfig changes
  useEffect(() => {
    fetchBalances();
  }, [apiConfig, formData.symbol]);

  useEffect(() => {
    // Set up listeners for trading status messages
    if (api) {
      api.receive('trading-status', (data) => {
        console.log('Received trading status:', data);
        setFormData(prev => ({
          ...prev,
          isActive: data.status === 'started'
        }));
        
        setStatusMessage(
          data.status === 'started' 
            ? `Trading bot started successfully. ${data.message || ''}` 
            : `Trading bot stopped. ${data.message || ''}`
        );
      });
      
      api.receive('trading-error', (error) => {
        console.error('Trading error:', error);
        setStatusMessage(`Error: ${error}`);
      });

      api.receive('trade-executed', (data) => {
        console.log('Trade executed:', data);
        setStatusMessage(`Trade executed: ${data.side} ${data.quantity} ${data.symbol} at ${data.price}`);
        
        // Refresh balances after trade
        fetchBalances();
      });
    }
    
    return () => {
      // Cleanup could go here if needed
    };
  }, [apiConfig]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // If symbol is changed, update amount based on typical trade sizes
    if (name === 'symbol') {
      // Adjust the default amount based on the selected symbol
      let defaultAmount;
      switch (value) {
        case 'BTCUSDT':
          defaultAmount = 0.001; // Small BTC amount
          break;
        case 'ETHUSDT':
          defaultAmount = 0.01; // Small ETH amount
          break;
        case 'BNBUSDT':
          defaultAmount = 0.1; // Small BNB amount
          break;
        default:
          defaultAmount = 1; // Default for other pairs
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: value,
        amount: defaultAmount
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : 
                type === 'number' ? parseFloat(value) : value
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (api) {
      api.send('start-trading-bot', {
        ...formData,
        apiConfig
      });
      
      setStatusMessage('Starting trading bot...');
    } else {
      // Use the startTradingBot function for the browser environment
      startTradingBot({
        ...formData,
        apiConfig
      })
        .then(response => {
          setStatusMessage(response.message || 'Trading bot started successfully');
          setFormData({
            ...formData,
            isActive: response.status === 'started'
          });
        })
        .catch(error => {
          setStatusMessage(`Error: ${error.message}`);
        });
    }
  };

  const handleStopBot = () => {
    if (api) {
      api.send('stop-trading-bot', {});
      setStatusMessage('Stopping trading bot...');
    } else {
      // Use the stopTradingBot function for the browser environment
      stopTradingBot()
        .then(response => {
          setStatusMessage(response.message || 'Trading bot stopped');
          setFormData({
            ...formData,
            isActive: false
          });
        })
        .catch(error => {
          setStatusMessage(`Error: ${error.message}`);
        });
    }
  };

  // Add an effect to register trading bot event listeners for when electronAPI is available
  useEffect(() => {
    // Only register event listeners if the Electron API is available
    if (window.electronAPI) {
      // Register event listeners for the trading bot
      const cleanup = registerTradingBotListeners({
        onStatus: (data) => {
          console.log('Received trading status:', data);
          setFormData(prev => ({
            ...prev,
            isActive: data.status === 'started'
          }));
          
          setStatusMessage(
            data.status === 'started' 
              ? `Trading bot started successfully. ${data.message || ''}` 
              : `Trading bot stopped. ${data.message || ''}`
          );
        },
        
        onError: (error) => {
          console.error('Trading error:', error);
          setStatusMessage(`Error: ${error}`);
        },
        
        onTradeExecuted: (data) => {
          console.log('Trade executed:', data);
          setStatusMessage(`Trade executed: ${data.side} ${data.quantity} ${data.symbol} at ${data.price}`);
          
          // Refresh balances after trade
          fetchBalances();
        }
      });
      
      // Clean up event listeners when component unmounts
      return cleanup;
    }
    
    // If electronAPI isn't available, just return an empty cleanup function
    return () => {};
  }, []);

  return (
    <div className="trade-setup">
      <h2>Trading Bot Setup for Binance Spot Testnet</h2>
      
      {statusMessage && (
        <div className={`status-message ${formData.isActive ? 'active' : ''}`}>
          {statusMessage}
        </div>
      )}
      
      {apiConfig.isConfigured && (
        <div className="balances-card card">
          <h3>Available Balances</h3>
          <div className="balances">
            <div className="balance-item">
              <span>{balances.base.asset}:</span>
              <span>{balances.base.free.toFixed(8)}</span>
            </div>
            <div className="balance-item">
              <span>{balances.quote.asset}:</span>
              <span>{balances.quote.free.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="card">
        <div className="form-group">
          <label htmlFor="symbol">Trading Pair:</label>
          <select 
            id="symbol" 
            name="symbol" 
            value={formData.symbol}
            onChange={handleChange}
            disabled={formData.isActive}
          >
            <option value="BNBUSDT">BNB/USDT</option>
            <option value="BTCUSDT">BTC/USDT</option>
            <option value="ETHUSDT">ETH/USDT</option>
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
          <label htmlFor="amount">Trade Amount ({balances.base.asset}):</label>
          <input 
            type="number" 
            id="amount" 
            name="amount" 
            step="0.001"
            min="0.001"
            max={balances.base.free}
            value={formData.amount}
            onChange={handleChange}
            disabled={formData.isActive}
          />
          {balances.base.free > 0 && (
            <div className="balance-hint">
              <button 
                type="button" 
                className="balance-percent-btn"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  amount: Math.floor(balances.base.free * 0.25 * 1000) / 1000
                }))}
                disabled={formData.isActive}
              >
                25%
              </button>
              <button 
                type="button" 
                className="balance-percent-btn"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  amount: Math.floor(balances.base.free * 0.5 * 1000) / 1000
                }))}
                disabled={formData.isActive}
              >
                50%
              </button>
              <button 
                type="button" 
                className="balance-percent-btn"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  amount: Math.floor(balances.base.free * 0.75 * 1000) / 1000
                }))}
                disabled={formData.isActive}
              >
                75%
              </button>
              <button 
                type="button" 
                className="balance-percent-btn"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  amount: Math.floor(balances.base.free * 0.99 * 1000) / 1000 // 99% to avoid rounding issues
                }))}
                disabled={formData.isActive}
              >
                Max
              </button>
            </div>
          )}
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
          <button 
            type="submit" 
            className="start-bot"
            disabled={!apiConfig.isConfigured}
          >
            Start Trading Bot on Testnet
          </button>
        ) : (
          <button type="button" className="stop-bot" onClick={handleStopBot}>
            Stop Trading Bot
          </button>
        )}
      </form>
      
      {formData.isActive && (
        <div className="bot-status active">
          <h3>Bot is currently active on Binance Spot Testnet</h3>
          <p>Trading {formData.symbol} using {strategies[formData.strategy].name} strategy</p>
          <p>Amount per trade: {formData.amount} {balances.base.asset}</p>
          <p>Checking market every: {formData.interval}</p>
          <p>Take profit: {formData.takeProfit}% / Stop loss: {formData.stopLoss}%</p>
        </div>
      )}

      <div className="testnet-warning card">
        <h3>Testnet Warning</h3>
        <p>You're connected to the Binance Spot Testnet. No real funds will be used.</p>
        <p>To get testnet tokens, visit: <a href="https://testnet.binance.vision/" target="_blank" rel="noopener noreferrer">https://testnet.binance.vision/</a> and use the faucet.</p>
      </div>
    </div>
  );
}

export default TradeSetup;