// NeutronTrader - Backtesting panel

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { runBacktest, onBacktestProgress } from '../services/backtestService';
import { listStrategyConfigs, STRATEGY_OPTIONS } from '../services/strategyService';

function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toFixed(d);
}

const DEFAULT_CONFIG = {
  exchange: 'binance',
  symbol: 'BTC/USDT',
  interval: '1h',
  strategy: 'macd',
  initialCapital: 10000,
  feeRate: 0.001,
  strategyParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
};

export default function BacktestPanel() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listStrategyConfigs().then(setSavedConfigs);
    const cleanup = onBacktestProgress(p => setProgress(p.percent || 0));
    return cleanup;
  }, []);

  const handleRun = async () => {
    setRunning(true);
    setError('');
    setResult(null);
    setProgress(0);
    try {
      const payload = { ...config };
      if (config.strategy === 'composed' && config.composedConfig) {
        payload.composedConfig = config.composedConfig;
      }
      const res = await runBacktest(payload);
      if (res.success) setResult(res.data);
      else setError(res.error || 'Backtest failed');
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const strategyDef = STRATEGY_OPTIONS.find(s => s.id === config.strategy);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px' }}>Backtesting</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Configuration</h3>
          <div className="form-group">
            <label>Exchange</label>
            <select value={config.exchange} onChange={e => setConfig(p => ({ ...p, exchange: e.target.value }))}
              style={{ width: '100%', padding: '8px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}>
              {['binance', 'bybit', 'okx', 'kraken', 'coinbase'].map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Symbol</label>
            <input value={config.symbol} onChange={e => setConfig(p => ({ ...p, symbol: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Interval</label>
            <select value={config.interval} onChange={e => setConfig(p => ({ ...p, interval: e.target.value }))}
              style={{ width: '100%', padding: '8px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}>
              {['1m', '5m', '15m', '30m', '1h', '4h', '1d'].map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Strategy</label>
            <select value={config.strategy} onChange={e => setConfig(p => ({ ...p, strategy: e.target.value }))}
              style={{ width: '100%', padding: '8px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}>
              {STRATEGY_OPTIONS.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
              <option value="composed">Composed Strategy</option>
            </select>
          </div>
          {config.strategy === 'composed' && (
            <div className="form-group">
              <label>Saved Composer Config</label>
              <select onChange={e => {
                const c = savedConfigs.find(x => x.name === e.target.value);
                if (c) setConfig(p => ({ ...p, composedConfig: c, strategy: 'composed' }));
              }}
                style={{ width: '100%', padding: '8px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}>
                <option value="">Select...</option>
                {savedConfigs.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          )}
          {strategyDef?.params?.map(param => (
            <div className="form-group" key={param.key}>
              <label>{param.label}</label>
              <input type="number" value={config.strategyParams?.[param.key] ?? param.default}
                onChange={e => setConfig(p => ({
                  ...p,
                  strategyParams: { ...p.strategyParams, [param.key]: parseFloat(e.target.value) },
                }))} />
            </div>
          ))}
          <div className="form-group">
            <label>Initial Capital (USDT)</label>
            <input type="number" value={config.initialCapital}
              onChange={e => setConfig(p => ({ ...p, initialCapital: parseFloat(e.target.value) }))} />
          </div>
          <button className="primary-btn" onClick={handleRun} disabled={running} style={{ marginTop: '8px' }}>
            {running ? `Running... ${progress}%` : 'Run Backtest'}
          </button>
          {error && <div style={{ color: '#f44336', marginTop: '8px', fontSize: '13px' }}>{error}</div>}
        </div>

        {result && (
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Results</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
              {[
                ['Total Return', `${fmt(result.metrics.totalReturn)}%`],
                ['Max Drawdown', `${fmt(result.metrics.maxDrawdown)}%`],
                ['Sharpe Ratio', fmt(result.metrics.sharpeRatio)],
                ['Win Rate', `${fmt(result.metrics.winRate)}%`],
                ['Profit Factor', fmt(result.metrics.profitFactor)],
                ['Trades', result.metrics.totalTrades],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ color: '#888', fontSize: '11px' }}>{label}</div>
                  <div style={{ fontWeight: 'bold' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {result?.equity?.length > 0 && (
        <div className="card" style={{ padding: '16px', height: '280px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Equity Curve</h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={result.equity}>
              <XAxis dataKey="timestamp" hide />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `$${fmt(v)}`} />
              <Line type="monotone" dataKey="value" stroke="#4caf50" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {result?.trades?.length > 0 && (
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Trades ({result.trades.length})</h3>
          <div style={{ maxHeight: '200px', overflow: 'auto' }}>
            {result.trades.map((t, i) => (
              <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #2a2a2a' }}>
                <span style={{ color: t.side === 'BUY' ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>{t.side}</span>
                {' '}@ ${fmt(t.price)} — {t.reason}
                {t.pnl != null && <span style={{ color: t.pnl >= 0 ? '#4caf50' : '#f44336' }}> ({fmt(t.pnl)} USDT)</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
