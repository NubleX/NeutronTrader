// NeutronTrader - Sniper engine IPC service wrapper
// src/services/sniperService.js

const isElectronAvailable = () =>
  typeof window !== 'undefined' && window.electronAPI;

export async function startSniper(config) {
  if (!isElectronAvailable()) return { success: false, error: 'Not in Electron' };
  return window.electronAPI.sniper.start(config);
}

export async function stopSniper() {
  if (!isElectronAvailable()) return { success: false };
  return window.electronAPI.sniper.stop();
}

export async function getSniperHistory() {
  if (!isElectronAvailable()) return [];
  return window.electronAPI.sniper.getHistory();
}

export async function updateSniperConfig(config) {
  if (!isElectronAvailable()) return;
  return window.electronAPI.sniper.updateConfig(config);
}

export async function startListingDetector(config) {
  if (!isElectronAvailable()) return { success: false };
  return window.electronAPI.listing.start(config);
}

export async function stopListingDetector() {
  if (!isElectronAvailable()) return;
  return window.electronAPI.listing.stop();
}

export function onSniperAlert(callback) {
  if (!isElectronAvailable()) return () => {};
  return window.electronAPI.sniper.onAlert(callback);
}

export function onNewListing(callback) {
  if (!isElectronAvailable()) return () => {};
  return window.electronAPI.listing.onNewListing(callback);
}
