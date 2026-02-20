// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import TradeSetup from './components/TradeSetup';
import TradingHistory from './components/TradingHistory';
import DiagnosticTest from './components/DiagnosticTest';
import ArbitragePanel from './components/ArbitragePanel';
import SniperPanel from './components/SniperPanel';
import WalletManager from './components/WalletManager';
import ExchangeConfig from './components/ExchangeConfig';
import './styles';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [apiConfig, setApiConfig] = useState({
    apiKey: '',
    apiSecret: '',
    isConfigured: false
  });

  // On mount, check if credentials are already stored in the vault
  useEffect(() => {
    const checkStoredCredentials = async () => {
      if (window.electronAPI?.security?.loadCredentials) {
        const result = await window.electronAPI.security.loadCredentials('binance');
        if (result?.hasCredentials) {
          // Credentials are in vault and adapter is configured — mark as configured
          setApiConfig(prev => ({ ...prev, isConfigured: true }));
        }
      }
    };
    checkStoredCredentials();
  }, []);

  const handleConfigSave = async (config) => {
    // Send keys to main process for vault storage — renderer keeps no plaintext keys
    if (window.electronAPI?.security?.storeCredentials) {
      await window.electronAPI.security.storeCredentials(
        'binance', config.apiKey, config.apiSecret
      );
    }
    // Only store a flag (no keys) in renderer state
    setApiConfig({ apiKey: '***', apiSecret: '***', isConfigured: true });
  };

  const handleLogout = () => {
    setApiConfig({ apiKey: '', apiSecret: '', isConfigured: false });
  };

return (
  <div className="app">
    <header className="app-header">
      <h1>NeutronTrader</h1>
      <nav>
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''} 
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={activeTab === 'setup' ? 'active' : ''} 
          onClick={() => setActiveTab('setup')}
        >
          Setup
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''} 
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
        <button
          className={activeTab === 'diagnostic' ? 'active' : ''}
          onClick={() => setActiveTab('diagnostic')}
        >
          Diagnostic
        </button>
        <button
          className={activeTab === 'arbitrage' ? 'active' : ''}
          onClick={() => setActiveTab('arbitrage')}
        >
          Arbitrage
        </button>
        <button
          className={activeTab === 'sniper' ? 'active' : ''}
          onClick={() => setActiveTab('sniper')}
        >
          Sniper
        </button>
        <button
          className={activeTab === 'wallets' ? 'active' : ''}
          onClick={() => setActiveTab('wallets')}
        >
          Wallets
        </button>
        <button
          className={activeTab === 'exchanges' ? 'active' : ''}
          onClick={() => setActiveTab('exchanges')}
        >
          Exchanges
        </button>
        {apiConfig.isConfigured && (
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        )}
      </nav>
    </header>
    
    <main>
        {!apiConfig.isConfigured && (
          <div className="api-setup card">
            <h2>Connect to Binance Testnet</h2>
            <p className="setup-instruction">
              Enter your Binance Testnet API keys. You can get these from <a href="https://testnet.binance.vision/" target="_blank" rel="noopener noreferrer">testnet.binance.vision</a>.
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleConfigSave({
                apiKey: e.target.apiKey.value,
                apiSecret: e.target.apiSecret.value
              });
            }}>
              <div className="form-group">
                <label htmlFor="apiKey">API Key:</label>
                <input 
                  type="text" 
                  id="apiKey" 
                  name="apiKey" 
                  required 
                  placeholder="Enter your API Key" 
                />
              </div>
              <div className="form-group">
                <label htmlFor="apiSecret">API Secret:</label>
                <input 
                  type="password" 
                  id="apiSecret" 
                  name="apiSecret" 
                  required 
                  placeholder="Enter your API Secret" 
                />
              </div>
              <div className="api-setup-actions">
                <button type="submit" className="primary-btn">Connect to Testnet</button>
              </div>
            </form>
            
            <div className="testnet-tips">
              <h3>Tips for Binance Testnet</h3>
              <ul>
                <li>Make sure your API keys have the "TRADE, USER_DATA, USER_STREAM" permissions</li>
                <li>Request test tokens from the faucet if your account has no balance</li>
                <li>The testnet is periodically reset, so your data may be cleared occasionally</li>
                <li>If you experience connection issues, try generating new API keys</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'diagnostic' && (
        <DiagnosticTest apiConfig={apiConfig} />
        )}

        {apiConfig.isConfigured && activeTab === 'dashboard' && (
          <Dashboard apiConfig={apiConfig} />
        )}
        
        {apiConfig.isConfigured && activeTab === 'setup' && (
          <TradeSetup apiConfig={apiConfig} />
        )}
        
        {apiConfig.isConfigured && activeTab === 'history' && (
          <TradingHistory apiConfig={apiConfig} />
        )}

        {activeTab === 'arbitrage' && (
          <ArbitragePanel />
        )}

        {activeTab === 'sniper' && (
          <SniperPanel />
        )}

        {activeTab === 'wallets' && (
          <WalletManager />
        )}

        {activeTab === 'exchanges' && (
          <ExchangeConfig />
        )}
      </main>
    </div>
  );
}

export default App;