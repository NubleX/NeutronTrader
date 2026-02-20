// NeutronTrader - DeFi wallet manager
// Private keys are stored encrypted via keyVault. Renderer only sees addresses.

const { ethers } = require('ethers');
const { keyVault } = require('../security/keyVault');
const { chainManager } = require('./chainManager');

class WalletManager {
  constructor() {
    // In-memory wallet instances keyed by "chain:address"
    this._wallets = new Map();
    // Per-chain nonce trackers to prevent collisions
    this._nonces = new Map();
  }

  /**
   * Create a new random wallet for a chain.
   * Returns the address (private key stored in vault only).
   */
  async createWallet(chain) {
    const wallet = ethers.Wallet.createRandom();
    await keyVault.storeWalletKey(chain, wallet.address, wallet.privateKey);
    await this._loadWallet(chain, wallet.address, wallet.privateKey);
    console.log(`[WalletManager] Created wallet on ${chain}: ${wallet.address}`);
    return { address: wallet.address, mnemonic: wallet.mnemonic?.phrase };
  }

  /**
   * Import an existing wallet by private key.
   * Returns the address.
   */
  async importWallet(chain, privateKey) {
    const wallet = new ethers.Wallet(privateKey);
    await keyVault.storeWalletKey(chain, wallet.address, privateKey);
    await this._loadWallet(chain, wallet.address, privateKey);
    console.log(`[WalletManager] Imported wallet on ${chain}: ${wallet.address}`);
    return { address: wallet.address };
  }

  /**
   * Load a wallet from vault and connect it to the chain provider.
   */
  async _loadWallet(chain, address, privateKey) {
    const provider = await chainManager.getProvider(chain);
    const wallet = new ethers.Wallet(privateKey, provider);
    this._wallets.set(`${chain}:${address}`, wallet);
    return wallet;
  }

  /**
   * Get an in-memory wallet (loading from vault if needed).
   */
  async getWallet(chain, address) {
    const key = `${chain}:${address}`;
    if (this._wallets.has(key)) return this._wallets.get(key);

    const pk = await keyVault.getWalletKey(chain, address);
    if (!pk) throw new Error(`Wallet not found: ${chain}:${address}`);
    return this._loadWallet(chain, address, pk);
  }

  /**
   * List all stored wallet addresses (from vault settings keys).
   */
  async listWallets() {
    // We stored them with prefix "vault_secret_wallet_<chain>_<address>"
    // We can enumerate by checking known chain names
    const chains = chainManager.getSupportedChains();
    const result = [];
    for (const chain of chains) {
      // We can't enumerate vault keys directly without scanning storage,
      // so return the in-memory set (wallets loaded this session)
      for (const key of this._wallets.keys()) {
        const [c, ...addrParts] = key.split(':');
        if (c === chain) result.push({ chain, address: addrParts.join(':') });
      }
    }
    return result;
  }

  /**
   * Get native balance for a wallet address on a chain.
   */
  async getBalance(chain, address) {
    return chainManager.getNativeBalance(chain, address);
  }

  /**
   * Get managed nonce (prevents collisions when sending multiple txs quickly).
   */
  async getNonce(chain, address) {
    const wallet = await this.getWallet(chain, address);
    const onChainNonce = await wallet.provider.getTransactionCount(address, 'pending');
    const localKey = `${chain}:${address}`;
    const localNonce = this._nonces.get(localKey) || 0;
    const nonce = Math.max(onChainNonce, localNonce);
    this._nonces.set(localKey, nonce + 1);
    return nonce;
  }

  /**
   * Reset nonce tracking (call after a tx is confirmed or failed).
   */
  resetNonce(chain, address) {
    this._nonces.delete(`${chain}:${address}`);
  }
}

const walletManager = new WalletManager();
module.exports = { walletManager };
