# NeutronTrader Roadmap

## v0.3.0-alpha ← current

What shipped in this release:

- [x] **Multi-exchange support** — Binance, Coinbase, Kraken, OKX, Bybit via unified adapter interface
- [x] **Cross-exchange arbitrage engine** — real-time spread detection, net profit calculation after fees, automated execution via OrderManager
- [x] **Listing sniper** — monitors exchange API symbol lists (30s) and Binance announcements (60s) for new token listings; fires snipe orders on detection
- [x] **DeFi wallet manager** — create/import wallets for Ethereum, Arbitrum, Polygon, BSC; on-chain balance queries
- [x] **Uniswap V3 + PancakeSwap integration** — pool price queries and swaps via ethers.js (lazy-loaded to avoid memory overhead)
- [x] **Encrypted key vault** — AES-256-GCM per-exchange credential storage; keys never leave main process
- [x] **Risk manager** — circuit breaker (daily drawdown limit), per-trade position sizing, manual reset
- [x] **RSI and Bollinger Bands strategies** — fully implemented alongside existing SMA
- [x] **Staggered price feed aggregator** — 5 exchanges, 10s stagger, 60s poll cycle; bounded memory
- [x] **Production build pipeline** — AppImage + .deb via electron-builder
- [x] **Memory fixes** — lazy DeFi loading, backup throttle, trades cap, listener leak fixes

---

## v0.4.0

- [ ] **Backtesting engine** — run strategies against historical OHLCV data before going live
- [ ] **MACD strategy** — signal/histogram crossover with configurable fast/slow/signal periods
- [ ] **Strategy composer UI** — configure and combine strategies without touching code
- [ ] **Portfolio view** — aggregate balances across all configured exchanges in one panel
- [ ] **Persistent arbitrage history** — store and replay detected opportunities with P&L attribution
- [ ] **WebSocket price feed** — replace HTTP polling with WS streams (Binance, Bybit) for lower latency
- [ ] **Sniper improvements** — configurable exchange filter, per-listing entry limits, dry-run mode
- [ ] **Notification system** — desktop notifications for arb opportunities, listing alerts, bot signals

---

## v0.5.0

- [ ] **TradingView chart integration** — replace basic charts with full TradingView widget
- [ ] **Multi-pair bot** — run the scheduled bot on multiple pairs simultaneously with shared risk budget
- [ ] **DeFi arbitrage** — detect price deltas between CEX spot and DEX pool prices; execute cross-venue
- [ ] **Custom strategy JSON** — define strategy logic as a JSON rule set, no code changes required
- [ ] **Performance reporting** — per-strategy win rate, Sharpe ratio, max drawdown, daily P&L charts

---

## v1.0.0

- [ ] **Mainnet trading with safety rails** — graduated unlock requiring confirmed testnet history
- [ ] **Full audit of key vault and encryption layer** before mainnet release
- [ ] **Strategy marketplace / import** — share and import community strategy configs
- [ ] **Complete documentation and user guide**
- [ ] **Automated test suite** — unit tests for strategy logic, integration tests for exchange adapters

---

## Beyond v1.0

- [ ] Additional exchange adapters (Bitfinex, HTX, Gate.io, dYdX)
- [ ] On-chain analytics dashboard (gas tracker, MEV monitoring)
- [ ] Machine learning signal layer — LSTM price prediction as an optional strategy overlay
- [ ] Mobile companion app for monitoring and alerts
- [ ] Social / copy trading — share bot configs and track community performance

---

## Contributing

Check [open issues](https://github.com/NubleX/NeutronTrader/issues) or pick anything from the roadmap above. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started.
