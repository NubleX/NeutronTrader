// NeutronTrader - Key vault using Electron safeStorage + AES-256-GCM
// Stores encrypted API keys and DeFi private keys.

const { safeStorage } = require('electron');
const { storageService } = require('../storageService');
const { encrypt, decrypt } = require('./encryption');

// Fallback password when safeStorage is unavailable (dev only)
const FALLBACK_KEY = 'neutrontrader-dev-key-insecure';

class KeyVault {
  constructor() {
    this._masterKey = null;
  }

  /**
   * Returns the master key — from safeStorage if available, else fallback.
   * safeStorage uses OS keychain (macOS), DPAPI (Windows), libsecret (Linux).
   */
  async getMasterKey() {
    if (this._masterKey) return this._masterKey;

    if (safeStorage.isEncryptionAvailable()) {
      // Try to load persisted encrypted master key
      const stored = await storageService.getSetting('vault_master_key');
      if (stored) {
        this._masterKey = safeStorage.decryptString(Buffer.from(stored, 'base64'));
        return this._masterKey;
      }
      // Generate new master key
      const newKey = require('crypto').randomBytes(32).toString('hex');
      const encrypted = safeStorage.encryptString(newKey);
      await storageService.saveSetting('vault_master_key', encrypted.toString('base64'));
      this._masterKey = newKey;
      return this._masterKey;
    }

    console.warn('[KeyVault] safeStorage unavailable — using fallback key (dev mode only)');
    return FALLBACK_KEY;
  }

  /**
   * Store an encrypted secret under a named key.
   */
  async storeSecret(name, value) {
    const masterKey = await this.getMasterKey();
    const encrypted = encrypt(value, masterKey);
    await storageService.saveSetting(`vault_secret_${name}`, encrypted);
    console.log(`[KeyVault] Stored secret: ${name}`);
  }

  /**
   * Retrieve and decrypt a secret by name.
   * Returns null if not found.
   */
  async getSecret(name) {
    const masterKey = await this.getMasterKey();
    const encrypted = await storageService.getSetting(`vault_secret_${name}`);
    if (!encrypted) return null;
    try {
      return decrypt(encrypted, masterKey);
    } catch (e) {
      console.error(`[KeyVault] Failed to decrypt secret "${name}":`, e.message);
      return null;
    }
  }

  /**
   * Delete a stored secret.
   */
  async deleteSecret(name) {
    await storageService.saveSetting(`vault_secret_${name}`, null);
  }

  /**
   * Store exchange API credentials (apiKey + apiSecret) encrypted.
   */
  async storeExchangeCredentials(exchange, apiKey, apiSecret, passphrase = null) {
    const payload = JSON.stringify({ apiKey, apiSecret, passphrase });
    await this.storeSecret(`exchange_${exchange}`, payload);
  }

  /**
   * Retrieve exchange API credentials.
   */
  async getExchangeCredentials(exchange) {
    const payload = await this.getSecret(`exchange_${exchange}`);
    if (!payload) return null;
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  /**
   * Store a DeFi wallet private key.
   */
  async storeWalletKey(chain, address, privateKey) {
    await this.storeSecret(`wallet_${chain}_${address}`, privateKey);
  }

  /**
   * Retrieve a DeFi wallet private key.
   */
  async getWalletKey(chain, address) {
    return this.getSecret(`wallet_${chain}_${address}`);
  }
}

const keyVault = new KeyVault();
module.exports = { keyVault };
