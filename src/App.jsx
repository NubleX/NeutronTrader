import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import TradeSetup from './components/TradeSetup';
import TradingHistory from './components/TradingHistory';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [apiConfig, setApiConfig] = useState({
    apiKey: '',
    apiSecret: '',
    isConfigured: false
  });

  const handleConfigSave = (config) => {
    setApiConfig({
      ...config,
      isConfigured: true
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Binance Trading Bot</h1>
        <nav>
          <button onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button onClick={() => setActiveTab('setup')}>Setup</button>
          <button onClick={() => setActiveTab('history')}>History</button>
        </nav>
      </header>
      
      <main>
        {!apiConfig.isConfigured && (
          <div className="api-setup">
            <h2>Set up your Binance API keys</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleConfigSave({
                apiKey: e.target.apiKey.value,
                apiSecret: e.target.apiSecret.value
              });
            }}>
              <div>
                <label htmlFor="apiKey">API Key:</label>
                <input type="text" id="apiKey" name="apiKey" />
              </div>
              <div>
                <label htmlFor="apiSecret">API Secret:</label>
                <input type="password" id="apiSecret" name="apiSecret" />
              </div>
              <button type="submit">Save API Keys</button>
            </form>
          </div>
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
      </main>
    </div>
  );
}

export default App;
