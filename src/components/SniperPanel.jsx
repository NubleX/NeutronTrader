// NeutronTrader - Listing sniper control panel
// src/components/SniperPanel.jsx

import { useState, useEffect, useRef } from 'react';
import {
  startSniper, stopSniper, getSniperHistory,
  updateSniperConfig, startListingDetector, stopListingDetector,
  onSniperAlert, onNewListing
} from '../services/sniperService';

const DEFAULT_CONFIG = {
  exchange: 'binance',
  allocationUSDT: 50,
  stopLossPct: 10,
  sellWindowMs: 900000, // 15 min default
};

function fmt(n, d = 2) { return Number(n).toFixed(d); }

function ListingAlert({ alert }) {
  const age = Math.round((Date.now() - alert.detectedAt) / 1000);
  return (
    <div style={{
      display: 'flex', gap: '12px', alignItems: 'center',
      padding: '8px 12px', background: '#1a2a1a', borderRadius: '6px',
      border: '1px solid #2a4a2a', marginBottom: '8px', fontSize: '13px'
    }}>
      <span style={{ fontWeight: 'bold', color: '#4caf50', width: '100px' }}>{alert.symbol}</span>
      <span style={{ color: '#aaa', width: '80px' }}>{alert.exchange}</span>
      <span style={{ color: '#888', width: '100px' }}>{alert.source}</span>
      <span style={{ color: '#888', fontSize: '11px' }}>{age < 60 ? `${age}s ago` : `${Math.round(age/60)}m ago`}</span>
      {alert.title && (
        <span style={{ color: '#aaa', fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {alert.title}
        </span>
      )}
    </div>
  );
}

function SnipeRow({ entry }) {
  const pnl = entry.pnl;
  const isPending = pnl === undefined || pnl === null;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '100px 80px 80px 80px 80px 1fr',
      gap: '8px', fontSize: '13px', padding: '6px 0',
      borderBottom: '1px solid #2a2a2a', alignItems: 'center'
    }}>
      <span style={{ fontWeight: 'bold' }}>{entry.symbol}</span>
      <span style={{ color: '#aaa' }}>{entry.exchange}</span>
      <span>${fmt(entry.entryPrice || 0)}</span>
      <span style={{ color: isPending ? '#ff9800' : (pnl >= 0 ? '#4caf50' : '#f44336') }}>
        {isPending ? 'OPEN' : `${pnl >= 0 ? '+' : ''}${fmt(pnl)} USDT`}
      </span>
      <span style={{ color: '#888', fontSize: '11px' }}>
        {entry.source || '—'}
      </span>
      <span style={{ color: '#888', fontSize: '11px' }}>
        {entry.executedAt ? new Date(entry.executedAt).toLocaleTimeString() : '—'}
      </span>
    </div>
  );
}

