// NeutronTrader - Local HTTP webhook receiver for push-based listing alerts
// Listens on localhost:7890 for POST /listing from Telegram bots or custom scripts.

const http = require('http');
const EventEmitter = require('events');

class WebhookReceiver extends EventEmitter {
  constructor(port = 7890) {
    super();
    this.port = port;
    this._server = null;
  }

  start() {
    this._server = http.createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/listing') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const { symbol, exchange, source } = payload;

          if (!symbol || !exchange) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'symbol and exchange required' }));
            return;
          }

          console.log(`[WebhookReceiver] Received listing alert: ${symbol} on ${exchange}`);
          this.emit('new-listing', {
            symbol,
            exchange,
            source: source || 'webhook',
            detectedAt: Date.now(),
            raw: payload
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    });

    this._server.listen(this.port, '127.0.0.1', () => {
      console.log(`[WebhookReceiver] Listening on http://127.0.0.1:${this.port}/listing`);
    });

    this._server.on('error', e => {
      console.warn(`[WebhookReceiver] Server error: ${e.message}`);
    });
  }

  stop() {
    if (this._server) {
      this._server.close();
      this._server = null;
      console.log('[WebhookReceiver] Stopped');
    }
  }
}

module.exports = { WebhookReceiver };
