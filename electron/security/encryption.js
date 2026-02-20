// NeutronTrader - AES-256-GCM encryption utilities

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // GCM recommended
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Derive a 256-bit key from a password using PBKDF2
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns a base64-encoded string: salt(32) + iv(12) + tag(16) + ciphertext
 */
function encrypt(plaintext, password) {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a base64-encoded ciphertext produced by encrypt().
 */
function decrypt(ciphertext, password) {
  const data = Buffer.from(ciphertext, 'base64');

  const salt = data.subarray(0, 32);
  const iv = data.subarray(32, 32 + IV_LENGTH);
  const tag = data.subarray(32 + IV_LENGTH, 32 + IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(32 + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Hash an API key for safe logging/display (SHA-256, first 8 hex chars)
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 8) + '...';
}

/**
 * Basic API key format validation
 */
function validateApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return false;
  return apiKey.length >= 16 && /^[A-Za-z0-9_\-]+$/.test(apiKey);
}

module.exports = { encrypt, decrypt, hashApiKey, validateApiKeyFormat };
