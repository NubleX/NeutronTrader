const webpack = require('webpack');

module.exports = function override(config) {
  // Add fallbacks for Node.js modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    assert: require.resolve('assert'),
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    url: require.resolve('url'),
    buffer: require.resolve('buffer'),
    vm: require.resolve('vm-browserify'), 
    fs: false,
    net: false,
    tls: false,
    path: require.resolve('path-browserify'),
    process: require.resolve('process/browser'),
    zlib: require.resolve('browserify-zlib'),
  };

  // Add plugins
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ];

  return config;
};