// NeutronTrader - Abstract DEX adapter base class

class DefiAdapter {
  constructor(chain, chainManager) {
    this.chain = chain;
    this.chainManager = chainManager;
    this.name = 'base';
  }

  async getProvider() {
    return this.chainManager.getProvider(this.chain);
  }

  async getPoolPrice(tokenA, tokenB) {
    throw new Error(`${this.name}: getPoolPrice() not implemented`);
  }

  async getOptimalRoute(tokenIn, tokenOut, amountIn) {
    throw new Error(`${this.name}: getOptimalRoute() not implemented`);
  }

  async estimateSwapOutput(tokenIn, tokenOut, amountIn) {
    throw new Error(`${this.name}: estimateSwapOutput() not implemented`);
  }

  async executeSwap(wallet, tokenIn, tokenOut, amountIn, minAmountOut, deadline) {
    throw new Error(`${this.name}: executeSwap() not implemented`);
  }

  async getLiquidity(tokenA, tokenB) {
    throw new Error(`${this.name}: getLiquidity() not implemented`);
  }
}

module.exports = { DefiAdapter };
