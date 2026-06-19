// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import { usePriceFeed } from './hooks/usePriceFeed';
import TradeSetup from './components/TradeSetup';
import TradingHistory from './components/TradingHistory';
import DiagnosticTest from './components/DiagnosticTest';
import ArbitragePanel from './components/ArbitragePanel';
import SniperPanel from './components/SniperPanel';
import WalletManager from './components/WalletManager';
import ExchangeConfig from './components/ExchangeConfig';
import PortfolioPanel from './components/PortfolioPanel';
import BacktestPanel from './components/BacktestPanel';
import StrategyComposer from './components/StrategyComposer';
import './styles';

const TABS = [
  { id: 'dashboard',  label: 'Dashboard' },
  { id: 'portfolio',  label: 'Portfolio' },
  { id: 'setup',      label: 'Setup' },
  { id: 'composer',   label: 'Composer' },
  { id: 'backtest',   label: 'Backtest' },
  { id: 'history',    label: 'History' },
  { id: 'arbitrage',  label: 'Arbitrage' },
  { id: 'sniper',     label: 'Sniper' },
  { id: 'wallets',    label: 'Wallets' },
  { id: 'exchanges',  label: 'Exchanges' },
  { id: 'diagnostic', label: 'Diagnostic' },
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const priceFeed = usePriceFeed();

  return (
    <div className="app">
      <header className="app-header">
        <h1>NeutronTrader</h1>
        <nav>
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {activeTab === 'dashboard'  && (
          <Dashboard
            snapshot={priceFeed.snapshot}
            arbThreshold={priceFeed.arbThreshold}
            onArbThresholdChange={priceFeed.setArbThreshold}
            status={priceFeed.status}
            feedMode={priceFeed.feedMode}
            latencyMs={priceFeed.latencyMs}
            paused={priceFeed.paused}
            stale={priceFeed.stale}
            lastUpdated={priceFeed.lastUpdated}
            onTogglePause={priceFeed.togglePause}
            onToggleFeedMode={priceFeed.toggleFeedMode}
          />
        )}
        {activeTab === 'portfolio'  && <PortfolioPanel />}
        {activeTab === 'setup'      && <TradeSetup apiConfig={{}} />}
        {activeTab === 'composer'   && <StrategyComposer />}
        {activeTab === 'backtest'  && <BacktestPanel />}
        {activeTab === 'history'    && <TradingHistory apiConfig={{}} />}
        {activeTab === 'arbitrage'  && <ArbitragePanel />}
        {activeTab === 'sniper'     && <SniperPanel />}
        {activeTab === 'wallets'    && <WalletManager />}
        {activeTab === 'exchanges'  && <ExchangeConfig />}
        {activeTab === 'diagnostic' && <DiagnosticTest apiConfig={{}} />}
      </main>
    </div>
  );
}

export default App;