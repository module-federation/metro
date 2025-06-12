// @ts-check
import {platformIOS} from '@rnef/platform-ios';
import {platformAndroid} from '@rnef/platform-android';
import {pluginMetro} from '@rnef/plugin-metro';
import {pluginMetroModuleFederation} from '@module-federation/metro-plugin-rnef';
import {zephyrMetroRNEFPlugin} from 'zephyr-metro-rnef-plugin';

/** @type {import('@rnef/config').Config} */
export default {
  bundler: pluginMetro(),
  platforms: {
    ios: platformIOS(),
    android: platformAndroid(),
  },
  remoteCacheProvider: null,
  plugins: [
    process.env.ZC ? zephyrMetroRNEFPlugin() : pluginMetroModuleFederation(),
  ],
};
