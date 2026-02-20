// NeutronTrader - Universal symbol normalizer
// Maps 'BTC/USDT' (universal) <-> exchange-specific formats

const EXCHANGE_FORMATS = {
  binance: {
    separator: '',
    prefixMap: {},
    suffixMap: {}
  },
  coinbase: {
    separator: '-',
    prefixMap: {},
    suffixMap: {}
  },
  kraken: {
    separator: '',
    // Kraken-specific: BTC->XBT, DOGE->XDG, wraps in X...Z
    toExchange: (base, quote) => {
      const bMap = { BTC: 'XBT', DOGE: 'XDG' };
      const qMap = { USD: 'ZUSD', EUR: 'ZEUR', USDT: 'USDT' };
      return `X${bMap[base] || base}${qMap[quote] || quote}`;
    },
    fromExchange: (sym) => {
      const bMap = { XBT: 'BTC', XDG: 'DOGE' };
      // Strip leading X, trailing Z+quote
      const match = sym.match(/^X?([A-Z]+?)Z?([A-Z]{3,4})$/);
      if (!match) return sym;
      return `${bMap[match[1]] || match[1]}/${match[2]}`;
    }
  },
  okx: {
    separator: '-',
    prefixMap: {},
    suffixMap: {}
  },
  bybit: {
    separator: '',
    prefixMap: {},
    suffixMap: {}
  }
};

/**
 * Convert universal format to exchange-specific
 * @param {string} universal - e.g. 'BTC/USDT'
 * @param {string} exchange - 'binance' | 'coinbase' | 'kraken' | 'okx' | 'bybit'
 */
function toExchange(universal, exchange) {
  const fmt = EXCHANGE_FORMATS[exchange];
  if (!fmt) return universal;

  const [base, quote] = universal.split('/');
  if (!base || !quote) return universal;

  if (fmt.toExchange) return fmt.toExchange(base, quote);
  return `${fmt.prefixMap[base] || base}${fmt.separator}${fmt.prefixMap[quote] || quote}`.toUpperCase();
}

/**
 * Convert exchange-specific format to universal
 * @param {string} exchangeSymbol - exchange native symbol
 * @param {string} exchange
 */
function fromExchange(exchangeSymbol, exchange) {
  const fmt = EXCHANGE_FORMATS[exchange];
  if (!fmt) return exchangeSymbol;
  if (fmt.fromExchange) return fmt.fromExchange(exchangeSymbol);

  const sep = fmt.separator;
  if (sep && exchangeSymbol.includes(sep)) {
    const [base, quote] = exchangeSymbol.split(sep);
    return `${base}/${quote}`;
  }

  // No separator — guess by common quote currencies
  const quotes = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'USD'];
  for (const q of quotes) {
    if (exchangeSymbol.endsWith(q)) {
      return `${exchangeSymbol.slice(0, -q.length)}/${q}`;
    }
  }
  return exchangeSymbol;
}

module.exports = { toExchange, fromExchange };
