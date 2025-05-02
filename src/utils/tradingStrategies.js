// Define different trading strategies

export const getStrategies = () => {
  return {
    simpleMovingAverage: {
      name: 'Simple Moving Average (SMA)',
      description: 'Compares short-term and long-term moving averages. Buys when short-term MA crosses above long-term MA, sells when it crosses below.',
      // In a real app, this would contain the strategy logic
      execute: async (client, symbol, interval, options) => {
        // Implementation would go here
      }
    },
    
    relativeStrengthIndex: {
      name: 'Relative Strength Index (RSI)',
      description: 'Measures the magnitude of recent price changes. Buys when RSI is below 30 (oversold), sells when above 70 (overbought).',
      execute: async (client, symbol, interval, options) => {
        // Implementation would go here
      }
    },
    
    bollingerBands: {
      name: 'Bollinger Bands',
      description: 'Uses standard deviations from a moving average. Buys when price touches lower band, sells when it touches upper band.',
      execute: async (client, symbol, interval, options) => {
        // Implementation would go here
      }
    },
    
    macd: {
      name: 'Moving Average Convergence Divergence (MACD)',
      description: 'Identifies changes in strength, direction, momentum, and duration of a trend. Buys on bullish crossover, sells on bearish crossover.',
      execute: async (client, symbol, interval, options) => {
        // Implementation would go here
      }
    }
  };
};

// Utility function to calculate Simple Moving Average
export const calculateSMA = (prices, period) => {
  const result = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  
  return result;
};

// Utility function to calculate RSI
export const calculateRSI = (prices, period = 14) => {
  const deltas = [];
  for (let i = 1; i < prices.length; i++) {
    deltas.push(prices[i] - prices[i - 1]);
  }
  
  const gains = deltas.map(d => d > 0 ? d : 0);
  const losses = deltas.map(d => d < 0 ? -d : 0);
  
  // Calculate average gains and losses
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  const rsiValues = [];
  rsiValues.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));
  
  for (let i = period; i < prices.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
    
    rsiValues.push(100 - (100 / (1 + avgGain / (avgLoss || 1))));
  }
  
  return rsiValues;
};
