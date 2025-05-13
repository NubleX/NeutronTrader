{
  "appId"; "com.neurontrader.app",
  "productName"; "NeutronTrader",
  "directories"; {
    "output"; "dist",
    "buildResources"; "public"
  }
  "files"; [
    "build/**/*",
    "electron/**/*"
  ]
  "mac"; {
    "category"; "public.app-category.finance"
  }
  "linux"; {
    "target"; ["AppImage", "deb"],
    "category"; "Finance"
  }
  "win"; {
    "target"; "nsis"
  }
  "extends"; null
}
