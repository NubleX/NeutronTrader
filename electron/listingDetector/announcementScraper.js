// NeutronTrader - Announcement scraper for new listing alerts
// Polls Binance and Coinbase announcement RSS/API feeds every 60 seconds.

const EventEmitter = require('events');
const https = require('https');

class AnnouncementScraper extends EventEmitter {
  constructor(intervalMs = 60000) {
    super();
    this.intervalMs = intervalMs;
    this._seen = new Set(); // seen announcement IDs/titles
    this._timer = null;
  }

  start() {
    this._poll(); // immediate
    this._timer = setInterval(() => this._poll(), this.intervalMs);
    console.log('[AnnouncementScraper] Started');
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    console.log('[AnnouncementScraper] Stopped');
  }

  async _poll() {
    await Promise.allSettled([
      this._checkBinance(),
      this._checkCoinbase()
    ]);
  }

  async _checkBinance() {
    try {
      const data = await this._fetch('https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=48&pageNo=1&pageSize=5');
      const articles = data?.data?.catalogs?.[0]?.articles || [];
      for (const article of articles) {
        const id = String(article.id);
        if (this._seen.has(id)) continue;
        this._seen.add(id);
        // Prevent unbounded growth — keep at most 500 seen IDs
        if (this._seen.size > 500) {
          this._seen.delete(this._seen.values().next().value);
        }

        const title = article.title || '';
        if (this._isListingAnnouncement(title)) {
          const symbols = this._extractSymbols(title);
          for (const symbol of symbols) {
            console.log(`[AnnouncementScraper] Binance listing announcement: ${symbol} (${title})`);
            this.emit('new-listing', {
              symbol,
              exchange: 'binance',
              source: 'announcement',
              title,
              url: `https://www.binance.com/en/support/announcement/${article.code}`,
              detectedAt: Date.now()
            });
          }
        }
      }
    } catch (e) {
      // Silently ignore scraping errors
    }
  }

  async _checkCoinbase() {
    try {
      const data = await this._fetch('https://api.coinbase.com/api/v3/brokerage/products?product_type=SPOT&limit=10');
      // Coinbase doesn't have a good announcement endpoint — skip for now
    } catch (e) { /* ignore */ }
  }

  _isListingAnnouncement(title) {
    const keywords = ['Will List', 'Lists', 'Listing', 'New Listing', 'Adding'];
    return keywords.some(kw => title.toLowerCase().includes(kw.toLowerCase()));
  }

  _extractSymbols(title) {
    // Match patterns like (BTC), (ETH), BTC/USDT, BTCUSDT
    const symbols = [];
    const parenthesisMatch = title.match(/\(([A-Z]{2,10})\)/g);
    if (parenthesisMatch) {
      for (const m of parenthesisMatch) {
        const sym = m.slice(1, -1);
        if (sym !== 'USD' && sym !== 'USDT') {
          symbols.push(`${sym}/USDT`);
        }
      }
    }
    return symbols.length > 0 ? symbols : [];
  }

  _fetch(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: { 'User-Agent': 'NeutronTrader/2.0.0' },
        timeout: 10000
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
  }
}

module.exports = { AnnouncementScraper };
