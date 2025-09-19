// NeutronTrader - a simple, user-friendly Binance trading bot.
// Copyright (C) 2025  Igor Dunaev (NubleX)

import { useState } from 'react';
import { testConnectivity, testSignedRequest, testSimpleRequest } from '../services/binanceDiagnostic';

function DiagnosticTest({ apiConfig }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message, isError = false) => {
    setResults(prev => [...prev, { message, isError, time: new Date().toLocaleTimeString() }]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const runConnectivityTest = async () => {
    setLoading(true);
    addResult("Starting connectivity tests...");

    try {
      await testConnectivity();
      addResult("Connectivity tests completed. Check browser console for details.");
    } catch (error) {
      addResult(`Connectivity test error: ${error.message}`, true);
    }

    setLoading(false);
  };

  const runSignedTest = async () => {
    setLoading(true);
    addResult("Starting signed request test...");

    if (!apiConfig.isConfigured) {
      addResult("Cannot test: API not configured", true);
      setLoading(false);
      return;
    }

    try {
      await testSignedRequest(apiConfig);
      addResult("Signed request test completed. Check browser console for details.");
    } catch (error) {
      addResult(`Signed request test error: ${error.message}`, true);
    }

    setLoading(false);
  };

  const runSimpleTest = async () => {
    setLoading(true);
    addResult("Testing simple requests to various APIs...");

    try {
      await testSimpleRequest();
      addResult("Simple request tests completed. Check browser console for details.");
    } catch (error) {
      addResult(`Simple request test error: ${error.message}`, true);
    }

    setLoading(false);
  };

  return (
    <div className="diagnostic-test">
      <h2>API Diagnostic Tests</h2>

      <div className="test-controls">
        <div className="test-buttons">
          <button
            onClick={runConnectivityTest}
            disabled={loading}
            className="test-button"
          >
            Test Basic Connectivity
          </button>

          <button
            onClick={runSignedTest}
            disabled={loading || !apiConfig.isConfigured}
            className="test-button"
          >
            Test Signed Request
          </button>

          <button
            onClick={runSimpleTest}
            disabled={loading}
            className="test-button"
          >
            Test Alternative APIs
          </button>

          <button
            onClick={clearResults}
            disabled={loading}
            className="clear-button"
          >
            Clear Results
          </button>
        </div>

        {apiConfig.isConfigured ? (
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
              API not configured. Please enter your API keys.
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
          <div className="no-results">No tests run yet</div>
        ) : (
          <div className="results-list">
            {results.map((result, index) => (
              <div
                key={index}
                className={`result-item ${result.isError ? 'error' : ''}`}
              >
                <span className="result-time">[{result.time}]</span>
                <span className="result-message">{result.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="important-note">
        <h3>Troubleshooting Tips</h3>
        <ul>
          <li>Check browser console (F12) for detailed test results</li>
          <li>CORS errors might prevent browser-based API access</li>
          <li>If the "Test Alternative APIs" succeeds but Binance fails, it's likely a CORS restriction</li>
          <li>In that case, consider using Electron's main process to make API calls</li>
        </ul>
      </div>
    </div>
  );
}

export default DiagnosticTest;