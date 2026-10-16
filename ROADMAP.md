# NeutronTrader Roadmap

## v0.4.1 ← current

What shipped in this release:

- [x] **MACD strategy** — signal/histogram crossover with configurable fast/slow/signal periods
- [x] **Strategy Composer UI** — combine RSI, SMA, Bollinger Bands, MACD with AND/OR/MAJORITY logic
- [x] **Backtesting engine** — replay historical candles with equity curve and metrics
- [x] **Portfolio view** — aggregate CEX balances + BSC wallet via pasted EVM address
- [x] **Persistent arbitrage history** — filter and replay opportunities with P&L attribution
- [x] **WebSocket price feed** — REST/WS toggle on Dashboard (Binance, Bybit streams)
- [x] **Notification system** — desktop alerts for arb, listings, bot signals (respects PAUSE)
- [x] **Sniper improvements** — multi-exchange filter, dry-run mode, per-listing limits
- [x] **Mainnet/Testnet toggle** — Binance mode switch on Exchanges tab
- [x] **Neutron Terminal UX** — live push updates, gross/net spread cards, MIN NET% threshold
- [x] **Composer guardrails** — validation limits and educational tooltips
- [x] **Bybit mainnet fix** — price feed uses live API by default (was testnet)
- [x] **Production build pipeline** — AppImage + .deb via electron-builder

---

## v0.3.1

- [x] Multi-exchange support (Binance, Coinbase, Kraken, OKX, Bybit)
- [x] Cross-exchange arbitrage engine
- [x] Listing sniper
- [x] DeFi wallet manager (Ethereum, Arbitrum, Polygon, BSC)
- [x] Encrypted key vault, risk manager, RSI/Bollinger strategies
- [x] Staggered price feed aggregator

---

## v0.5.0

- [ ] **TradingView chart integration** — full TradingView widget on Dashboard
- [ ] **Multi-pair bot** — run scheduled bot on multiple pairs with shared risk budget
- [ ] **DeFi arbitrage** — CEX spot vs DEX pool price deltas
- [ ] **Custom strategy JSON** — define strategy logic as JSON rules, no code changes
- [ ] **Performance reporting** — per-strategy win rate, Sharpe, max drawdown charts

---

## v1.0.0

- [ ] **Mainnet trading with safety rails** — graduated unlock requiring testnet history
- [ ] **Full audit of key vault and encryption layer**
- [ ] **Strategy marketplace / import**
- [ ] **Complete documentation and user guide**
- [ ] **Automated test suite**

---

## Beyond v1.0

- [ ] Additional exchange adapters (Bitfinex, HTX, Gate.io, dYdX)
- [ ] On-chain analytics dashboard
- [ ] Machine learning signal layer
- [ ] Mobile companion app for monitoring and alerts

---

## Contributing

Check [open issues](https://github.com/NubleX/NeutronTrader/issues) or pick anything from the roadmap above. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started.
