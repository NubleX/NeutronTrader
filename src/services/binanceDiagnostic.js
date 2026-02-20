// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

// Helper to check if Electron API is available
const isElectronAvailable = () => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
};

/**
 * Test connectivity using Electron main process instead of direct fetch
 */
export async function testConnectivity() {
  console.log("--- Testing Binance Testnet Connectivity via Electron IPC ---");

  const results = [];

  try {
    if (!isElectronAvailable()) {
      const error = "Electron API not available. Running in browser mode with CORS limitations.";
      console.error(error);
      results.push({
        test: "Electron API Check",
        success: false,
        error: error,
        time: new Date().toLocaleTimeString()
      });
      return results;
    }

    console.log("✓ Electron API available");
    results.push({
      test: "Electron API Check",
      success: true,
      message: "Electron API is available",
      time: new Date().toLocaleTimeString()
    });

    // 1. Test basic ping through Electron main process
    console.log("1. Testing ping via Electron main process...");
    try {
      const pingResult = await window.electronAPI.binance.ping();
      if (pingResult.success) {
        console.log("✓ Ping successful via Electron main process");
        results.push({
          test: "Ping Test",
          success: true,
          message: "Ping successful via Electron main process",
          time: new Date().toLocaleTimeString()
        });
      } else {
        throw new Error(pingResult.error || "Ping failed");
      }
    } catch (err) {
      console.error("✗ Ping failed:", err.message);
      results.push({
        test: "Ping Test",
        success: false,
        error: err.message,
        time: new Date().toLocaleTimeString()
      });
    }

    // 2. Test getting market data (no auth required)
    console.log("2. Testing market data retrieval...");
    try {
      const pricesResult = await window.electronAPI.binance.getPrices('BNBUSDT');
      if (pricesResult.success && pricesResult.data) {
        console.log("✓ Market data retrieved successfully");
        console.log("Current BNB/USDT price:", pricesResult.data.price || pricesResult.data);
        results.push({
          test: "Market Data Test",
          success: true,
          message: `Market data retrieved. BNB/USDT price: ${pricesResult.data.price || pricesResult.data}`,
          time: new Date().toLocaleTimeString()
        });
      } else {
        throw new Error(pricesResult.error || "Failed to get market data");
      }
    } catch (err) {
      console.error("✗ Market data test failed:", err.message);
      results.push({
        test: "Market Data Test",
        success: false,
        error: err.message,
        time: new Date().toLocaleTimeString()
      });
    }

    // 3. Test candle data
    console.log("3. Testing candle data retrieval...");
    try {
      const candlesResult = await window.electronAPI.binance.getCandles('BNBUSDT', '1h', { limit: 5 });
      if (candlesResult.success && candlesResult.data && candlesResult.data.length > 0) {
        console.log("✓ Candle data retrieved successfully");
        console.log(`Retrieved ${candlesResult.data.length} candles`);
        results.push({
          test: "Candle Data Test",
          success: true,
          message: `Retrieved ${candlesResult.data.length} candles for BNB/USDT`,
          time: new Date().toLocaleTimeString()
        });
      } else {
        throw new Error(candlesResult.error || "Failed to get candle data");
      }
    } catch (err) {
      console.error("✗ Candle data test failed:", err.message);
      results.push({
        test: "Candle Data Test",
        success: false,
        error: err.message,
        time: new Date().toLocaleTimeString()
      });
    }

    return results;

  } catch (error) {
    console.error("Fatal error in connectivity test:", error);
    results.push({
      test: "General Connectivity",
      success: false,
      error: error.message,
      time: new Date().toLocaleTimeString()
    });
    return results;
  }
}

/**
 * Test authenticated endpoints (requires API keys)
 */
export async function testAuthentication(apiConfig) {
  console.log("--- Testing Authenticated Binance API Access ---");

  const results = [];

  try {
    if (!isElectronAvailable()) {
      const error = "Electron API not available. Cannot test authentication.";
      console.error(error);
      results.push({
        test: "Authentication Check",
        success: false,
        error: error,
        time: new Date().toLocaleTimeString()
      });
      return results;
    }

    if (!apiConfig || !apiConfig.apiKey || !apiConfig.apiSecret) {
      const error = "API configuration missing. Please provide API key and secret.";
      console.error(error);
      results.push({
        test: "API Config Check",
        success: false,
        error: error,
        time: new Date().toLocaleTimeString()
      });
      return results;
    }

    console.log("✓ API configuration provided");
    results.push({
      test: "API Config Check",
      success: true,
      message: `API Key: ${apiConfig.apiKey.substring(0, 4)}...${apiConfig.apiKey.substring(apiConfig.apiKey.length - 4)}`,
      time: new Date().toLocaleTimeString()
    });

    // Test account info
    console.log("1. Testing account info retrieval...");
    try {
      const accountResult = await window.electronAPI.binance.getAccountInfo(apiConfig);
      if (accountResult.success && accountResult.data) {
        console.log("✓ Account info retrieved successfully");
        console.log("Account type:", accountResult.data.accountType);
        console.log("Can trade:", accountResult.data.canTrade);
        results.push({
          test: "Account Info Test",
          success: true,
          message: `Account type: ${accountResult.data.accountType}, Can trade: ${accountResult.data.canTrade}`,
          time: new Date().toLocaleTimeString()
        });
      } else {
        throw new Error(accountResult.error || "Failed to get account info");
      }
    } catch (err) {
      console.error("✗ Account info test failed:", err.message);
      results.push({
        test: "Account Info Test",
        success: false,
        error: err.message,
        time: new Date().toLocaleTimeString()
      });
    }

    return results;

  } catch (error) {
    console.error("Fatal error in authentication test:", error);
    results.push({
      test: "Authentication",
      success: false,
      error: error.message,
      time: new Date().toLocaleTimeString()
    });
    return results;
  }
}

/**
 * Run all diagnostic tests
 */
export async function runAllTests(apiConfig = null) {
  console.log("=== Starting NeutronTrader Diagnostic Tests ===");

  const allResults = [];

  // Run connectivity tests first
  const connectivityResults = await testConnectivity();
  allResults.push(...connectivityResults);

  // If we have API config, run authentication tests
  if (apiConfig && apiConfig.apiKey && apiConfig.apiSecret) {
    const authResults = await testAuthentication(apiConfig);
    allResults.push(...authResults);
  }

  console.log("=== Diagnostic Tests Complete ===");
  console.log("Summary:", allResults);

  return allResults;
}