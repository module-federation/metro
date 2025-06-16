// load expo async require if outside expo
if (!process.env.EXPO_OS) {
  // @expo/metro-runtime/src/async-require/fetchAsync.native.ts requires
  // process.env.EXPO_OS to be set but since expo is optional, we set it
  // to an empty string as a fallback to prevent reference errors
  process.env.EXPO_OS = '';
  require('./vendor/expo/async-require');
}

const { buildLoadBundleAsyncWrapper } = require('./src/async-require');

// wrapper for loading federated dependencies
global[`${__METRO_GLOBAL_PREFIX__}__loadBundleAsync`] =
  buildLoadBundleAsyncWrapper();
