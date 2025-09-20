// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import { useState } from 'react';
import { runAllTests, testAuthentication, testConnectivity } from '../services/binanceDiagnostic';

function DiagnosticTest({ apiConfig }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const addResult = (message, isError = false) => {
    const time = new Date().toLocaleTimeString();
    setResults(prev => [...prev, { time, message, isError }]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const handleConnectivityTest = async () => {
    setLoading(true);
    clearResults();
    addResult("Starting connectivity tests...");

    try {
      const testResults = await testConnectivity();

      testResults.forEach(result => {
        if (result.success) {
          addResult(`✓ ${result.test}: ${result.message}`, false);
        } else {
          addResult(`✗ ${result.test}: ${result.error}`, true);
        }
      });

      addResult("Connectivity tests completed.", false);
    } catch (error) {
      addResult(`Fatal error during connectivity tests: ${error.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthTest = async () => {
    if (!apiConfig || !apiConfig.apiKey || !apiConfig.apiSecret) {
      addResult("Cannot test authentication: API keys not configured", true);
      return;
    }

    setLoading(true);
    addResult("Starting authentication tests...");

    try {
      const testResults = await testAuthentication(apiConfig);

      testResults.forEach(result => {
        if (result.success) {
          addResult(`✓ ${result.test}: ${result.message}`, false);
        } else {
          addResult(`✗ ${result.test}: ${result.error}`, true);
        }
      });

      addResult("Authentication tests completed.", false);
    } catch (error) {
      addResult(`Fatal error during authentication tests: ${error.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  const handleFullTest = async () => {
    setLoading(true);
    clearResults();
    addResult("Starting comprehensive diagnostic tests...");

    try {
      const testResults = await runAllTests(apiConfig);

      testResults.forEach(result => {
        if (result.success) {
          addResult(`✓ ${result.test}: ${result.message}`, false);
        } else {
          addResult(`✗ ${result.test}: ${result.error}`, true);
        }
      });

      const successCount = testResults.filter(r => r.success).length;
      const totalCount = testResults.length;

      addResult(`All tests completed. ${successCount}/${totalCount} tests passed.`, successCount < totalCount);
    } catch (error) {
      addResult(`Fatal error during comprehensive tests: ${error.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="diagnostic-test">
      <div className="diagnostic-header">
        <h2>API Diagnostic Tests</h2>
        <p className="diagnostic-description">
          Test your connection to Binance Testnet API through Electron's main process (bypasses CORS).
        </p>
      </div>

      <div className="test-controls">
        <div className="button-group">
          <button
            className="btn btn-secondary"
            onClick={handleConnectivityTest}
            disabled={loading}
          >
            Test Connectivity
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleAuthTest}
            disabled={loading || !apiConfig?.apiKey}
          >
            Test Authentication
          </button>

          <button
            className="btn btn-primary"
            onClick={handleFullTest}
            disabled={loading}
          >
            Run All Tests
          </button>

          <button
            className="btn btn-outline"
            onClick={clearResults}
            disabled={loading || results.length === 0}
          >
            Clear Results
          </button>
        </div>
      </div>

      <div className="api-status-section">
        <h3>API Configuration Status</h3>
        {apiConfig && apiConfig.isConfigured ? (
          <div className="api-status success">
            <div className="api-status-icon">✓</div>
            <div className="api-status-message">
              API configured with key: {apiConfig.apiKey.substring(0, 4)}...{apiConfig.apiKey.substring(apiConfig.apiKey.length - 4)}
            </div>
          </div>
        ) : (
          <div className="api-status warning">
            <div className="api-status-icon">⚠️</div>
            <div className="api-status-message">
              API not configured. Please enter your API keys in the Setup tab.
            </div>
          </div>
        )}
      </div>

      <div className="test-results">
        <h3>Test Results</h3>

        {loading && (
          <div className="loading-spinner small">
            <div className="spinner"></div>
            <div className="loading-message">Running tests...</div>
          </div>
        )}

        {results.length === 0 ? (
          <div className="no-results">No tests run yet. Click a test button above to start.</div>
        ) : (
          <div className="results-list">
            {results.map((result, index) => (
              <div
                key={index}
                className={`result-item ${result.isError ? 'error' : 'success'}`}
              >
                <span className="result-time">[{result.time}]</span>
                <span className="result-message">{result.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="architecture-info">
        <h3>NeutronTrader Architecture</h3>
        <div className="architecture-description">
          <p>
            <strong>CORS Solution:</strong> NeutronTrader uses Electron's main process to handle all Binance API calls,
            completely bypassing browser CORS restrictions. The React UI communicates with the main process via IPC.
          </p>
          <div className="architecture-flow">
            <div className="flow-step">
              <span className="step-number">1</span>
              <span className="step-text">React UI (Renderer Process)</span>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <span className="step-number">2</span>
              <span className="step-text">IPC Communication</span>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <span className="step-number">3</span>
              <span className="step-text">Main Process (Node.js)</span>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <span className="step-number">4</span>
              <span className="step-text">Binance API</span>
            </div>
          </div>
        </div>
      </div>

      <div className="troubleshooting-tips">
        <h3>Troubleshooting Tips</h3>
        <ul>
          <li><strong>CORS Errors:</strong> These are expected when running in browser mode. Use Electron to bypass CORS.</li>
          <li><strong>API Key Issues:</strong> Ensure your Binance Testnet API keys have correct permissions (TRADE, USER_DATA, USER_STREAM).</li>
          <li><strong>Network Issues:</strong> Check your internet connection and firewall settings.</li>
          <li><strong>Electron IPC:</strong> Make sure the application is running in Electron, not just a web browser.</li>
          <li><strong>Debug Mode:</strong> Open Developer Tools (Ctrl/Cmd+Shift+I) to see detailed logs.</li>
        </ul>
      </div>
    </div>
  );
}

export default DiagnosticTest;