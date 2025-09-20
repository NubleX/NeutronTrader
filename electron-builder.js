{
  "appId": "com.neurontrader.app",
  "directories": {
    "buildResources": "public",
    "output": "dist"
  },
  "extends": null,
  "extraResources": {
    "from": "preload.js",
    "to": "preload.js"
  },
  "files": [
    "build/**/*",
    "electron/**/*",
    "preload.js"
  ],
  "linux": {
    "category": "Finance",
    "target": [
      "AppImage",
      "deb"
    ]
  },
  "mac": {
    "category": "public.app-category.finance"
  },
  "productName": "NeutronTrader",
  "win": {
    "target": "nsis"
  }
}