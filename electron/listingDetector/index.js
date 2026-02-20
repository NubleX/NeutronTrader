// NeutronTrader - Listing detector orchestrator
// Aggregates events from all sources and deduplicates.

const EventEmitter = require('events');
const { ExchangeApiPoller } = require('./exchangeApiPoller');
const { AnnouncementScraper } = require('./announcementScraper');
const { WebhookReceiver } = require('./webhookReceiver');

class ListingDetector extends EventEmitter {
  constructor(adapters, config = {}) {
    super();
    this._seen = new Map(); // symbol:exchange -> timestamp (dedup)
    this._dedupWindowMs = config.dedupWindowMs || 60000;

    this.apiPoller = new ExchangeApiPoller(adapters, config.apiPollIntervalMs || 30000);
    this.scraper = new AnnouncementScraper(config.scrapIntervalMs || 60000);
    this.webhook = new WebhookReceiver(config.webhookPort || 7890);

    // Wire all sources to our handler
    for (const source of [this.apiPoller, this.scraper, this.webhook]) {
      source.on('new-listing', listing => this._onListing(listing));
    }
  }

  async start() {
    await this.apiPoller.start();
    this.scraper.start();
    this.webhook.start();
    console.log('[ListingDetector] All sources started');
  }

  stop() {
    this.apiPoller.stop();
    this.scraper.stop();
    this.webhook.stop();
    console.log('[ListingDetector] All sources stopped');
  }

  _onListing(listing) {
    const key = `${listing.symbol}:${listing.exchange}`;
    const lastSeen = this._seen.get(key);
    const now = Date.now();

    // Deduplicate within the window
    if (lastSeen && now - lastSeen < this._dedupWindowMs) return;
    this._seen.set(key, now);

    console.log(`[ListingDetector] *** NEW LISTING *** ${listing.symbol} on ${listing.exchange} (source: ${listing.source})`);
    this.emit('new-listing', listing);
  }
}

module.exports = { ListingDetector };
