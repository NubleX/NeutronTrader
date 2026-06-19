// Derive arbitrage opportunities from a price snapshot (dashboard + hook)

const EXCHANGE_FEES = {
  binance: 0.001,
  coinbase: 0.006,
  kraken: 0.0026,
  okx: 0.001,
  bybit: 0.001,
};

const DEFAULT_MIN_PROFIT_PCT = 0.3;

/** Use mid price when bid/ask are missing or clearly stale vs last price */
function bookPrices(data) {
  const mid = Number(data.price);
  if (!mid || !Number.isFinite(mid)) return null;

  let bid = Number(data.bid ?? mid);
  let ask = Number(data.ask ?? mid);
  if (!Number.isFinite(bid)) bid = mid;
  if (!Number.isFinite(ask)) ask = mid;

  // Stale order-book legs saved beside a fresh last price (e.g. cached testnet books)
  const drift = 0.02;
  if (Math.abs(bid - mid) / mid > drift) bid = mid;
  if (Math.abs(ask - mid) / mid > drift) ask = mid;

  return { bid, ask };
}

export function computeArbitrageOpportunities(snapshot, minProfitPct = DEFAULT_MIN_PROFIT_PCT) {
  if (!snapshot || typeof snapshot !== 'object') return [];

  const bySymbol = {};

  for (const [key, data] of Object.entries(snapshot)) {
    if (!data) continue;
    const colon = key.lastIndexOf(':');
    if (colon <= 0) continue;

    const symbol = key.slice(0, colon);
    const exchange = key.slice(colon + 1);
    const book = bookPrices(data);
    if (!book) continue;

    if (!bySymbol[symbol]) bySymbol[symbol] = [];
    bySymbol[symbol].push({ exchange, ...book });
  }

  const opps = [];

  for (const [symbol, prices] of Object.entries(bySymbol)) {
    if (prices.length < 2) continue;

    const bestBid = prices.reduce((a, b) => (b.bid > a.bid ? b : a));
    const bestAsk = prices.reduce((a, b) => (b.ask < a.ask ? b : a));
    if (bestBid.exchange === bestAsk.exchange) continue;

    const buyFee = EXCHANGE_FEES[bestAsk.exchange] ?? 0.001;
    const sellFee = EXCHANGE_FEES[bestBid.exchange] ?? 0.001;
    const grossSpread = (bestBid.bid - bestAsk.ask) / bestAsk.ask;
    const netPct = (grossSpread - buyFee - sellFee) * 100;

    if (netPct >= minProfitPct) {
      opps.push({
        symbol,
        buyExchange: bestAsk.exchange,
        buyPrice: bestAsk.ask,
        sellExchange: bestBid.exchange,
        sellPrice: bestBid.bid,
        grossSpreadPct: (grossSpread * 100).toFixed(4),
        netProfitPct: netPct.toFixed(4),
        timestamp: Date.now(),
      });
    }
  }

  return opps.sort((a, b) => parseFloat(b.netProfitPct) - parseFloat(a.netProfitPct));
}
