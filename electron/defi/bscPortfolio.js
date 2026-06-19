// NeutronTrader - BSC portfolio balance fetcher (lazy-loaded ethers)

const BSC_TOKENS = [
  { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18 },
  { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18 },
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

async function getBscBalances(address) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid BSC address');
  }

  const { chainManager } = require('./chainManager');
  const { ethers } = require('ethers');
  const provider = await chainManager.getProvider('bsc');

  const bnbWei = await provider.getBalance(address);
  const bnb = parseFloat(ethers.formatEther(bnbWei));

  const tokens = [];
  for (const token of BSC_TOKENS) {
    try {
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const raw = await contract.balanceOf(address);
      const balance = parseFloat(ethers.formatUnits(raw, token.decimals));
      if (balance > 0) {
        tokens.push({ asset: token.symbol, balance, chain: 'bsc', type: 'bep20' });
      }
    } catch {
      // skip failed token reads
    }
  }

  return {
    address,
    chain: 'bsc',
    bnb,
    tokens,
    updatedAt: Date.now(),
  };
}

module.exports = { getBscBalances };