export default function SniperPanel() {
  const [running, setRunning] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [tab, setTab] = useState('alerts');
  const [stats, setStats] = useState({ total: 0, won: 0, totalPnl: 0 });
  const cleanupRef = useRef([]);

  useEffect(() => {
    loadHistory();

    const cleanupAlert = onSniperAlert(entry => {
      setHistory(prev => [entry, ...prev].slice(0, 100));
      setStats(prev => ({
        total: prev.total + 1,
        won: prev.won + (entry.pnl > 0 ? 1 : 0),
        totalPnl: prev.totalPnl + (entry.pnl || 0),
      }));
    });

    const cleanupListing = onNewListing(listing => {
      setAlerts(prev => [{ ...listing, detectedAt: Date.now() }, ...prev].slice(0, 30));
    });

    cleanupRef.current = [cleanupAlert, cleanupListing];

    return () => cleanupRef.current.forEach(fn => typeof fn === 'function' && fn());
  }, []);

  const loadHistory = async () => {
    const h = await getSniperHistory();
    if (Array.isArray(h)) {
      setHistory(h.slice(0, 100));
      const total = h.length;
      const won = h.filter(e => (e.pnl || 0) > 0).length;
      const totalPnl = h.reduce((s, e) => s + (e.pnl || 0), 0);
      setStats({ total, won, totalPnl });
    }
  };

  const handleStartDetector = async () => {
    await startListingDetector({ webhookPort: 7890 });
    setDetecting(true);
  };

  const handleStopDetector = async () => {
    await stopListingDetector();
    setDetecting(false);
  };

  const handleStartSniper = async () => {
    await updateSniperConfig(config);
    const result = await startSniper(config);
    if (result?.success !== false) setRunning(true);
  };

  const handleStopSniper = async () => {
    await stopSniper();
    setRunning(false);
  };

  const winRate = stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(0) : '—';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Listing Sniper</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>Detector:</span>
          <span style={{
            padding: '3px 10px', borderRadius: '4px', fontSize: '12px',
            background: detecting ? '#1a4a1a' : '#2a2a2a',
            color: detecting ? '#4caf50' : '#888'
          }}>
            {detecting ? 'ON' : 'OFF'}
          </span>
          {detecting
            ? <button onClick={handleStopDetector} style={{ fontSize: '12px', padding: '4px 10px', cursor: 'pointer' }}>Stop Detector</button>
            : <button onClick={handleStartDetector} className="primary-btn" style={{ fontSize: '12px', padding: '4px 10px' }}>Start Detector</button>
          }

          <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>Auto-Sniper:</span>
          <span style={{
            padding: '3px 10px', borderRadius: '4px', fontSize: '12px',
            background: running ? '#4a1a1a' : '#2a2a2a',
            color: running ? '#f44336' : '#888'
          }}>
            {running ? 'ARMED' : 'OFF'}
          </span>
          {running
            ? <button onClick={handleStopSniper} style={{ background: '#f44336', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Disarm</button>
            : <button onClick={handleStartSniper} style={{ background: '#ff9800', color: '#000', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Arm Sniper</button>
          }
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Snipes', value: stats.total },
          { label: 'Win Rate', value: stats.total ? `${winRate}%` : '—' },
          { label: 'Total P&L', value: `${stats.totalPnl >= 0 ? '+' : ''}${fmt(stats.totalPnl)} USDT`, color: stats.totalPnl >= 0 ? '#4caf50' : '#f44336' },
          { label: 'Listings Detected', value: alerts.length },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: color || '#fff' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '16px' }}>
        {['alerts', 'history', 'config'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer',
            background: tab === t ? '#1a3a5a' : '#1a1a1a',
            color: tab === t ? '#2196f3' : '#888',
            borderBottom: tab === t ? '2px solid #2196f3' : '2px solid transparent'
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'alerts' && alerts.length > 0 && (
              <span style={{ marginLeft: '6px', background: '#4caf50', color: '#000', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }}>
                {alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'alerts' && (
        <div className="card">
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
            Live listing alerts from exchange APIs, announcement scrapers, and webhooks (localhost:7890)
          </div>
          {alerts.length === 0 ? (
            <div style={{ color: '#555', padding: '20px 0', textAlign: 'center' }}>
              {detecting ? 'Watching for new listings...' : 'Start the detector to watch for listings'}
            </div>
          ) : (
            <div>
              {alerts.map((a, i) => <ListingAlert key={i} alert={a} />)}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          <div style={{
            display: 'grid', gridTemplateColumns: '100px 80px 80px 80px 80px 1fr',
            gap: '8px', fontSize: '11px', color: '#888', padding: '4px 0',
            borderBottom: '1px solid #333', marginBottom: '4px'
          }}>
            <span>SYMBOL</span><span>EXCHANGE</span><span>ENTRY</span><span>P&L</span><span>SOURCE</span><span>TIME</span>
          </div>
          {history.length === 0 ? (
            <div style={{ color: '#555', padding: '20px 0', textAlign: 'center' }}>No snipes executed yet</div>
          ) : (
            history.map((e, i) => <SnipeRow key={i} entry={e} />)
          )}
        </div>
      )}

      {tab === 'config' && (
        <div className="card" style={{ maxWidth: '400px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '16px' }}>Sniper Configuration</h3>
          <div className="form-group">
            <label>Target Exchange</label>
            <select value={config.exchange} onChange={e => setConfig(p => ({ ...p, exchange: e.target.value }))}
              style={{ width: '100%', padding: '8px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}>
              {['binance', 'coinbase', 'kraken', 'okx', 'bybit'].map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Allocation per snipe (USDT)</label>
            <input type="number" value={config.allocationUSDT}
              onChange={e => setConfig(p => ({ ...p, allocationUSDT: parseFloat(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label>Stop Loss (%)</label>
            <input type="number" value={config.stopLossPct}
              onChange={e => setConfig(p => ({ ...p, stopLossPct: parseFloat(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label>Auto-sell window (minutes)</label>
            <input type="number" value={Math.round(config.sellWindowMs / 60000)}
              onChange={e => setConfig(p => ({ ...p, sellWindowMs: parseInt(e.target.value) * 60000 }))} />
          </div>
          <button className="primary-btn" onClick={() => updateSniperConfig(config)} style={{ marginTop: '8px' }}>
            Save Config
          </button>
        </div>
      )}
    </div>
  );
}
