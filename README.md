<div align="center">
  <img src="assets/logo.png" alt="NeutronTrader Logo" width="500"/>
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
- Node.js v16 or higher ([Download](https://nodejs.org/))
- npm (comes with Node.js)

### Setup
```bash
# Clone the repository
git clone https://github.com/NubleX/NeutronTrader.git

# Navigate to the project directory
cd NeutronTrader

# Install dependencies
npm install
```

### Running the Application

#### Option 1: Single Command (Recommended)
```bash
npm run dev
```
This starts both the React dev server and Electron app automatically in one command.

#### Option 2: Manual Start (Two Terminals)
If you prefer to run the processes separately:

**Terminal 1 - Start React Dev Server:**
```bash
npm run react-start
```
Wait for the "Compiled successfully!" message.

**Terminal 2 - Start Electron App:**
```bash
npm run electron-start
```

The application will open in an Electron desktop window and load from `http://localhost:3000`.

### Building for Production
```bash
# Build React app
npm run build

# Build Electron executable
npm run electron-build
```

### Troubleshooting

#### Port 3000 Already in Use

**Windows:**
```powershell
# Find the process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace <PID> with the actual process ID shown)
taskkill /PID <PID> /F
```

**Mac/Linux:**
```bash
# Find and kill the process using port 3000
lsof -ti:3000 | xargs kill -9
```

#### Module Not Found Errors
```bash
# Clear cache and reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Electron Window Not Opening
- Make sure the React dev server compiled successfully (check Terminal 1)
- Verify nothing else is using port 3000
- Try closing all terminals and running `npm run dev` again

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
