const path = require('path');
const fs = require('fs');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const {withModuleFederation} = require('module-federation-metro');

// Create a custom directory for the manifest
const manifestDir = path.resolve(__dirname, 'node_modules', '.manifest');
fs.mkdirSync(manifestDir, {
  recursive: true,
});

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [
    path.resolve(__dirname, '../../node_modules'),
    path.resolve(__dirname, '../../external/metro/packages'),
    path.resolve(__dirname, '../../packages/module-federation-metro'),
  ],
};

module.exports = withModuleFederation(
  mergeConfig(getDefaultConfig(__dirname), config),
  {
    name: 'mini',
    filename: 'mini.bundle',
    exposes: {
      './info': './src/info.tsx',
    },
    shared: {
      react: {
        singleton: true,
        eager: false,
        requiredVersion: '19.0.0',
        version: '19.0.0',
        import: false,
      },
      'react-native': {
        singleton: true,
        eager: false,
        requiredVersion: '0.79.0',
        version: '0.79.0',
        import: false,
      },
      'react-native/Libraries/Network/RCTNetworking': {
        singleton: true,
        eager: false,
        requiredVersion: '0.79.0',
        version: '0.79.0',
      },
      lodash: {
        singleton: false,
        eager: false,
        version: '4.17.21',
      },
    },
    shareStrategy: 'version-first',
    manifest: {
      fileName: 'manifest.json',
      filePath: manifestDir,
    },
  },
);
