// NeutronTrader - Multi-exchange live dashboard
// Copyright (C) 2025  Igor Dunaev (NubleX)

import { useEffect, useRef, useState } from 'react';

const EXCHANGES = ['binance', 'coinbase', 'kraken', 'okx', 'bybit'];
const DEFAULT_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT'];

function fmt(n, d = 2) {
  if (!n || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function pct(n) {
  if (!n || isNaN(n)) return null;
  return Number(n).toFixed(3);
}

export default function Dashboard() {
  // snapshot: { "BTC/USDT:binance": { price, bid, ask, timestamp }, ... }
  const [snapshot, setSnapshot] = useState({});
  const [opportunities, setOpportunities] = useState([]);
  const [status, setStatus] = useState('CONNECTING');
  const timerRef = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (!window.electronAPI?.priceFeed) {
      setStatus('NO ELECTRON API');
      return;
    }

    // Poll snapshot every 3s
    const poll = async () => {
      try {
        const snap = await window.electronAPI.priceFeed.getSnapshot();
        if (snap && Object.keys(snap).length > 0) {
          setSnapshot(snap);
          setStatus('LIVE');
        }
      } catch (e) {
        setStatus('ERROR');
      }
    };

    poll();
    timerRef.current = setInterval(poll, 15000);

    // Listen for arbitrage opportunities
    if (window.electronAPI.exchange?.onOpportunity) {
      cleanupRef.current = window.electronAPI.exchange.onOpportunity(opp => {
        setOpportunities(prev => [opp, ...prev].slice(0, 20));
      });
    }

    return () => {
      clearInterval(timerRef.current);
      if (typeof cleanupRef.current === 'function') cleanupRef.current();
    };
  }, []);

  // Build per-symbol rows: { symbol -> { exchange -> { price, bid, ask } } }
  const bySymbol = {};
  for (const [key, data] of Object.entries(snapshot)) {
    const colon = key.lastIndexOf(':');
    const symbol = key.slice(0, colon);
    const exchange = key.slice(colon + 1);
    if (!bySymbol[symbol]) bySymbol[symbol] = {};
    bySymbol[symbol][exchange] = data;
  }

  const symbols = DEFAULT_SYMBOLS.filter(s => bySymbol[s]);

  return (
    <div style={{ fontFamily: 'Monaco, Consolas, monospace', fontSize: '12px', padding: '16px', color: '#fff', background: '#0a0a0a', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '12px' }}>
        <h1 style={{ margin: 0, color: '#00ff88', fontSize: '16px', letterSpacing: '2px' }}>NEUTRON TERMINAL</h1>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
          <span style={{ color: status === 'LIVE' ? '#00ff88' : '#ff4444' }}>
            ● {status}
          </span>
          <span style={{ color: '#555' }}>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Price grid */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ color: '#555', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>LIVE PRICES — ALL EXCHANGES</div>

        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '110px repeat(5, 1fr)', gap: '4px', marginBottom: '4px' }}>
          <div style={{ color: '#444', fontSize: '10px' }}>SYMBOL</div>
          {EXCHANGES.map(ex => (
            <div key={ex} style={{ color: '#555', fontSize: '10px', textAlign: 'right', textTransform: 'uppercase' }}>{ex}</div>
          ))}
        </div>

        {symbols.length === 0 ? (
          <div style={{ color: '#444', padding: '20px 0' }}>Waiting for price data...</div>
        ) : symbols.map(symbol => {
          const row = bySymbol[symbol] || {};
          const prices = EXCHANGES.map(ex => row[ex]?.price).filter(Boolean);
          const minPrice = prices.length ? Math.min(...prices) : null;
          const maxPrice = prices.length ? Math.max(...prices) : null;

          return (
            <div key={symbol} style={{ display: 'grid', gridTemplateColumns: '110px repeat(5, 1fr)', gap: '4px', padding: '6px 0', borderBottom: '1px solid #111' }}>
              <div style={{ color: '#00ff88', fontWeight: 'bold' }}>{symbol}</div>
              {EXCHANGES.map(ex => {
                const d = row[ex];
                const p = d?.price;
                const isBest = p && p === minPrice;
                const isWorst = p && p === maxPrice;
                return (
                  <div key={ex} style={{ textAlign: 'right', color: !p ? '#333' : isBest ? '#00ff88' : isWorst ? '#ff6644' : '#ccc' }}>
                    {p ? fmt(p, p > 100 ? 2 : 4) : '—'}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Spread summary */}
      {symbols.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ color: '#555', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>CROSS-EXCHANGE SPREAD</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {symbols.map(symbol => {
              const row = bySymbol[symbol] || {};
              const entries = EXCHANGES.map(ex => ({ ex, p: row[ex]?.price })).filter(e => e.p);
              if (entries.length < 2) return null;
              const lo = entries.reduce((a, b) => b.p < a.p ? b : a);
              const hi = entries.reduce((a, b) => b.p > a.p ? b : a);
              const spread = ((hi.p - lo.p) / lo.p * 100);
              return (
                <div key={symbol} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '10px' }}>
                  <div style={{ color: '#00ff88', marginBottom: '4px', fontWeight: 'bold' }}>{symbol}</div>
                  <div style={{ color: '#888', fontSize: '11px' }}>
                    Low: <span style={{ color: '#fff' }}>{lo.ex} ${fmt(lo.p, lo.p > 100 ? 2 : 4)}</span>
                  </div>
                  <div style={{ color: '#888', fontSize: '11px' }}>
                    High: <span style={{ color: '#fff' }}>{hi.ex} ${fmt(hi.p, hi.p > 100 ? 2 : 4)}</span>
                  </div>
                  <div style={{ marginTop: '4px', color: spread > 1 ? '#ffaa00' : '#555', fontSize: '11px' }}>
                    Spread: {pct(spread)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live arbitrage opportunities */}
      <div>
        <div style={{ color: '#555', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>
          ARBITRAGE OPPORTUNITIES {opportunities.length > 0 && <span style={{ color: '#ffaa00' }}>({opportunities.length})</span>}
        </div>
        {opportunities.length === 0 ? (
          <div style={{ color: '#333', fontSize: '11px' }}>No opportunities above threshold yet — go to Arbitrage tab to adjust settings</div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 80px 80px 80px 80px 1fr', gap: '8px', fontSize: '10px', color: '#444', borderBottom: '1px solid #1a1a1a', paddingBottom: '4px', marginBottom: '4px' }}>
              <span>SYMBOL</span><span>BUY</span><span>SELL</span><span>BUY $</span><span>SELL $</span><span>NET %</span>
            </div>
            {opportunities.map((opp, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 80px 80px 80px 80px 1fr', gap: '8px', fontSize: '11px', padding: '4px 0', borderBottom: '1px solid #111' }}>
                <span style={{ color: '#00ff88' }}>{opp.symbol}</span>
                <span style={{ color: '#2196f3' }}>{opp.buyExchange}</span>
                <span style={{ color: '#ff9800' }}>{opp.sellExchange}</span>
                <span>${fmt(opp.buyPrice)}</span>
                <span>${fmt(opp.sellPrice)}</span>
                <span style={{ color: '#00ff88', fontWeight: 'bold' }}>{opp.netProfitPct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
