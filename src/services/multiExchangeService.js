// NeutronTrader - Multi-exchange IPC service wrapper
// src/services/multiExchangeService.js

const isElectronAvailable = () =>
  typeof window !== 'undefined' && window.electronAPI;

export async function configureExchange(exchange, config) {
  if (!isElectronAvailable()) return { success: false, error: 'Not in Electron' };
  return window.electronAPI.exchange.configure(exchange, config);
}

export async function listExchanges() {
  if (!isElectronAvailable()) return { exchanges: [] };
  return window.electronAPI.exchange.list();
}

export async function pingExchange(exchange) {
  if (!isElectronAvailable()) return { success: false };
  return window.electronAPI.exchange.ping(exchange);
}

export async function getExchangePrice(exchange, symbol) {
  if (!isElectronAvailable()) return null;
  return window.electronAPI.exchange.getPrice(exchange, symbol);
}

export async function getExchangeOrderBook(exchange, symbol, limit = 10) {
  if (!isElectronAvailable()) return null;
  return window.electronAPI.exchange.getOrderBook(exchange, symbol, limit);
}

export async function getExchangeAccount(exchange) {
  if (!isElectronAvailable()) return null;
  return window.electronAPI.exchange.getAccount(exchange);
}

export async function getExchangeSymbols(exchange) {
  if (!isElectronAvailable()) return [];
  return window.electronAPI.exchange.getSymbols(exchange);
}

export function onArbitrageOpportunity(callback) {
  if (!isElectronAvailable()) return () => {};
  return window.electronAPI.exchange.onOpportunity(callback);
}
