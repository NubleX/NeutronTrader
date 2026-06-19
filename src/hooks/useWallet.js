// NeutronTrader - Web3 wallet hook (address-based for Electron; MetaMask if injected)

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'neutron_wallet_address';

function isValidAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isValidAddress(saved)) setAccount(saved);
  }, []);

  const connect = useCallback(async (addressOverride) => {
    setIsConnecting(true);
    setError(null);
    try {
      if (!addressOverride && typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const addr = accounts?.[0];
        if (addr && isValidAddress(addr)) {
          setAccount(addr);
          localStorage.setItem(STORAGE_KEY, addr);
          const cid = await window.ethereum.request({ method: 'eth_chainId' });
          setChainId(parseInt(cid, 16));
          return { addr, error: null };
        }
      }

      const addr = (addressOverride || '').trim();
      if (!addr) {
        const msg = 'Enter a wallet address';
        setError(msg);
        return { addr: null, error: msg };
      }
      if (!isValidAddress(addr)) {
        const msg = 'Invalid address — use 0x followed by 40 hex characters';
        setError(msg);
        return { addr: null, error: msg };
      }
      setAccount(addr);
      localStorage.setItem(STORAGE_KEY, addr);
      setChainId(56);
      return { addr, error: null };
    } catch (e) {
      const msg = e.message || 'Connection failed';
      setError(msg);
      return { addr: null, error: msg };
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { account, chainId, isConnecting, error, connect, disconnect };
}
