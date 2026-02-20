// NeutronTrader - Uniswap V3 DEX adapter
// Supports: Ethereum (chainId 1), Arbitrum (42161), Polygon (137)
// Uses ethers.js v6 for on-chain reads via the pool contract.

const { ethers } = require('ethers');
const { DefiAdapter } = require('./defiAdapter');

// Uniswap V3 factory addresses per chain
const FACTORY_ADDRESSES = {
  ethereum: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  arbitrum: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  polygon:  '0x1F98431c8aD98523631AE4a59f267346ea31F984'
};

// Uniswap V3 SwapRouter02 addresses
const ROUTER_ADDRESSES = {
  ethereum: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  arbitrum: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  polygon:  '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
};

const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'
];

const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)'
];

const ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)'
];

// Common fee tiers: 0.01%, 0.05%, 0.3%, 1%
const FEE_TIERS = [100, 500, 3000, 10000];

class UniswapAdapter extends DefiAdapter {
  constructor(chain, chainManager) {
    super(chain, chainManager);
    this.name = `uniswap_v3_${chain}`;
    const factoryAddr = FACTORY_ADDRESSES[chain];
    if (!factoryAddr) throw new Error(`Uniswap V3 not supported on chain: ${chain}`);
  }

  async _getFactory() {
    const provider = await this.getProvider();
    return new ethers.Contract(FACTORY_ADDRESSES[this.chain], FACTORY_ABI, provider);
  }

  async _getPool(tokenA, tokenB, fee = 3000) {
    const factory = await this._getFactory();
    const poolAddress = await factory.getPool(tokenA, tokenB, fee);
    if (!poolAddress || poolAddress === ethers.ZeroAddress) return null;
    const provider = await this.getProvider();
    return new ethers.Contract(poolAddress, POOL_ABI, provider);
  }

  /**
   * Try all fee tiers and return the pool with the best liquidity.
   */
  async _getBestPool(tokenA, tokenB) {
    let bestPool = null;
    let bestLiquidity = BigInt(0);

    for (const fee of FEE_TIERS) {
      try {
        const pool = await this._getPool(tokenA, tokenB, fee);
        if (!pool) continue;
        const liq = await pool.liquidity();
        if (liq > bestLiquidity) {
          bestLiquidity = liq;
          bestPool = pool;
        }
      } catch { /* skip */ }
    }
    return bestPool;
  }

  /**
   * Get the spot price of tokenB in terms of tokenA from the pool's sqrtPriceX96.
   */
  async getPoolPrice(tokenA, tokenB) {
    const pool = await this._getBestPool(tokenA, tokenB);
    if (!pool) throw new Error(`No Uniswap V3 pool found for ${tokenA}/${tokenB} on ${this.chain}`);

    const slot0 = await pool.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96;

    // Price = (sqrtPriceX96 / 2^96)^2
    const Q96 = BigInt(2) ** BigInt(96);
    const price = (sqrtPriceX96 * sqrtPriceX96 * BigInt(10 ** 18)) / (Q96 * Q96);

    const token0 = await pool.token0();
    const isToken0 = tokenA.toLowerCase() === token0.toLowerCase();
    const priceFloat = Number(price) / 1e18;

    return {
      price: isToken0 ? priceFloat : 1 / priceFloat,
      pool: await pool.getAddress(),
      fee: Number(await pool.fee()),
      chain: this.chain
    };
  }

  async getLiquidity(tokenA, tokenB) {
    const pool = await this._getBestPool(tokenA, tokenB);
    if (!pool) return null;
    const liq = await pool.liquidity();
    return { liquidity: liq.toString(), pool: await pool.getAddress() };
  }

  /**
   * Estimate swap output (best effort — uses price ratio, not exact routing).
   */
  async estimateSwapOutput(tokenIn, tokenOut, amountIn) {
    const priceData = await this.getPoolPrice(tokenIn, tokenOut);
    return {
      amountOut: amountIn * priceData.price,
      price: priceData.price,
      fee: priceData.fee / 1e6 // convert from bps to fraction
    };
  }

  async getOptimalRoute(tokenIn, tokenOut, amountIn) {
    return this.estimateSwapOutput(tokenIn, tokenOut, amountIn);
  }

  /**
   * Execute a swap. wallet must be an ethers.Wallet connected to a provider.
   */
  async executeSwap(wallet, tokenIn, tokenOut, amountIn, minAmountOut, deadline) {
    const routerAddress = ROUTER_ADDRESSES[this.chain];
    if (!routerAddress) throw new Error(`Router not configured for ${this.chain}`);

    const provider = await this.getProvider();
    const connectedWallet = wallet.connect(provider);

    // Approve router to spend tokenIn
    const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, connectedWallet);
    const decimals = await tokenInContract.decimals();
    const amountInWei = ethers.parseUnits(String(amountIn), decimals);
    const minAmountOutWei = ethers.parseUnits(String(minAmountOut), decimals);

    const approveTx = await tokenInContract.approve(routerAddress, amountInWei);
    await approveTx.wait();

    // Execute swap
    const router = new ethers.Contract(routerAddress, ROUTER_ABI, connectedWallet);
    const deadlineTs = Math.floor(Date.now() / 1000) + (deadline || 300);

    const tx = await router.exactInputSingle({
      tokenIn,
      tokenOut,
      fee: 3000, // 0.3% tier (most liquid)
      recipient: wallet.address,
      amountIn: amountInWei,
      amountOutMinimum: minAmountOutWei,
      sqrtPriceLimitX96: BigInt(0)
    });

    const receipt = await tx.wait();
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
  }
}

module.exports = { UniswapAdapter };
