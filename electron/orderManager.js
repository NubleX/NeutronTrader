// NeutronTrader - Multi-leg order execution manager

const { storageService } = require('./storageService');

class OrderManager {
  constructor(adapters) {
    this.adapters = adapters; // Map<exchangeName, adapter>
    this._activeOrders = new Map(); // orderId -> order metadata
  }

  /**
   * Execute a CEX-CEX arbitrage: buy on buyExchange, sell on sellExchange.
   * Returns { success, buyOrder, sellOrder, error }
   */
  async executeArbitrage({ symbol, buyExchange, sellExchange, quantity, buyPrice, sellPrice }) {
    const buyAdapter  = this.adapters.get(buyExchange);
    const sellAdapter = this.adapters.get(sellExchange);

    if (!buyAdapter)  throw new Error(`Buy exchange not configured: ${buyExchange}`);
    if (!sellAdapter) throw new Error(`Sell exchange not configured: ${sellExchange}`);

    let buyOrder = null;
    let sellOrder = null;

    try {
      // Leg 1: Buy
      console.log(`[OrderManager] ARB BUY  ${quantity} ${symbol} on ${buyExchange} @ ~${buyPrice}`);
      buyOrder = await buyAdapter.createMarketOrder(symbol, 'BUY', quantity);

      // Leg 2: Sell
      console.log(`[OrderManager] ARB SELL ${quantity} ${symbol} on ${sellExchange} @ ~${sellPrice}`);
      sellOrder = await sellAdapter.createMarketOrder(symbol, 'SELL', quantity);

      const result = { success: true, buyOrder, sellOrder, symbol, buyExchange, sellExchange, quantity, timestamp: Date.now() };
      await storageService.saveTrade({ id: `arb_${Date.now()}`, ...result, source: 'arbitrage_engine' });
      return result;

    } catch (err) {
      console.error('[OrderManager] Arbitrage execution failed:', err.message);

      // Rollback: if buy succeeded but sell failed, place stop-loss on buy position
      if (buyOrder && !sellOrder) {
        try {
          const stopPrice = buyPrice * 0.98; // -2% stop
          console.warn(`[OrderManager] Sell leg failed — placing stop-loss at ${stopPrice}`);
          await buyAdapter.createStopLoss(symbol, 'SELL', quantity, stopPrice * 0.995, stopPrice);
        } catch (rollbackErr) {
          console.error('[OrderManager] Rollback stop-loss also failed:', rollbackErr.message);
        }
      }

      return { success: false, error: err.message, buyOrder, sellOrder };
    }
  }

  /**
   * Execute a sniper buy with automatic stop-loss and sell timer.
   */
  async executeSniper({ exchange, symbol, quantity, stopLossPct = 0.10, sellAfterMs = 900000 }) {
    const adapter = this.adapters.get(exchange);
    if (!adapter) throw new Error(`Exchange not configured: ${exchange}`);

    console.log(`[OrderManager] SNIPER BUY ${quantity} ${symbol} on ${exchange}`);
    const buyOrder = await adapter.createMarketOrder(symbol, 'BUY', quantity);
    const entryPrice = buyOrder.price || buyOrder.fills?.[0]?.price;

    const orderId = `sniper_${Date.now()}`;
    this._activeOrders.set(orderId, { exchange, symbol, quantity, entryPrice, buyOrder });

    await storageService.saveTrade({
      id: orderId, exchange, symbol, side: 'BUY', quantity,
      price: entryPrice, timestamp: Date.now(), source: 'sniper_engine'
    });

    // Place stop-loss
    if (entryPrice) {
      const stopPrice = entryPrice * (1 - stopLossPct);
      try {
        await adapter.createStopLoss(symbol, 'SELL', quantity, stopPrice * 0.995, stopPrice);
        console.log(`[OrderManager] Stop-loss placed at ${stopPrice.toFixed(4)}`);
      } catch (e) {
        console.warn('[OrderManager] Could not place stop-loss:', e.message);
      }
    }

    // Schedule auto-sell
    setTimeout(async () => {
      if (!this._activeOrders.has(orderId)) return; // already closed
      try {
        console.log(`[OrderManager] SNIPER AUTO-SELL ${quantity} ${symbol} (timer elapsed)`);
        const sellOrder = await adapter.createMarketOrder(symbol, 'SELL', quantity);
        this._activeOrders.delete(orderId);
        await storageService.saveTrade({
          id: `${orderId}_sell`, exchange, symbol, side: 'SELL', quantity,
          price: sellOrder.price, timestamp: Date.now(), source: 'sniper_engine_auto_sell'
        });
      } catch (e) {
        console.error('[OrderManager] Auto-sell failed:', e.message);
      }
    }, sellAfterMs);

    return { success: true, orderId, buyOrder, stopLossPct, sellAfterMs };
  }

  /**
   * Poll order status until filled or timeout.
   */
  async waitForFill(exchange, symbol, orderId, timeoutMs = 30000) {
    const adapter = this.adapters.get(exchange);
    if (!adapter) throw new Error(`Exchange not configured: ${exchange}`);

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await adapter.getOrderStatus(symbol, orderId);
      if (status.status === 'FILLED') return { filled: true, status };
      if (['CANCELED', 'REJECTED', 'EXPIRED'].includes(status.status)) {
        return { filled: false, status };
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    return { filled: false, reason: 'timeout' };
  }

  closePosition(orderId) {
    this._activeOrders.delete(orderId);
  }
}

module.exports = { OrderManager };
