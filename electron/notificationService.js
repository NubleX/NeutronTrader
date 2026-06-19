// NeutronTrader - Desktop notification service

const { Notification } = require('electron');
const { storageService } = require('./storageService');

const DEFAULT_PREFS = {
  arbOpportunities: true,
  arbExecutions: true,
  listingAlerts: true,
  botSignals: true,
  minArbProfitPct: 0.3,
};

class NotificationService {
  constructor() {
    this._prefs = { ...DEFAULT_PREFS };
    this._initialized = false;
    this._feedPaused = false;
    this._arbCooldown = new Map(); // key -> last notified timestamp
    this._arbCooldownMs = 120000; // 2 min per unique opportunity
  }

  setFeedPaused(paused) {
    this._feedPaused = !!paused;
  }

  isFeedPaused() {
    return this._feedPaused;
  }

  _arbKey(opp) {
    return `${opp.symbol}:${opp.buyExchange}:${opp.sellExchange}`;
  }

  _shouldNotifyArb(opp) {
    if (this._feedPaused) return false;
    const key = this._arbKey(opp);
    const now = Date.now();
    const last = this._arbCooldown.get(key) || 0;
    if (now - last < this._arbCooldownMs) return false;
    this._arbCooldown.set(key, now);
    return true;
  }

  async initialize() {
    if (this._initialized) return;
    const saved = await storageService.getSetting('notification_prefs', null);
    if (saved) this._prefs = { ...DEFAULT_PREFS, ...saved };
    this._initialized = true;
  }

  async getPrefs() {
    await this.initialize();
    return { ...this._prefs };
  }

  async updatePrefs(prefs) {
    await this.initialize();
    this._prefs = { ...this._prefs, ...prefs };
    await storageService.saveSetting('notification_prefs', this._prefs);
    return this._prefs;
  }

  notify(title, body, options = {}) {
    if (!Notification.isSupported()) {
      console.log(`[Notification] ${title}: ${body}`);
      return;
    }
    const n = new Notification({
      title,
      body,
      silent: options.silent || false,
    });
    n.show();
  }

  notifyArbOpportunity(opp) {
    if (!this._prefs.arbOpportunities) return;
    if (!this._shouldNotifyArb(opp)) return;
    const profit = parseFloat(opp.netProfitPct || 0);
    if (profit < this._prefs.minArbProfitPct) return;
    this.notify(
      'Arbitrage Opportunity',
      `${opp.symbol}: ${profit}% net — buy ${opp.buyExchange} / sell ${opp.sellExchange}`
    );
  }

  notifyArbExecuted(record) {
    if (this._feedPaused) return;
    if (!this._prefs.arbExecutions) return;
    const pnl = record.pnl != null ? ` P&L: ${record.pnl.toFixed(2)} USDT` : '';
    this.notify('Arbitrage Executed', `${record.symbol}: ${record.buyExchange} → ${record.sellExchange}${pnl}`);
  }

  notifyListing(listing) {
    if (this._feedPaused) return;
    if (!this._prefs.listingAlerts) return;
    this.notify('New Listing', `${listing.symbol} on ${listing.exchange} (${listing.source || 'detected'})`);
  }

  notifyBotSignal(trade) {
    if (this._feedPaused) return;
    if (!this._prefs.botSignals) return;
    this.notify(
      `Bot Signal: ${trade.side}`,
      `${trade.symbol} @ ${trade.price} — ${trade.reason || trade.strategy}`
    );
  }

  test() {
    this.notify('NeutronTrader', 'Notifications are working!');
    return true;
  }
}

const notificationService = new NotificationService();

module.exports = { NotificationService, notificationService };
