// NeutronTrader - Exchange configuration panel

import { useState, useEffect } from 'react';
import { listExchanges, configureExchange, pingExchange, setExchangeMode } from '../services/multiExchangeService';

const SUPPORTED_EXCHANGES = [
  { id: 'binance',  label: 'Binance',   hasPassphrase: false, supportsModeToggle: true, testnetNote: 'testnet.binance.vision' },
  { id: 'coinbase', label: 'Coinbase',  hasPassphrase: false, supportsModeToggle: false, testnetNote: 'Sandbox via API flag' },
  { id: 'kraken',   label: 'Kraken',    hasPassphrase: false, supportsModeToggle: false, testnetNote: 'No testnet — use small amounts' },
  { id: 'okx',      label: 'OKX',       hasPassphrase: true,  supportsModeToggle: false, testnetNote: 'Demo trading enabled by default' },
  { id: 'bybit',    label: 'Bybit',     hasPassphrase: false, supportsModeToggle: false, testnetNote: 'testnet.bybit.com' },
];

function ExchangeRow({ exchange, status, onSave, onPing, onModeChange }) {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [testnet, setTestnet] = useState(status?.isTestnet ?? false);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [modeSaving, setModeSaving] = useState(false);

  useEffect(() => {
    setTestnet(status?.isTestnet ?? false);
  }, [status?.isTestnet]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(exchange.id, {
      apiKey,
      apiSecret,
      passphrase: exchange.hasPassphrase ? passphrase : undefined,
      testnet,
      isTestnet: testnet,
    });
    setSaving(false);
    setExpanded(false);
    setApiKey('');
    setApiSecret('');
    setPassphrase('');
  };

  const handlePing = async () => {
    setPinging(true);
    await onPing(exchange.id);
    setPinging(false);
  };

  const handleModeToggle = async () => {
    if (!exchange.supportsModeToggle) return;
    setModeSaving(true);
    const nextMode = (status?.mode === 'testnet' || status?.isTestnet) ? 'mainnet' : 'testnet';
    await onModeChange(exchange.id, nextMode);
    setModeSaving(false);
  };

  const configured = status?.configured;
  const connected = status?.connected;
  const isMainnet = status?.mode === 'mainnet' || status?.isTestnet === false;

  return (
    <div className="exchange-row card" style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', width: '80px' }}>{exchange.label}</span>
          <span style={{
            fontSize: '12px', padding: '2px 8px', borderRadius: '4px',
            background: configured ? (connected ? '#1a4a1a' : '#4a1a1a') : '#2a2a2a',
            color: configured ? (connected ? '#4caf50' : '#f44336') : '#888'
          }}>
            {configured ? (connected ? 'CONNECTED' : 'CONFIGURED') : 'NOT SET'}
          </span>
          {exchange.supportsModeToggle && (
            <button
              onClick={handleModeToggle}
              disabled={modeSaving}
              style={{
                fontSize: '12px', padding: '2px 10px', cursor: 'pointer',
                background: isMainnet ? '#1a3a1a' : '#3a2a1a',
                color: isMainnet ? '#4caf50' : '#ff9800',
                border: '1px solid #333', borderRadius: '4px',
              }}
              title="Switch between live mainnet and testnet API"
            >
              {modeSaving ? '...' : isMainnet ? 'MAINNET' : 'TESTNET'}
            </button>
          )}
          {configured && (
            <button
              onClick={handlePing}
              disabled={pinging}
              style={{ fontSize: '12px', padding: '2px 8px', cursor: 'pointer' }}
            >
              {pinging ? 'Pinging...' : 'Ping'}
            </button>
          )}
        </div>
        <button onClick={() => setExpanded(v => !v)} style={{ cursor: 'pointer' }}>
          {expanded ? 'Cancel' : configured ? 'Update Keys' : 'Configure'}
        </button>
      </div>

      {expanded && (
        <form onSubmit={handleSave} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="form-group">
            <label>API Key</label>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} required placeholder="Paste API key" />
          </div>
          <div className="form-group">
            <label>API Secret</label>
            <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} required placeholder="Paste API secret" />
          </div>
          {exchange.hasPassphrase && (
            <div className="form-group">
              <label>Passphrase</label>
              <input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} required placeholder="API passphrase" />
            </div>
          )}
          {exchange.supportsModeToggle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id={`testnet-${exchange.id}`} checked={testnet} onChange={e => setTestnet(e.target.checked)} />
              <label htmlFor={`testnet-${exchange.id}`} style={{ margin: 0, cursor: 'pointer' }}>
                Use Testnet ({exchange.testnetNote})
              </label>
            </div>
          )}
          <button type="submit" className="primary-btn" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? 'Saving...' : 'Save & Connect'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ExchangeConfig() {
  const [statuses, setStatuses] = useState({});
  const [pingResults, setPingResults] = useState({});

  const refreshStatuses = async () => {
    const result = await listExchanges();
    if (result?.exchanges) {
      const map = {};
      for (const ex of result.exchanges) map[ex.exchange] = ex;
      setStatuses(map);
    }
  };

  useEffect(() => {
    refreshStatuses();
  }, []);

  const handleSave = async (exchangeId, config) => {
    await configureExchange(exchangeId, config);
    await refreshStatuses();
  };

  const handlePing = async (exchangeId) => {
    const result = await pingExchange(exchangeId);
    setPingResults(prev => ({ ...prev, [exchangeId]: result }));
    await refreshStatuses();
  };

  const handleModeChange = async (exchangeId, mode) => {
    await setExchangeMode(exchangeId, mode);
    await refreshStatuses();
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '8px' }}>Exchange Configuration</h2>
      <p style={{ color: '#aaa', marginBottom: '24px', fontSize: '14px' }}>
        API keys are encrypted with AES-256-GCM and stored in the OS keychain. Binance supports a MAINNET/TESTNET toggle for market data and trading.
      </p>

      {SUPPORTED_EXCHANGES.map(ex => (
        <ExchangeRow
          key={ex.id}
          exchange={ex}
          status={statuses[ex.id]}
          onSave={handleSave}
          onPing={handlePing}
          onModeChange={handleModeChange}
        />
      ))}

      {Object.keys(pingResults).length > 0 && (
        <div className="card" style={{ marginTop: '16px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Ping Results</h3>
          {Object.entries(pingResults).map(([ex, res]) => (
            <div key={ex} style={{ fontSize: '13px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 'bold' }}>{ex}</span>:{' '}
              <span style={{ color: res?.success ? '#4caf50' : '#f44336' }}>
                {res?.success ? `OK (${res.latencyMs}ms)` : res?.error || 'Failed'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
