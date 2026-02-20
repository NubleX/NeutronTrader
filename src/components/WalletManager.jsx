// NeutronTrader - DeFi wallet manager panel
// src/components/WalletManager.jsx

import { useState, useEffect } from 'react';

const CHAINS = [
  { id: 'ethereum', label: 'Ethereum', symbol: 'ETH', chainId: 1 },
  { id: 'arbitrum', label: 'Arbitrum', symbol: 'ETH', chainId: 42161 },
  { id: 'bsc',      label: 'BSC',      symbol: 'BNB', chainId: 56 },
  { id: 'polygon',  label: 'Polygon',  symbol: 'MATIC', chainId: 137 },
];

const COMMON_TOKENS = {
  ethereum: ['0xdAC17F958D2ee523a2206206994597C13D831ec7', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
  arbitrum: ['0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'],
  bsc: ['0x55d398326f99059fF775485246999027B3197955'],
  polygon: ['0xc2132D05D31c914a87C6611C10748AEb04B58e8F'],
};

function fmt(n, d = 4) { return n !== undefined ? Number(n).toFixed(d) : '—'; }

function truncate(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function WalletCard({ wallet, onRefreshBalance }) {
  const [balances, setBalances] = useState({ native: null });
  const [loading, setLoading] = useState(false);

  const refreshBalance = async () => {
    setLoading(true);
    if (window.electronAPI?.wallet?.getBalance) {
      const result = await window.electronAPI.wallet.getBalance(wallet.chain, wallet.address);
      if (result) setBalances(result);
    }
    setLoading(false);
  };

  useEffect(() => { refreshBalance(); }, [wallet.address]);

  const chain = CHAINS.find(c => c.id === wallet.chain);

  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', color: '#2196f3' }}>{chain?.label || wallet.chain}</span>
            <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>Chain ID: {chain?.chainId}</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#ccc' }}>{wallet.address}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {loading ? (
            <span style={{ color: '#888', fontSize: '13px' }}>Loading...</span>
          ) : (
            <>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                {fmt(balances.native)} {chain?.symbol}
              </div>
              {balances.tokens && Object.entries(balances.tokens).map(([addr, bal]) => (
                <div key={addr} style={{ fontSize: '12px', color: '#aaa' }}>
                  {fmt(bal, 2)} ({truncate(addr)})
                </div>
              ))}
            </>
          )}
          <button onClick={refreshBalance} style={{ fontSize: '11px', marginTop: '4px', cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

function PoolPrice({ chain, tokenA, tokenB }) {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    if (!tokenA || !tokenB) return;
    setLoading(true);
    if (window.electronAPI?.wallet?.getPoolPrice) {
      const result = await window.electronAPI.wallet.getPoolPrice(chain, tokenA, tokenB);
      setPrice(result?.price);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', fontSize: '13px' }}>
      <span style={{ color: '#888', width: '80px' }}>{chain}</span>
      <span style={{ fontFamily: 'monospace', flex: 1 }}>{truncate(tokenA)} / {truncate(tokenB)}</span>
      <span style={{ color: '#4caf50' }}>{loading ? '...' : price ? `$${fmt(price)}` : '—'}</span>
      <button onClick={fetch} style={{ fontSize: '11px', cursor: 'pointer' }}>Query</button>
    </div>
  );
}

export default function WalletManager() {
  const [wallets, setWallets] = useState([]);
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [importKey, setImportKey] = useState('');
  const [tab, setTab] = useState('wallets');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadWallets = async () => {
    if (window.electronAPI?.wallet?.listWallets) {
      const result = await window.electronAPI.wallet.listWallets();
      if (Array.isArray(result)) setWallets(result);
    }
  };

  useEffect(() => { loadWallets(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    if (window.electronAPI?.wallet?.createWallet) {
      await window.electronAPI.wallet.createWallet(selectedChain);
      await loadWallets();
    }
    setCreating(false);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importKey.trim()) return;
    setImporting(true);
    if (window.electronAPI?.wallet?.importWallet) {
      await window.electronAPI.wallet.importWallet(selectedChain, importKey.trim());
      await loadWallets();
    }
    setImportKey('');
    setImporting(false);
  };

  const filteredWallets = wallets.filter(w => !selectedChain || w.chain === selectedChain);

  // Pool price pairs (common token pairs per chain)
  const poolPairs = [
    { chain: 'ethereum', tokenA: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', tokenB: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    { chain: 'arbitrum', tokenA: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', tokenB: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
    { chain: 'bsc', tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', tokenB: '0x55d398326f99059fF775485246999027B3197955' },
    { chain: 'polygon', tokenA: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', tokenB: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
  ];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>DeFi Wallet Manager</h2>
        <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
          Private keys are encrypted in the OS keychain. Addresses only are shown here.
        </p>
      </div>

      {/* Chain selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button onClick={() => setSelectedChain('')} style={{
          padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
          background: selectedChain === '' ? '#1a3a5a' : '#1a1a1a',
          color: selectedChain === '' ? '#2196f3' : '#888', border: 'none'
        }}>All</button>
        {CHAINS.map(c => (
          <button key={c.id} onClick={() => setSelectedChain(c.id)} style={{
            padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
            background: selectedChain === c.id ? '#1a3a5a' : '#1a1a1a',
            color: selectedChain === c.id ? '#2196f3' : '#888', border: 'none'
          }}>{c.label}</button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '16px' }}>
        {['wallets', 'add', 'pools'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer',
            background: tab === t ? '#1a3a5a' : '#1a1a1a',
            color: tab === t ? '#2196f3' : '#888',
            borderBottom: tab === t ? '2px solid #2196f3' : '2px solid transparent'
          }}>
            {t === 'wallets' ? 'My Wallets' : t === 'add' ? 'Add Wallet' : 'DEX Prices'}
          </button>
        ))}
      </div>

      {tab === 'wallets' && (
        <div>
          {filteredWallets.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '30px', color: '#555' }}>
              No wallets for {selectedChain || 'any chain'}. Add one in the "Add Wallet" tab.
            </div>
          ) : (
            filteredWallets.map((w, i) => <WalletCard key={i} wallet={w} />)
          )}
        </div>
      )}

      {tab === 'add' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="card">
            <h3 style={{ fontSize: '14px', marginBottom: '16px' }}>Create New Wallet</h3>
            <div className="form-group">
              <label>Chain</label>
              <select value={selectedChain || 'ethereum'}
                onChange={e => setSelectedChain(e.target.value)}
                style={{ width: '100%', padding: '8px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}>
                {CHAINS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <button className="primary-btn" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Generate New Wallet'}
            </button>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '14px', marginBottom: '16px' }}>Import Existing Wallet</h3>
            <form onSubmit={handleImport}>
              <div className="form-group">
                <label>Chain</label>
                <select value={selectedChain || 'ethereum'}
                  onChange={e => setSelectedChain(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}>
                  {CHAINS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Private Key</label>
                <input type="password" value={importKey} onChange={e => setImportKey(e.target.value)}
                  required placeholder="0x..." />
              </div>
              <button type="submit" className="primary-btn" disabled={importing}>
                {importing ? 'Importing...' : 'Import Wallet'}
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === 'pools' && (
        <div className="card">
          <h3 style={{ fontSize: '14px', marginBottom: '16px' }}>DEX Pool Prices</h3>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
            Click "Query" to fetch the current price from on-chain liquidity pools (read-only, no gas).
          </p>
          <div style={{ marginBottom: '8px', display: 'grid', gridTemplateColumns: '80px 1fr 80px 60px', gap: '8px', fontSize: '11px', color: '#555' }}>
            <span>CHAIN</span><span>PAIR (TOKEN A / TOKEN B)</span><span>PRICE</span><span></span>
          </div>
          {poolPairs.map((p, i) => (
            <PoolPrice key={i} chain={p.chain} tokenA={p.tokenA} tokenB={p.tokenB} />
          ))}
          <p style={{ fontSize: '11px', color: '#555', marginTop: '16px' }}>
            WETH/USDT (ETH), WETH/USDT (ARB), WBNB/USDT (BSC), WMATIC/USDT (POLY)
          </p>
        </div>
      )}
    </div>
  );
}
