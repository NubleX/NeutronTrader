// NeutronTrader - Arbitrage monitoring and control panel
// src/components/ArbitragePanel.jsx

import { useState, useEffect, useRef } from 'react';
import {
  startArbitrage, stopArbitrage, getArbitrageHistory,
  startPriceFeed, stopPriceFeed, getPriceFeedSnapshot,
  onArbitrageExecuted, getRiskStatus, resetCircuitBreaker, updateRiskConfig
} from '../services/arbitrageService';
import { onArbitrageOpportunity } from '../services/multiExchangeService';

const DEFAULT_CONFIG = {
  minProfitPct: 0.5,
  maxPositionUSDT: 100,
  symbols: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'],
  exchanges: ['binance', 'coinbase', 'kraken'],
};

const DEFAULT_RISK = {
  minProfitPct: 0.5,
  maxPositionUSDT: 100,
  dailyLossLimitUSDT: 50,
  maxOpenPositions: 3,
};

function fmt(n, decimals = 4) {
  return Number(n).toFixed(decimals);
}

function OpportunityRow({ opp }) {
  const profit = ((opp.netProfit || 0) * 100).toFixed(3);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '140px 90px 90px 90px 90px 1fr',
      gap: '8px', fontSize: '13px', padding: '6px 0',
      borderBottom: '1px solid #2a2a2a', alignItems: 'center'
    }}>
      <span style={{ fontWeight: 'bold' }}>{opp.symbol}</span>
      <span style={{ color: '#2196f3' }}>{opp.buyExchange}</span>
      <span style={{ color: '#ff9800' }}>{opp.sellExchange}</span>
      <span>${fmt(opp.buyPrice, 2)}</span>
      <span>${fmt(opp.sellPrice, 2)}</span>
      <span style={{ color: opp.netProfit > 0 ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
        {profit}%
      </span>
    </div>
  );
}

function HistoryRow({ entry }) {
  const pnl = entry.pnl || 0;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '140px 120px 90px 90px 1fr',
      gap: '8px', fontSize: '13px', padding: '6px 0',
      borderBottom: '1px solid #2a2a2a', alignItems: 'center'
    }}>
      <span style={{ fontWeight: 'bold' }}>{entry.symbol}</span>
      <span style={{ color: '#aaa', fontSize: '11px' }}>
        {entry.buyExchange} → {entry.sellExchange}
      </span>
      <span style={{ color: pnl >= 0 ? '#4caf50' : '#f44336' }}>
        {pnl >= 0 ? '+' : ''}{fmt(pnl, 2)} USDT
      </span>
      <span style={{ color: entry.success ? '#4caf50' : '#f44336' }}>
        {entry.success ? 'OK' : 'FAILED'}
      </span>
      <span style={{ color: '#888', fontSize: '11px' }}>
        {entry.executedAt ? new Date(entry.executedAt).toLocaleTimeString() : '—'}
      </span>
    </div>
  );
}

