# NeutronTrader

A simple cryptocurrency trading bot for Binance using Electron and React.

## Features

- Connect to Binance API
- Real-time price monitoring
- Multiple trading strategies
- Trade history tracking
- Customizable trading parameters

## Installation

```bash
# Clone the repository
git clone https://github.com/NubleX/NeutronTrader.git
cd NeutronTrader

# Install dependencies
npm install
```

## Running the Application

```bash
# Development mode
npm start

# Build for production
npm run build
npm run electron-build
```

## Configuration

1. Create a Binance API key with trading permissions
2. Enter your API key and secret in the application
3. Choose a trading pair and strategy
4. Set your trading parameters
5. Start the bot

## Troubleshooting

If you encounter issues with Webpack 5 and Node.js polyfills:

1. Ensure you've installed all required polyfill packages:
```bash
npm install --save react-app-rewired crypto-browserify stream-browserify assert stream-http https-browserify url buffer process
```

2. Check that your `config-overrides.js` file is in the root directory.

## Security Notice

This application is for educational purposes. When using with real funds:

- Use API keys with appropriate permissions
- Start with small trade amounts
- Monitor the bot's performance regularly
- Never expose your API secret