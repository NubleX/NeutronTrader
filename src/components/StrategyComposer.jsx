// NeutronTrader - Strategy composer UI

import { useState, useEffect, useMemo } from 'react';
import {
  saveStrategyConfig, listStrategyConfigs, deleteStrategyConfig,
  STRATEGY_OPTIONS, STRATEGY_HELP, validateStrategyConfig,
} from '../services/strategyService';
import {
  getNotificationPrefs, updateNotificationPrefs, testNotification
} from '../services/notificationService';
import HelpIcon from './HelpIcon';

const EMPTY_RULE = { strategy: 'relativeStrengthIndex', params: { period: 14, overbought: 70, oversold: 30 }, weight: 1 };

const STRATEGY_HELP_MAP = {
  relativeStrengthIndex: STRATEGY_HELP.rsi,
  simpleMovingAverage: STRATEGY_HELP.sma,
  bollingerBands: STRATEGY_HELP.bollingerBands,
  macd: STRATEGY_HELP.macd,
};

export default function StrategyComposer() {
  const [configs, setConfigs] = useState([]);
  const [name, setName] = useState('');
  const [rules, setRules] = useState([{ ...EMPTY_RULE }]);
  const [combineMode, setCombineMode] = useState('AND');
  const [riskOverrides, setRiskOverrides] = useState({ maxPositionUSDT: 200, stopLossPct: 2 });
  const [message, setMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [notifPrefs, setNotifPrefs] = useState({
    arbOpportunities: true, arbExecutions: true, listingAlerts: true, botSignals: true, minArbProfitPct: 0.3,
  });

  const draftConfig = useMemo(() => ({
    name: name.trim(),
    rules,
    combineMode,
    riskOverrides,
  }), [name, rules, combineMode, riskOverrides]);

  const load = async () => {
    const [c, n] = await Promise.all([listStrategyConfigs(), getNotificationPrefs()]);
    setConfigs(c);
    if (n) setNotifPrefs(n);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const runValidation = async () => {
      const result = await validateStrategyConfig(draftConfig);
      setValidationErrors(result.errors || []);
    };
    runValidation();
  }, [draftConfig]);

  const canSave = name.trim() && validationErrors.length === 0;

  const handleSave = async () => {
    if (!canSave) {
      setMessage('Fix validation errors before saving');
      return;
    }
    const res = await saveStrategyConfig(draftConfig);
    if (res?.success !== false) {
      setMessage(`Saved "${name}"`);
      load();
    } else {
      setMessage(res.error || 'Save failed');
    }
  };

  const handleDelete = async (configName) => {
    await deleteStrategyConfig(configName);
    load();
  };

  const loadConfig = (config) => {
    setName(config.name);
    setRules(config.rules);
    setCombineMode(config.combineMode || 'AND');
    setRiskOverrides(config.riskOverrides || { maxPositionUSDT: 200, stopLossPct: 2 });
  };

  const updateRule = (idx, field, value) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const updateRuleParam = (idx, key, value) => {
    setRules(prev => prev.map((r, i) => i === idx
      ? { ...r, params: { ...r.params, [key]: value } }
      : r));
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '8px' }}>Strategy Composer</h2>
      <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>
        Combine indicators with guardrails. Invalid configs cannot be saved for live trading.
      </p>

      {validationErrors.length > 0 && (
        <div className="card" style={{ padding: '12px', marginBottom: '16px', border: '1px solid #4a1a1a' }}>
          <div style={{ color: '#f44336', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>
            Validation errors — fix before saving:
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#ff8a80', fontSize: '12px' }}>
            {validationErrors.map((err, i) => <li key={i} style={{ marginBottom: '4px' }}>{err}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Build Strategy</h3>
          <div className="form-group">
            <label>Config Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="My RSI+MACD" />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center' }}>
              Combine Mode
              <HelpIcon text={STRATEGY_HELP.combineMode} />
            </label>
            <select value={combineMode} onChange={e => setCombineMode(e.target.value)}
              style={{ width: '100%', padding: '8px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}>
              <option value="AND">AND — all must agree</option>
              <option value="OR">OR — any triggers</option>
              <option value="MAJORITY">MAJORITY — weighted vote</option>
            </select>
          </div>

          {rules.map((rule, idx) => {
            const def = STRATEGY_OPTIONS.find(s => s.id === rule.strategy);
            return (
              <div key={idx} style={{ border: '1px solid #333', borderRadius: '6px', padding: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center' }}>
                    Strategy {idx + 1}
                    <HelpIcon text={STRATEGY_HELP_MAP[rule.strategy] || 'Technical indicator rule'} />
                  </label>
                  <select value={rule.strategy} onChange={e => updateRule(idx, 'strategy', e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}>
                    {STRATEGY_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                {def?.params?.map(p => (
                  <div className="form-group" key={p.key}>
                    <label>{p.label}</label>
                    <input type="number" value={rule.params?.[p.key] ?? p.default}
                      onChange={e => updateRuleParam(idx, p.key, parseFloat(e.target.value))} />
                  </div>
                ))}
                {combineMode === 'MAJORITY' && (
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center' }}>
                      Weight
                      <HelpIcon text={STRATEGY_HELP.weight} />
                    </label>
                    <input type="number" value={rule.weight || 1}
                      onChange={e => updateRule(idx, 'weight', parseFloat(e.target.value))} />
                  </div>
                )}
                {rules.length > 1 && (
                  <button onClick={() => setRules(prev => prev.filter((_, i) => i !== idx))}
                    style={{ fontSize: '12px', color: '#f44336', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}

          <button onClick={() => setRules(prev => [...prev, { ...EMPTY_RULE, strategy: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } }])}
            style={{ fontSize: '12px', marginBottom: '12px', cursor: 'pointer' }}>
            + Add Strategy
          </button>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center' }}>
              Max Position (USDT)
              <HelpIcon text={STRATEGY_HELP.maxPosition} />
            </label>
            <input type="number" value={riskOverrides.maxPositionUSDT}
              onChange={e => setRiskOverrides(p => ({ ...p, maxPositionUSDT: parseFloat(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center' }}>
              Stop Loss (%)
              <HelpIcon text={STRATEGY_HELP.stopLoss} />
            </label>
            <input type="number" step="0.1" value={riskOverrides.stopLossPct ?? ''}
              onChange={e => setRiskOverrides(p => ({ ...p, stopLossPct: parseFloat(e.target.value) }))} />
          </div>

          <button className="primary-btn" onClick={handleSave} disabled={!canSave} style={{ opacity: canSave ? 1 : 0.5 }}>
            Save Config
          </button>
          {message && <div style={{ marginTop: '8px', fontSize: '13px', color: validationErrors.length ? '#f44336' : '#4caf50' }}>{message}</div>}
        </div>

        <div>
          <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Saved Configs</h3>
            {configs.length === 0 ? (
              <div style={{ color: '#555' }}>No saved configs yet</div>
            ) : (
              configs.map(c => (
                <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #2a2a2a' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{c.combineMode} — {c.rules.length} rules</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => loadConfig(c)} style={{ fontSize: '12px', cursor: 'pointer' }}>Load</button>
                    <button onClick={() => handleDelete(c.name)} style={{ fontSize: '12px', color: '#f44336', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Notifications</h3>
            {[
              ['arbOpportunities', 'Arb Opportunities'],
              ['arbExecutions', 'Arb Executions'],
              ['listingAlerts', 'Listing Alerts'],
              ['botSignals', 'Bot Signals'],
            ].map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px' }}>
                <input type="checkbox" checked={notifPrefs[key]}
                  onChange={e => setNotifPrefs(p => ({ ...p, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
            <div className="form-group">
              <label>Min Arb Profit %</label>
              <input type="number" step="0.1" value={notifPrefs.minArbProfitPct}
                onChange={e => setNotifPrefs(p => ({ ...p, minArbProfitPct: parseFloat(e.target.value) }))} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button className="primary-btn" onClick={async () => {
                await updateNotificationPrefs(notifPrefs);
                setMessage('Notification prefs saved');
              }}>Save Prefs</button>
              <button onClick={testNotification} style={{ cursor: 'pointer' }}>Test</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
