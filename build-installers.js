{
    "name": "build-installers.js",
    "description": "Build configuration for creating installer packages",
    "scripts": {
        "build:win": "electron-builder --win",
        "build:mac": "electron-builder --mac",
        "build:linux": "electron-builder --linux",
        "build:all": "electron-builder --mac --win --linux",
        "build:win32": "electron-builder --win --ia32",
        "build:win64": "electron-builder --win --x64",
        "dist": "npm run build && electron-builder",
        "dist:dir": "npm run build && electron-builder --dir",
        "postinstall": "electron-builder install-app-deps"
    },
    "main": "build/electron/main.js",
    "build": {
        "appId": "com.neutrontrader.app",
        "productName": "NeutronTrader",
        "copyright": "Copyright © 2025 Igor Dunaev (NubleX)",
        "directories": {
            "output": "dist",
            "buildResources": "build-resources"
        },
        "files": [
            "build/**/*",
            "electron/**/*",
            "node_modules/**/*",
            "!node_modules/.cache/**/*",
            "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
            "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
            "!**/node_modules/*.d.ts",
            "!**/node_modules/.bin",
            "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}",
            "!.editorconfig",
            "!**/._*",
            "!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}",
            "!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vscode,.nyc_output}",
            "!**/{appveyor.yml,.travis.yml,circle.yml}",
            "!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}"
        ],
        "extraResources": [
            {
                "from": "assets/",
                "to": "assets/",
                "filter": [
                    "**/*"
                ]
            }
        ],
        "publish": [
            {
                "provider": "github",
                "owner": "nublex",
                "repo": "NeutronTrader"
            }
        ],
        "mac": {
            "category": "public.app-category.finance",
            "icon": "build-resources/icon.icns",
            "hardenedRuntime": true,
            "gatekeeperAssess": false,
            "entitlements": "build-resources/entitlements.mac.plist",
            "entitlementsInherit": "build-resources/entitlements.mac.plist",
            "target": [
                {
                    "target": "dmg",
                    "arch": [
                        "x64",
                        "arm64"
                    ]
                },
                {
                    "target": "zip",
                    "arch": [
                        "x64",
                        "arm64"
                    ]
                }
            ]
        },
        "dmg": {
            "title": "${productName} ${version}",
            "artifactName": "${productName}-${version}-${os}-${arch}.${ext}",
            "background": "build-resources/dmg-background.png",
            "iconSize": 100,
            "contents": [
                {
                    "x": 380,
                    "y": 280,
                    "type": "link",
                    "path": "/Applications"
                },
                {
                    "x": 110,
                    "y": 280,
                    "type": "file"
                }
            ],
            "window": {
                "width": 540,
                "height": 400
            }
        },
        "win": {
            "target": [
                {
                    "target": "nsis",
                    "arch": [
                        "x64",
                        "ia32"
                    ]
                },
                {
                    "target": "portable",
                    "arch": [
                        "x64",
                        "ia32"
                    ]
                },
                {
                    "target": "zip",
                    "arch": [
                        "x64",
                        "ia32"
                    ]
                }
            ],
            "icon": "build-resources/icon.ico",
            "publisherName": "Igor Dunaev (NubleX)",
            "requestedExecutionLevel": "asInvoker"
        },
        "nsis": {
            "oneClick": false,
            "perMachine": false,
            "allowToChangeInstallationDirectory": true,
            "deleteAppDataOnUninstall": false,
            "createDesktopShortcut": true,
            "createStartMenuShortcut": true,
            "shortcutName": "NeutronTrader",
            "include": "build-resources/installer.nsh",
            "script": "build-resources/installer.nsi",
            "installerIcon": "build-resources/icon.ico",
            "uninstallerIcon": "build-resources/icon.ico",
            "installerHeaderIcon": "build-resources/icon.ico",
            "displayLanguageSelector": true,
            "multiLanguageInstaller": true,
            "packElevateHelper": true,
            "differentialPackage": true
        },
        "portable": {
            "artifactName": "${productName}-${version}-portable-${arch}.${ext}"
        },
        "linux": {
            "target": [
                {
                    "target": "AppImage",
                    "arch": [
                        "x64"
                    ]
                },
                {
                    "target": "deb",
                    "arch": [
                        "x64"
                    ]
                },
                {
                    "target": "rpm",
                    "arch": [
                        "x64"
                    ]
                },
                {
                    "target": "tar.gz",
                    "arch": [
                        "x64"
                    ]
                }
            ],
            "icon": "build-resources/icon.png",
            "category": "Finance",
            "description": "A simple, user-friendly Binance trading bot",
            "desktop": {
                "Name": "NeutronTrader",
                "Comment": "Cryptocurrency Trading Bot",
                "Keywords": "trading;cryptocurrency;binance;bitcoin;ethereum;",
                "StartupNotify": "true"
            }
        },
        "appImage": {
            "artifactName": "${productName}-${version}-${arch}.${ext}"
        },
        "deb": {
            "artifactName": "${productName}-${version}-${arch}.${ext}",
            "depends": [
                "gconf2",
                "gconf-service",
                "libnotify4",
                "libappindicator1",
                "libxtst6",
                "libnss3"
            ],
            "maintainer": "Igor Dunaev <contact@nublex.com>",
            "homepage": "https://github.com/nublex/NeutronTrader"
        },
        "rpm": {
            "artifactName": "${productName}-${version}-${arch}.${ext}",
            "depends": [
                "libnotify",
                "libappindicator",
                "libXtst"
            ],
            "vendor": "Igor Dunaev (NubleX)",
            "license": "GPL-3.0"
        },
        "protocols": [
            {
                "name": "NeutronTrader Protocol",
                "schemes": [
                    "neutrontrader"
                ]
            }
        ],
        "fileAssociations": [
            {
                "ext": "ntconfig",
                "name": "NeutronTrader Configuration",
                "description": "NeutronTrader Configuration File",
                "icon": "build-resources/file-icon.ico",
                "role": "Editor"
            }
        ]
    },
    "buildResources": {
        "icon.icns": "macOS icon file (512x512 minimum)",
        "icon.ico": "Windows icon file (256x256 recommended)",
        "icon.png": "Linux icon file (512x512 PNG)",
        "dmg-background.png": "DMG background image (540x400)",
        "installer.nsi": "NSIS installer script",
        "installer.nsh": "NSIS installer includes",
        "entitlements.mac.plist": "macOS entitlements for hardened runtime"
    },
    "scripts_detailed": {
        "prebuild": {
            "description": "Prepare build environment",
            "commands": [
                "npm run clean",
                "npm run build:react"
            ]
        },
        "build:react": {
            "description": "Build React application",
            "command": "react-app-rewired build"
        },
        "build:electron": {
            "description": "Build Electron main process",
            "command": "tsc electron/main.ts --outDir build/electron"
        },
        "clean": {
            "description": "Clean build directories",
            "command": "rimraf build dist"
        },
        "pack": {
            "description": "Pack application without creating installer",
            "command": "electron-builder --dir"
        },
        "sign:mac": {
            "description": "Sign macOS application",
            "command": "electron-builder --mac --publish=never",
            "env": {
                "CSC_LINK": "path/to/certificate.p12",
                "CSC_KEY_PASSWORD": "certificate_password"
            }
        },
        "notarize:mac": {
            "description": "Notarize macOS application",
            "command": "electron-builder --mac --publish=never",
            "env": {
                "APPLE_ID": "your@apple.id",
                "APPLE_ID_PASS": "app_specific_password",
                "APPLE_TEAM_ID": "your_team_id"
            }
        }
    },
    "build_configurations": {
        "development": {
            "compression": "store",
            "removePackageScripts": false,
            "nodeGypRebuild": false
        },
        "production": {
            "compression": "maximum",
            "removePackageScripts": true,
            "nodeGypRebuild": true,
            "buildDependenciesFromSource": false
        }
    },
    "release_process": {
        "steps": [
            "1. Update version in package.json",
            "2. Update CHANGELOG.md with new features",
            "3. Run npm run test to ensure all tests pass",
            "4. Run npm run build:all to create all installers",
            "5. Test installers on target platforms",
            "6. Create GitHub release with binaries",
            "7. Update download links in README.md"
        ],
        "platforms": {
            "windows": {
                "targets": [
                    "nsis",
                    "portable",
                    "zip"
                ],
                "architectures": [
                    "x64",
                    "ia32"
                ],
                "signing": "Optional - Authenticode certificate required for distribution"
            },
            "macOS": {
                "targets": [
                    "dmg",
                    "zip"
                ],
                "architectures": [
                    "x64",
                    "arm64"
                ],
                "signing": "Required for distribution outside Mac App Store",
                "notarization": "Required for macOS 10.15+"
            },
            "linux": {
                "targets": [
                    "AppImage",
                    "deb",
                    "rpm",
                    "tar.gz"
                ],
                "architectures": [
                    "x64"
                ],
                "signing": "Optional - GPG signing recommended"
            }
        }
    },
    "size_optimization": {
        "techniques": [
            "Remove development dependencies from final bundle",
            "Use electron-builder's compression options",
            "Exclude unnecessary files with files array",
            "Use asar packaging for faster startup",
            "Minimize node_modules with pruning"
        ],
        "typical_sizes": {
            "windows_installer": "80-120 MB",
            "macos_dmg": "85-125 MB",
            "linux_appimage": "90-130 MB"
        }
    },
    "distribution": {
        "github_releases": {
            "automatic": true,
            "draft": false,
            "prerelease": false,
            "provider": "github"
        },
        "auto_updater": {
            "enabled": true,
            "provider": "github",
            "updaterCacheDirName": "neutrontrader-updater"
        },
        "checksums": {
            "generate": true,
            "algorithm": "sha256"
        }
    }
}