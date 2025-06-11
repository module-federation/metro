const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const {withModuleFederation} = require('module-federation-metro');
const {withZephyr} = require('zephyr-metro-plugin');

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

const mfConfig = {
  name: 'nestedMini',
  filename: 'nestedMini.bundle',
  exposes: {
    './nestedMiniInfo': './src/nested-mini-info.tsx',
  },
  remotes: {
    mini: 'mini@http://localhost:8082/mf-manifest.json',
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
      requiredVersion: '4.16.6',
      version: '4.16.6',
    },
  },
  shareStrategy: 'version-first',
};

async function getConfig() {
  if (process.env.ZC) {
    const zephyrConfig = await withZephyr()(mfConfig);
    return withModuleFederation(
      mergeConfig(getDefaultConfig(__dirname), config),
      zephyrConfig,
    );
  }

  return withModuleFederation(
    mergeConfig(getDefaultConfig(__dirname), config),
    mfConfig,
  );
}

module.exports = getConfig();
