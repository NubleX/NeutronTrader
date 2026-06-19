// NeutronTrader - Portfolio aggregation panel (CEX + BSC)

import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getPortfolioSnapshot, getBscBalances } from '../services/portfolioService';
import WalletButton from './WalletButton';

const COLORS = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4'];

function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function PortfolioPanel() {
  const [snapshot, setSnapshot] = useState(null);
  const [bscData, setBscData] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async (address = walletAddress) => {
    setLoading(true);
    setError('');
    try {
      const [cex, bsc] = await Promise.all([
        getPortfolioSnapshot(),
        address ? getBscBalances(address) : Promise.resolve(null),
      ]);
      setSnapshot(cex);
      setBscData(bsc);
      if (!cex?.exchanges?.length && !bsc) {
        setError('Connect a wallet or add exchange API keys in the Exchanges tab.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    const saved = localStorage.getItem('neutron_wallet_address');
    if (saved && /^0x[a-fA-F0-9]{40}$/.test(saved)) {
      setWalletAddress(saved);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh(), 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  const handleWalletChange = (addr) => {
    setWalletAddress(addr);
    refresh(addr);
  };

  const bnbPrice = snapshot?.assets?.find(a => a.asset === 'BNB')?.usdtValue
    && snapshot.assets.find(a => a.asset === 'BNB')?.free
    ? snapshot.assets.find(a => a.asset === 'BNB').usdtValue / snapshot.assets.find(a => a.asset === 'BNB').free
    : null;

  const bscAssets = [];
  if (bscData) {
    if (bscData.bnb > 0) {
      bscAssets.push({
        asset: 'BNB',
        free: bscData.bnb,
        locked: 0,
        usdtValue: bnbPrice ? bscData.bnb * bnbPrice : 0,
        source: 'bsc',
      });
    }
    for (const t of bscData.tokens || []) {
      bscAssets.push({
        asset: t.asset,
        free: t.balance,
        locked: 0,
        usdtValue: ['USDT', 'USDC', 'BUSD'].includes(t.asset) ? t.balance : 0,
        source: 'bsc',
      });
    }
  }

  const allAssets = [...(snapshot?.assets || [])];
  for (const b of bscAssets) {
    const existing = allAssets.find(a => a.asset === b.asset);
    if (existing) {
      existing.free += b.free;
      existing.usdtValue += b.usdtValue;
      existing.exchanges = [...(existing.exchanges || []), { exchange: 'bsc-wallet', free: b.free }];
    } else {
      allAssets.push({ ...b, exchanges: [{ exchange: 'bsc-wallet', free: b.free }] });
    }
  }

  const totalUSDT = (snapshot?.totalUSDT || 0) + bscAssets.reduce((s, a) => s + a.usdtValue, 0);
  const pieData = allAssets.filter(a => a.usdtValue > 0).map(a => ({ name: a.asset, value: a.usdtValue }));

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Portfolio</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <WalletButton onAccountChange={handleWalletChange} />
          <button className="primary-btn" onClick={() => refresh()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && !walletAddress && (
        <div className="card" style={{ padding: '12px', color: '#ff9800', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>TOTAL VALUE (USDT)</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4caf50' }}>
            ${fmt(totalUSDT)}
          </div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
            CEX: {(snapshot?.exchanges || []).join(', ') || 'none'}
            {walletAddress && <span> · BSC: {walletAddress.slice(0, 8)}...</span>}
          </div>
        </div>

        <div className="card" style={{ padding: '16px', height: '200px' }}>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `$${fmt(v)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: '#555', textAlign: 'center', paddingTop: '60px' }}>No asset data</div>
          )}
        </div>
      </div>

      {bscData && (
        <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>BSC Wallet</h3>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
            BNB: {fmt(bscData.bnb, 6)} · Tokens: {bscData.tokens?.length || 0}
          </div>
        </div>
      )}

      <div className="card">
        <div style={{
          display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr',
          gap: '8px', fontSize: '11px', color: '#888', padding: '4px 0',
          borderBottom: '1px solid #333', marginBottom: '4px'
        }}>
          <span>ASSET</span><span>FREE</span><span>LOCKED</span><span>USDT VALUE</span>
        </div>
        {allAssets.length === 0 ? (
          <div style={{ color: '#555', padding: '20px 0', textAlign: 'center' }}>No balances found</div>
        ) : (
          allAssets.map(a => (
            <div key={a.asset} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr',
              gap: '8px', fontSize: '13px', padding: '8px 0',
              borderBottom: '1px solid #2a2a2a'
            }}>
              <span style={{ fontWeight: 'bold' }}>{a.asset}</span>
              <span>{fmt(a.free, 6)}</span>
              <span>{fmt(a.locked, 6)}</span>
              <span style={{ color: '#4caf50' }}>${fmt(a.usdtValue)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