export default function ArbitragePanel() {
  const [running, setRunning] = useState(false);
  const [opportunities, setOpportunities] = useState([]);
  const [history, setHistory] = useState([]);
  const [snapshot, setSnapshot] = useState({});
  const [riskStatus, setRiskStatus] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [riskConfig, setRiskConfig] = useState(DEFAULT_RISK);
  const [pnlTotal, setPnlTotal] = useState(0);
  const [tab, setTab] = useState('live');
  const cleanupRef = useRef([]);
  const snapshotTimer = useRef(null);

  useEffect(() => {
    loadHistory();
    loadRiskStatus();

    const cleanupOpp = onArbitrageOpportunity(opp => {
      setOpportunities(prev => [opp, ...prev].slice(0, 50));
    });

    const cleanupExec = onArbitrageExecuted(entry => {
      setHistory(prev => [entry, ...prev].slice(0, 100));
      setPnlTotal(prev => prev + (entry.pnl || 0));
      loadRiskStatus();
    });

    cleanupRef.current = [cleanupOpp, cleanupExec];

    return () => {
      cleanupRef.current.forEach(fn => typeof fn === 'function' && fn());
      if (snapshotTimer.current) clearInterval(snapshotTimer.current);
    };
  }, []);

  const loadHistory = async () => {
    const h = await getArbitrageHistory();
    if (Array.isArray(h)) {
      setHistory(h.slice(0, 100));
      const total = h.reduce((s, e) => s + (e.pnl || 0), 0);
      setPnlTotal(total);
    }
  };

  const loadRiskStatus = async () => {
    const rs = await getRiskStatus();
    setRiskStatus(rs);
  };

  const startSnapshotPolling = () => {
    snapshotTimer.current = setInterval(async () => {
      const s = await getPriceFeedSnapshot();
      if (s) setSnapshot(s);
    }, 5000);
  };

  const handleStart = async () => {
    await startPriceFeed(config.symbols, { exchanges: config.exchanges });
    const result = await startArbitrage({
      minProfitPct: config.minProfitPct,
      maxPositionUSDT: config.maxPositionUSDT,
    });
    if (result?.success !== false) {
      setRunning(true);
      startSnapshotPolling();
    }
  };

  const handleStop = async () => {
    await stopArbitrage();
    await stopPriceFeed();
    setRunning(false);
    if (snapshotTimer.current) clearInterval(snapshotTimer.current);
  };

  const handleResetCircuitBreaker = async () => {
    await resetCircuitBreaker();
    await loadRiskStatus();
  };

  const handleRiskSave = async () => {
    await updateRiskConfig(riskConfig);
    await loadRiskStatus();
  };

  const circuitOpen = riskStatus?.circuitBreakerTripped;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Arbitrage Engine</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {circuitOpen && (
            <span style={{ color: '#f44336', fontSize: '13px', fontWeight: 'bold' }}>
              CIRCUIT BREAKER OPEN
            </span>
          )}
          <span style={{
            padding: '4px 12px', borderRadius: '4px', fontSize: '13px',
            background: running ? '#1a4a1a' : '#2a2a2a',
            color: running ? '#4caf50' : '#888'
          }}>
            {running ? 'RUNNING' : 'STOPPED'}
          </span>
          {circuitOpen ? (
            <button onClick={handleResetCircuitBreaker} style={{ background: '#f44336', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              Reset Circuit Breaker
            </button>
          ) : running ? (
            <button onClick={handleStop} style={{ background: '#f44336', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              Stop
            </button>
          ) : (
            <button onClick={handleStart} className="primary-btn">
              Start
            </button>
          )}
        </div>
      </div>

      {/* P&L summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total P&L', value: `${pnlTotal >= 0 ? '+' : ''}${fmt(pnlTotal, 2)} USDT`, color: pnlTotal >= 0 ? '#4caf50' : '#f44336' },
          { label: 'Trades', value: history.length },
          { label: 'Open Positions', value: riskStatus?.openPositions || 0 },
          { label: 'Daily Loss', value: `${fmt(riskStatus?.dailyLoss || 0, 2)} USDT`, color: '#ff9800' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: color || '#fff' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '16px' }}>
        {['live', 'history', 'config'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer',
            background: tab === t ? '#1a3a5a' : '#1a1a1a',
            color: tab === t ? '#2196f3' : '#888',
            borderBottom: tab === t ? '2px solid #2196f3' : '2px solid transparent'
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'live' && (
        <div className="card">
          <div style={{
            display: 'grid', gridTemplateColumns: '140px 90px 90px 90px 90px 1fr',
            gap: '8px', fontSize: '11px', color: '#888', padding: '4px 0',
            borderBottom: '1px solid #333', marginBottom: '4px'
          }}>
            <span>SYMBOL</span><span>BUY ON</span><span>SELL ON</span><span>BUY PRICE</span><span>SELL PRICE</span><span>NET PROFIT</span>
          </div>
          {opportunities.length === 0 ? (
            <div style={{ color: '#555', padding: '20px 0', textAlign: 'center' }}>
              {running ? 'Waiting for arbitrage opportunities...' : 'Start the engine to detect opportunities'}
            </div>
          ) : (
            opportunities.map((opp, i) => <OpportunityRow key={i} opp={opp} />)
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          <div style={{
            display: 'grid', gridTemplateColumns: '140px 120px 90px 90px 1fr',
            gap: '8px', fontSize: '11px', color: '#888', padding: '4px 0',
            borderBottom: '1px solid #333', marginBottom: '4px'
          }}>
            <span>SYMBOL</span><span>ROUTE</span><span>P&L</span><span>STATUS</span><span>TIME</span>
          </div>
          {history.length === 0 ? (
            <div style={{ color: '#555', padding: '20px 0', textAlign: 'center' }}>No executed trades yet</div>
          ) : (
            history.map((entry, i) => <HistoryRow key={i} entry={entry} />)
          )}
        </div>
      )}

      {tab === 'config' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="card">
            <h3 style={{ fontSize: '14px', marginBottom: '16px' }}>Engine Config</h3>
            <div className="form-group">
              <label>Min Profit % (after fees)</label>
              <input type="number" step="0.1" value={config.minProfitPct}
                onChange={e => setConfig(p => ({ ...p, minProfitPct: parseFloat(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label>Max Position Size (USDT)</label>
              <input type="number" value={config.maxPositionUSDT}
                onChange={e => setConfig(p => ({ ...p, maxPositionUSDT: parseFloat(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label>Symbols (comma-separated)</label>
              <input type="text" value={config.symbols.join(', ')}
                onChange={e => setConfig(p => ({ ...p, symbols: e.target.value.split(',').map(s => s.trim()) }))} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '14px', marginBottom: '16px' }}>Risk Limits</h3>
            <div className="form-group">
              <label>Daily Loss Limit (USDT)</label>
              <input type="number" value={riskConfig.dailyLossLimitUSDT}
                onChange={e => setRiskConfig(p => ({ ...p, dailyLossLimitUSDT: parseFloat(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label>Max Open Positions</label>
              <input type="number" value={riskConfig.maxOpenPositions}
                onChange={e => setRiskConfig(p => ({ ...p, maxOpenPositions: parseInt(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label>Max Position Size (USDT)</label>
              <input type="number" value={riskConfig.maxPositionUSDT}
                onChange={e => setRiskConfig(p => ({ ...p, maxPositionUSDT: parseFloat(e.target.value) }))} />
            </div>
            <button className="primary-btn" onClick={handleRiskSave} style={{ marginTop: '8px' }}>
              Save Risk Limits
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
