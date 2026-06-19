// NeutronTrader - Backtest IPC service wrapper

const isElectronAvailable = () =>
  typeof window !== 'undefined' && window.electronAPI;

export async function runBacktest(config) {
  if (!isElectronAvailable()) return { success: false, error: 'Not in Electron' };
  return window.electronAPI.backtest.run(config);
}

export function onBacktestProgress(callback) {
  if (!isElectronAvailable()) return () => {};
  return window.electronAPI.backtest.onProgress(callback);
}
