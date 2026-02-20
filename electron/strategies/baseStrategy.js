// NeutronTrader - Base strategy class

const EventEmitter = require('events');

class BaseStrategy extends EventEmitter {
  constructor(name, riskManager, orderManager) {
    super();
    this.name = name;
    this.riskManager = riskManager;
    this.orderManager = orderManager;
    this._running = false;
  }

  start() { this._running = true; }
  stop()  { this._running = false; }
  isRunning() { return this._running; }
}

module.exports = { BaseStrategy };
