<div align="center">
  <img src="assets/logo.png" alt="NeutronTrader Logo" width="200"/>
  <h1>NeutronTrader</h1>
  <p>A simple, user-friendly Binance trading bot built with Electron and React</p>

  [![GitHub release](https://img.shields.io/github/v/release/nublex/NeutronTrader?include_prereleases)](https://github.com/yourusername/NeutronTrader/releases)
  [![License](https://img.shields.io/github/license/nublex/NeutronTrader)](LICENSE)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
</div>

## About

NeutronTrader is a desktop application that allows users to connect to the Binance Testnet API to practice cryptocurrency trading strategies without risking real money. The application provides a clean interface for viewing account balances, price charts, and executing trades based on popular technical indicators.

![NeutronTrader Dashboard](assets/screenshot.png)

## Features

- **Binance Testnet Integration**: Connect securely to the Binance Testnet API for paper trading
- **Real-time Dashboard**: View your account balances and price charts
- **Multiple Trading Strategies**:
  - Simple Moving Average (SMA)
  - Relative Strength Index (RSI)
  - Bollinger Bands
- **Customizable Trading Parameters**:
  - Set trading pair
  - Define trade amount
  - Configure take profit and stop loss percentages
  - Set trading intervals
- **Trade History Tracking**: Monitor your executed trades and performance
- **Diagnostic Tools**: Troubleshoot API connectivity issues

## Installation

### Prerequisites
- Node.js 14+
- npm 6+

### Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/NeutronTrader.git

# Navigate to the project directory
cd NeutronTrader

# Install dependencies
npm install

# Start the application
npm start
```

## Usage

1. **Get Testnet API Keys**:
   - Register at [Binance Testnet](https://testnet.binance.vision/)
   - Generate API keys with "TRADE, USER_DATA, USER_STREAM" permissions

2. **Connect to Testnet**:
   - Enter your API keys in the application
   - Dashboard will show your account balances and price chart

3. **Configure Trading Bot**:
   - Go to the Setup tab
   - Select trading pair (e.g., BNB/USDT)
   - Choose strategy
   - Set trade amount and parameters
   - Start the bot

4. **Monitor Trades**:
   - View executed trades in the History tab
   - Check performance metrics
   - Analyze trade patterns

## Architecture

NeutronTrader uses Electron's main process to make API calls to Binance, avoiding CORS restrictions that would affect browser-based applications. The React UI communicates with the main process via IPC (Inter-Process Communication).

- **Main Process**: Handles Binance API calls securely
- **Renderer Process**: React-based UI for user interaction
- **IPC Bridge**: Secure communication between processes

## Contributing

We welcome contributions from developers of all skill levels! Check out our [CONTRIBUTING.md](CONTRIBUTING.md) guide to get started.

**Good First Issues**: Looking to make your first contribution? Check issues labeled with [`good first issue`](https://github.com/yourusername/NeutronTrader/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) - these are specifically designed for new contributors.

See our [roadmap](ROADMAP.md) for planned features and improvements.

## Security

NeutronTrader currently connects only to the Binance Testnet, which uses test tokens with no real value. The application handles API keys securely, storing them only in the local environment.

**⚠️ Warning**: This is an alpha release intended for testing and educational purposes. Do not use with real funds or API keys from the main Binance network.

## Acknowledgements

- [Binance](https://www.binance.com/) for providing the Testnet API
- [Electron](https://www.electronjs.org/) for the desktop application framework
- [React](https://reactjs.org/) for the UI components
- [Recharts](https://recharts.org/) for the charting library
