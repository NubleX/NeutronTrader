// NeutronTrader - Exchange configuration panel
// src/components/ExchangeConfig.jsx

import { useState, useEffect } from 'react';
import { listExchanges, configureExchange, pingExchange } from '../services/multiExchangeService';

const SUPPORTED_EXCHANGES = [
  { id: 'binance',  label: 'Binance',   hasPassphrase: false, testnetNote: 'testnet.binance.vision' },
  { id: 'coinbase', label: 'Coinbase',  hasPassphrase: false, testnetNote: 'Sandbox via API flag' },
  { id: 'kraken',   label: 'Kraken',    hasPassphrase: false, testnetNote: 'No testnet — use small amounts' },
  { id: 'okx',      label: 'OKX',       hasPassphrase: true,  testnetNote: 'Demo trading enabled by default' },
  { id: 'bybit',    label: 'Bybit',     hasPassphrase: false, testnetNote: 'testnet.bybit.com' },
];

function ExchangeRow({ exchange, status, onSave, onPing }) {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [testnet, setTestnet] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(exchange.id, { apiKey, apiSecret, passphrase: exchange.hasPassphrase ? passphrase : undefined, testnet });
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

  const configured = status?.configured;
  const connected = status?.connected;

  return (
    <div className="exchange-row card" style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 'bold', width: '80px' }}>{exchange.label}</span>
          <span style={{
            fontSize: '12px', padding: '2px 8px', borderRadius: '4px',
            background: configured ? (connected ? '#1a4a1a' : '#4a1a1a') : '#2a2a2a',
            color: configured ? (connected ? '#4caf50' : '#f44336') : '#888'
          }}>
            {configured ? (connected ? 'CONNECTED' : 'CONFIGURED') : 'NOT SET'}
          </span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" id={`testnet-${exchange.id}`} checked={testnet} onChange={e => setTestnet(e.target.checked)} />
            <label htmlFor={`testnet-${exchange.id}`} style={{ margin: 0, cursor: 'pointer' }}>
              Use Testnet ({exchange.testnetNote})
            </label>
          </div>
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

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '8px' }}>Exchange Configuration</h2>
      <p style={{ color: '#aaa', marginBottom: '24px', fontSize: '14px' }}>
        API keys are encrypted with AES-256-GCM and stored in the OS keychain. The renderer never holds plaintext keys after submission.
      </p>

      {SUPPORTED_EXCHANGES.map(ex => (
        <ExchangeRow
          key={ex.id}
          exchange={ex}
          status={statuses[ex.id]}
          onSave={handleSave}
          onPing={handlePing}
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
