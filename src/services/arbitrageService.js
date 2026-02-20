// NeutronTrader - Arbitrage engine IPC service wrapper
// src/services/arbitrageService.js

const isElectronAvailable = () =>
  typeof window !== 'undefined' && window.electronAPI;

export async function startArbitrage(config) {
  if (!isElectronAvailable()) return { success: false, error: 'Not in Electron' };
  return window.electronAPI.arbitrage.start(config);
}

export async function stopArbitrage() {
  if (!isElectronAvailable()) return { success: false };
  return window.electronAPI.arbitrage.stop();
}

export async function getArbitrageHistory() {
  if (!isElectronAvailable()) return [];
  return window.electronAPI.arbitrage.getHistory();
}

export async function startPriceFeed(symbols, options) {
  if (!isElectronAvailable()) return { success: false };
  return window.electronAPI.priceFeed.start(symbols, options);
}

export async function stopPriceFeed() {
  if (!isElectronAvailable()) return;
  return window.electronAPI.priceFeed.stop();
}

export async function getPriceFeedSnapshot() {
  if (!isElectronAvailable()) return {};
  return window.electronAPI.priceFeed.getSnapshot();
}

export function onArbitrageExecuted(callback) {
  if (!isElectronAvailable()) return () => {};
  return window.electronAPI.arbitrage.onExecuted(callback);
}

export async function getRiskStatus() {
  if (!isElectronAvailable()) return null;
  return window.electronAPI.risk.getStatus();
}

export async function resetCircuitBreaker() {
  if (!isElectronAvailable()) return;
  return window.electronAPI.risk.resetCircuitBreaker();
}

export async function updateRiskConfig(config) {
  if (!isElectronAvailable()) return;
  return window.electronAPI.risk.updateConfig(config);
}
