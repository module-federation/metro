const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const {withModuleFederation} = require('module-federation-metro');

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
    name: 'host',
    remotes: {
      mini: 'mini@http://localhost:8082/mini.js.bundle',
    },
    shared: {
      react: {
        singleton: true,
        eager: true,
        requiredVersion: '19.0.0',
        version: '19.0.0',
      },
      'react-native': {
        singleton: true,
        eager: true,
        requiredVersion: '0.79.0',
        version: '0.79.0',
      },
      lodash: {
        singleton: false,
        eager: false,
        requiredVersion: '4.16.6',
        version: '4.16.6',
      },
      'lottie-react-native': {
        singleton: true,
        eager: true,
        requiredVersion: '7.2.2',
        version: '7.2.2',
      },
    },
    plugins: [path.resolve(__dirname, './runtime-plugin.ts')],
  },
);
