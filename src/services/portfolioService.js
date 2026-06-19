// NeutronTrader - Portfolio IPC service wrapper

const isElectronAvailable = () =>
  typeof window !== 'undefined' && window.electronAPI;

export async function getPortfolioSnapshot() {
  if (!isElectronAvailable()) return null;
  const result = await window.electronAPI.portfolio.getSnapshot();
  return result?.data || null;
}

export async function getBscBalances(address) {
  if (!isElectronAvailable()) return null;
  const result = await window.electronAPI.portfolio.getBscBalances(address);
  return result?.data || null;
}
