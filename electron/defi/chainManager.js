// NeutronTrader - Multi-chain RPC provider manager with failover

const { ethers } = require('ethers');

const CHAIN_CONFIGS = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    rpcs: [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://cloudflare-eth.com'
    ],
    nativeCurrency: 'ETH',
    dexes: ['uniswap_v3']
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcs: [
      'https://arb1.arbitrum.io/rpc',
      'https://rpc.ankr.com/arbitrum',
      'https://arbitrum.llamarpc.com'
    ],
    nativeCurrency: 'ETH',
    dexes: ['uniswap_v3', 'sushiswap']
  },
  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    rpcs: [
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.ninicoin.io',
      'https://rpc.ankr.com/bsc'
    ],
    nativeCurrency: 'BNB',
    dexes: ['pancakeswap']
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcs: [
      'https://polygon-rpc.com',
      'https://rpc.ankr.com/polygon',
      'https://polygon.llamarpc.com'
    ],
    nativeCurrency: 'MATIC',
    dexes: ['quickswap', 'uniswap_v3']
  }
};

class ChainManager {
  constructor() {
    this._providers = new Map(); // chain -> JsonRpcProvider
    this._rpcIndex = new Map();  // chain -> current RPC index
  }

  /**
   * Get (or create) a working provider for a chain, with failover.
   */
  async getProvider(chain) {
    const config = CHAIN_CONFIGS[chain];
    if (!config) throw new Error(`Unknown chain: ${chain}`);

    if (this._providers.has(chain)) {
      const provider = this._providers.get(chain);
      try {
        await provider.getBlockNumber();
        return provider;
      } catch {
        // Current RPC is dead — try next
        this._providers.delete(chain);
      }
    }

    return this._connectWithFailover(chain);
  }

  async _connectWithFailover(chain) {
    const config = CHAIN_CONFIGS[chain];
    const startIdx = this._rpcIndex.get(chain) || 0;

    for (let i = 0; i < config.rpcs.length; i++) {
      const idx = (startIdx + i) % config.rpcs.length;
      const rpc = config.rpcs[idx];
      try {
        const provider = new ethers.JsonRpcProvider(rpc, config.chainId);
        await provider.getBlockNumber(); // health check
        this._providers.set(chain, provider);
        this._rpcIndex.set(chain, idx);
        console.log(`[ChainManager] Connected to ${chain} via ${rpc}`);
        return provider;
      } catch (e) {
        console.warn(`[ChainManager] RPC failed for ${chain} (${rpc}): ${e.message}`);
      }
    }

    throw new Error(`All RPCs failed for chain: ${chain}`);
  }

  /**
   * Get chain configuration
   */
  getConfig(chain) {
    const config = CHAIN_CONFIGS[chain];
    if (!config) throw new Error(`Unknown chain: ${chain}`);
    return config;
  }

  /**
   * List all supported chains
   */
  getSupportedChains() {
    return Object.keys(CHAIN_CONFIGS);
  }

  /**
   * Get native ETH/BNB/MATIC balance for an address
   */
  async getNativeBalance(chain, address) {
    const provider = await this.getProvider(chain);
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  /**
   * Get ERC-20 token balance
   */
  async getTokenBalance(chain, tokenAddress, walletAddress) {
    const provider = await this.getProvider(chain);
    const abi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
    const contract = new ethers.Contract(tokenAddress, abi, provider);
    const [balance, decimals] = await Promise.all([contract.balanceOf(walletAddress), contract.decimals()]);
    return ethers.formatUnits(balance, decimals);
  }
}

const chainManager = new ChainManager();
module.exports = { chainManager, CHAIN_CONFIGS };
