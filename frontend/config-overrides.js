const webpack = require('webpack');

module.exports = function override(config) {
  // Add polyfills for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    buffer: require.resolve('buffer/'),
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    process: require.resolve('process/browser'),
    util: false,
    assert: false,
    http: false,
    https: false,
    os: false,
    url: false,
    zlib: false,
  };

  // Provide global polyfills
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ];

  // Ignore source map warnings from dependencies
  config.ignoreWarnings = [/Failed to parse source map/];

  return config;
};
