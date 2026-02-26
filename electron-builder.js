module.exports = {
  appId: 'com.nublex.neutrontrader',
  productName: 'NeutronTrader',

  // Output to release/ so it never collides with Vite's dist/ folder
  directories: {
    buildResources: 'public',
    output: 'release'
  },

  // Files packaged into the Electron app bundle
  files: [
    'dist/**/*',       // Vite-built React renderer
    'electron/**/*',   // Main-process modules (adapters, services, etc.)
    'main.js',         // Electron entry point
    'package.json'
  ],

  linux: {
    category: 'Finance',
    target: ['AppImage', 'deb']
  },

  win: {
    target: 'nsis'
  },

  mac: {
    category: 'public.app-category.finance',
    target: 'dmg'
  }
};
