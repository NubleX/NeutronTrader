// NeutronTrader - Multi-exchange live dashboard

import { useMemo, useState } from 'react';
import { computeArbitrageOpportunities } from '../utils/arbitrageFromSnapshot';

const EXCHANGE_FEES = {
  binance: 0.001, coinbase: 0.006, kraken: 0.0026, okx: 0.001, bybit: 0.001,
};

function BestSpreadHint({ bySymbol, arbThreshold }) {
  const best = useMemo(() => {
    let top = null;
    for (const [symbol, row] of Object.entries(bySymbol)) {
      const entries = EXCHANGES.map(ex => ({ ex, p: row[ex]?.price })).filter(e => e.p);
      if (entries.length < 2) continue;
      const lo = entries.reduce((a, b) => b.p < a.p ? b : a);
      const hi = entries.reduce((a, b) => b.p > a.p ? b : a);
      const grossPct = (hi.p - lo.p) / lo.p * 100;
      const buyFee = (EXCHANGE_FEES[lo.ex] ?? 0.001) * 100;
      const sellFee = (EXCHANGE_FEES[hi.ex] ?? 0.001) * 100;
      const netPct = grossPct - buyFee - sellFee;
      if (!top || netPct > top.netPct) top = { symbol, lo, hi, grossPct, netPct, totalFees: buyFee + sellFee };
    }
    return top;
  }, [bySymbol]);

  if (!best) return <div style={{ color: '#333', fontSize: '11px' }}>Waiting for price data...</div>;

  const needed = (arbThreshold + best.totalFees).toFixed(3);
  return (
    <div style={{ color: '#555', fontSize: '11px', lineHeight: '1.7' }}>
      Best current spread: <span style={{ color: '#888' }}>{best.symbol}</span>{' '}
      <span style={{ color: '#2196f3' }}>{best.lo.ex}</span>→<span style={{ color: '#ff9800' }}>{best.hi.ex}</span>{' '}
      gross <span style={{ color: '#aaa' }}>{best.grossPct.toFixed(3)}%</span>{' '}
      — fees <span style={{ color: '#666' }}>{best.totalFees.toFixed(3)}%</span>{' '}
      = net <span style={{ color: best.netPct >= 0 ? '#ffaa00' : '#f44336' }}>{best.netPct.toFixed(3)}%</span>
      <br />
      <span style={{ color: '#444' }}>
        Need gross ≥ {needed}% to net {arbThreshold}%. Fees are taker rates — maker orders or lower-fee accounts clear this faster.
      </span>
    </div>
  );
}

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

