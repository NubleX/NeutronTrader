// NeutronTrader - PancakeSwap V3 DEX adapter (BSC)
// Uses Uniswap V3-compatible interface (PancakeSwap V3 is a fork).

const { ethers } = require('ethers');
const { DefiAdapter } = require('./defiAdapter');

// PancakeSwap V3 on BSC
const FACTORY_ADDRESS = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';
const ROUTER_ADDRESS  = '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4';

const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'
];

const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function fee() external view returns (uint24)'
];

const ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)'
];

const FEE_TIERS = [100, 500, 2500, 10000];

class PancakeSwapAdapter extends DefiAdapter {
  constructor(chainManager) {
    super('bsc', chainManager);
    this.name = 'pancakeswap_bsc';
  }

  async _getPool(tokenA, tokenB, fee = 2500) {
    const provider = await this.getProvider();
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
    const poolAddress = await factory.getPool(tokenA, tokenB, fee);
    if (!poolAddress || poolAddress === ethers.ZeroAddress) return null;
    return new ethers.Contract(poolAddress, POOL_ABI, provider);
  }

  async _getBestPool(tokenA, tokenB) {
    let best = null, bestLiq = BigInt(0);
    for (const fee of FEE_TIERS) {
      try {
        const pool = await this._getPool(tokenA, tokenB, fee);
        if (!pool) continue;
        const liq = await pool.liquidity();
        if (liq > bestLiq) { bestLiq = liq; best = pool; }
      } catch { /* skip */ }
    }
    return best;
  }

  async getPoolPrice(tokenA, tokenB) {
    const pool = await this._getBestPool(tokenA, tokenB);
    if (!pool) throw new Error(`No PancakeSwap pool found for ${tokenA}/${tokenB}`);

    const slot0 = await pool.slot0();
    const Q96 = BigInt(2) ** BigInt(96);
    const price = (slot0.sqrtPriceX96 * slot0.sqrtPriceX96 * BigInt(10 ** 18)) / (Q96 * Q96);
    const token0 = await pool.token0();
    const isToken0 = tokenA.toLowerCase() === token0.toLowerCase();
    const priceFloat = Number(price) / 1e18;

    return {
      price: isToken0 ? priceFloat : 1 / priceFloat,
      pool: await pool.getAddress(),
      fee: Number(await pool.fee()),
      chain: 'bsc'
    };
  }

  async getLiquidity(tokenA, tokenB) {
    const pool = await this._getBestPool(tokenA, tokenB);
    if (!pool) return null;
    const liq = await pool.liquidity();
    return { liquidity: liq.toString(), pool: await pool.getAddress() };
  }

  async estimateSwapOutput(tokenIn, tokenOut, amountIn) {
    const priceData = await this.getPoolPrice(tokenIn, tokenOut);
    return { amountOut: amountIn * priceData.price, price: priceData.price, fee: priceData.fee / 1e6 };
  }

  async getOptimalRoute(tokenIn, tokenOut, amountIn) {
    return this.estimateSwapOutput(tokenIn, tokenOut, amountIn);
  }

  async executeSwap(wallet, tokenIn, tokenOut, amountIn, minAmountOut, deadline) {
    const provider = await this.getProvider();
    const connectedWallet = wallet.connect(provider);

    const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, connectedWallet);
    const decimals = await tokenInContract.decimals();
    const amountInWei = ethers.parseUnits(String(amountIn), decimals);
    const minOut = ethers.parseUnits(String(minAmountOut), decimals);

    await (await tokenInContract.approve(ROUTER_ADDRESS, amountInWei)).wait();

    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, connectedWallet);
    const deadlineTs = Math.floor(Date.now() / 1000) + (deadline || 300);

    const tx = await router.exactInputSingle({
      tokenIn,
      tokenOut,
      fee: 2500,
      recipient: wallet.address,
      amountIn: amountInWei,
      amountOutMinimum: minOut,
      sqrtPriceLimitX96: BigInt(0)
    });

    const receipt = await tx.wait();
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
  }
}

module.exports = { PancakeSwapAdapter };
