// NeutronTrader - Web3 wallet connect button with inline modal (Electron-safe)

import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';

function formatAddress(addr) {
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
}

export default function WalletButton({ onAccountChange }) {
  const { account, isConnecting, error, connect, disconnect } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [localError, setLocalError] = useState('');

  const handleClick = () => {
    if (account) {
      disconnect();
      onAccountChange?.(null);
      return;
    }
    setAddressInput('');
    setLocalError('');
    setShowModal(true);
  };

  const handleConnect = async () => {
    setLocalError('');
    const { addr, error: connectError } = await connect(addressInput.trim() || undefined);
    if (addr) {
      setShowModal(false);
      onAccountChange?.(addr);
    } else {
      setLocalError(connectError || 'Connection failed');
    }
  };

  const displayError = localError || error;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isConnecting}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px', borderRadius: '20px',
          border: account ? '1px solid rgba(200,140,255,0.55)' : '1px solid rgba(140,90,210,0.4)',
          background: 'rgba(140,90,210,0.12)',
          color: account ? 'rgba(220,170,255,0.95)' : 'rgba(180,120,255,0.8)',
          cursor: isConnecting ? 'not-allowed' : 'pointer',
          fontSize: '13px', opacity: isConnecting ? 0.5 : 1,
        }}
        title={account ? `Connected: ${account}\nClick to disconnect` : 'Connect BSC/EVM wallet'}
      >
        <span style={{ fontSize: '16px' }}>◆</span>
        {account ? formatAddress(account) : isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="card"
            style={{ padding: '24px', width: '400px', maxWidth: '90vw' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Connect BSC Wallet</h3>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
              Paste your EVM wallet address to load BNB and BEP-20 balances. Keys stay on-chain — we only read public balances.
            </p>
            <div className="form-group">
              <label>Wallet address</label>
              <input
                type="text"
                placeholder="0x..."
                value={addressInput}
                onChange={e => setAddressInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
                autoFocus
              />
            </div>
            {displayError && (
              <div style={{ color: '#f44336', fontSize: '12px', marginBottom: '12px' }}>{displayError}</div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowModal(false)} style={{ cursor: 'pointer' }}>Cancel</button>
              <button type="button" className="primary-btn" onClick={handleConnect} disabled={isConnecting}>
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