export default function Dashboard({
  snapshot = {},
  arbThreshold = 0.1,
  onArbThresholdChange,
  status = 'CONNECTING',
  feedMode = 'polling',
  latencyMs = null,
  paused = false,
  stale = false,
  lastUpdated = null,
  onTogglePause,
  onToggleFeedMode,
}) {
  const [thresholdInput, setThresholdInput] = useState(String(arbThreshold));

  const bySymbol = useMemo(() => {
    const map = {};
    for (const [key, data] of Object.entries(snapshot)) {
      const colon = key.lastIndexOf(':');
      const symbol = key.slice(0, colon);
      const exchange = key.slice(colon + 1);
      if (!map[symbol]) map[symbol] = {};
      map[symbol][exchange] = data;
    }
    return map;
  }, [snapshot]);

  const opportunities = useMemo(
    () => computeArbitrageOpportunities(snapshot, arbThreshold),
    [snapshot, arbThreshold]
  );

  const commitThreshold = () => {
    const v = parseFloat(thresholdInput);
    if (Number.isFinite(v) && v >= 0) onArbThresholdChange?.(v);
    else setThresholdInput(String(arbThreshold));
  };

  const symbols = DEFAULT_SYMBOLS.filter(s => bySymbol[s]);
  const statusColor = ['LIVE', 'WS LIVE'].includes(status) ? '#00ff88'
    : status === 'STALE' ? '#ffaa00' : '#ff4444';

  return (
    <div style={{ fontFamily: 'Monaco, Consolas, monospace', fontSize: '12px', padding: '16px', color: '#fff', background: '#0a0a0a', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '12px' }}>
        <h1 style={{ margin: 0, color: '#00ff88', fontSize: '16px', letterSpacing: '2px' }}>NEUTRON TERMINAL</h1>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', alignItems: 'center' }}>
          <button onClick={onTogglePause} style={{
            background: paused ? '#4a1a1a' : '#1a1a1a', border: '1px solid #333',
            color: paused ? '#f44336' : '#aaa', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px',
          }}>
            {paused ? 'RESUME' : 'PAUSE'}
          </button>
          <button onClick={onToggleFeedMode} style={{
            background: '#1a1a1a', border: '1px solid #333', color: '#aaa',
            padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px',
          }}>
            {feedMode === 'websocket' ? 'WS' : 'REST'}
          </button>
          <span style={{ color: '#555', fontSize: '10px' }}>MIN NET%</span>
          <input
            type="number"
            min="0"
            step="0.05"
            value={thresholdInput}
            onChange={e => setThresholdInput(e.target.value)}
            onBlur={commitThreshold}
            onKeyDown={e => e.key === 'Enter' && commitThreshold()}
            style={{
              width: '52px', padding: '3px 5px', background: '#1a1a1a',
              border: '1px solid #333', color: '#fff', borderRadius: '4px',
              fontSize: '11px', textAlign: 'center',
            }}
          />
          {latencyMs != null && !paused && (
            <span style={{ color: '#555' }}>latency {latencyMs}ms</span>
          )}
          <span style={{ color: statusColor }}>
            ● {paused ? 'PAUSED' : status}
          </span>
          {stale && lastUpdated && (
            <span style={{ color: '#ffaa00', fontSize: '10px' }}>
              cached {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <span style={{ color: '#555' }}>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {paused && (
        <div style={{ background: '#1a1a0a', border: '1px solid #333', padding: '8px 12px', marginBottom: '16px', color: '#ffaa00', fontSize: '11px' }}>
          Feed paused — data is frozen. Click RESUME to continue live updates.
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <div style={{ color: '#555', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>LIVE PRICES — ALL EXCHANGES</div>
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

      {symbols.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ color: '#555', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>CROSS-EXCHANGE SPREAD</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
            {symbols.map(symbol => {
              const row = bySymbol[symbol] || {};
              const entries = EXCHANGES.map(ex => ({ ex, p: row[ex]?.price })).filter(e => e.p);
              if (entries.length < 2) return null;
              const lo = entries.reduce((a, b) => b.p < a.p ? b : a);
              const hi = entries.reduce((a, b) => b.p > a.p ? b : a);
              const grossPct = (hi.p - lo.p) / lo.p * 100;
              const buyFee = (EXCHANGE_FEES[lo.ex] ?? 0.001) * 100;
              const sellFee = (EXCHANGE_FEES[hi.ex] ?? 0.001) * 100;
              const netPct = grossPct - buyFee - sellFee;
              const netColor = netPct >= arbThreshold ? '#00ff88' : netPct >= 0 ? '#ffaa00' : '#555';
              return (
                <div key={symbol} style={{
                  background: '#111',
                  border: netPct >= arbThreshold ? '1px solid #00ff4455' : '1px solid #1a1a1a',
                  borderRadius: '4px', padding: '10px'
                }}>
                  <div style={{ color: '#00ff88', marginBottom: '4px', fontWeight: 'bold' }}>{symbol}</div>
                  <div style={{ color: '#888', fontSize: '11px' }}>Buy:  <span style={{ color: '#fff' }}>{lo.ex} ${fmt(lo.p, lo.p > 100 ? 2 : 4)}</span></div>
                  <div style={{ color: '#888', fontSize: '11px' }}>Sell: <span style={{ color: '#fff' }}>{hi.ex} ${fmt(hi.p, hi.p > 100 ? 2 : 4)}</span></div>
                  <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#444', fontSize: '10px' }}>gross {pct(grossPct)}%</span>
                    <span style={{ color: '#444', fontSize: '10px' }}>fees {pct(buyFee + sellFee)}%</span>
                    <span style={{ color: netColor, fontSize: '11px', fontWeight: 'bold' }}>
                      net {netPct >= 0 ? '+' : ''}{pct(netPct)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div style={{ color: '#555', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>
          ARBITRAGE OPPORTUNITIES (NET ≥ {arbThreshold}%) {opportunities.length > 0 && <span style={{ color: '#ffaa00' }}>({opportunities.length})</span>}
        </div>
        {opportunities.length === 0 ? (
          <BestSpreadHint bySymbol={bySymbol} arbThreshold={arbThreshold} />
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 80px 80px 80px 80px 1fr', gap: '8px', fontSize: '10px', color: '#444', borderBottom: '1px solid #1a1a1a', paddingBottom: '4px', marginBottom: '4px' }}>
              <span>SYMBOL</span><span>BUY</span><span>SELL</span><span>BUY $</span><span>SELL $</span><span>NET %</span>
            </div>
            {opportunities.map((opp) => (
              <div key={`${opp.symbol}:${opp.buyExchange}:${opp.sellExchange}`} style={{ display: 'grid', gridTemplateColumns: '100px 80px 80px 80px 80px 1fr', gap: '8px', fontSize: '11px', padding: '4px 0', borderBottom: '1px solid #111' }}>
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
