import 'mf:async-require';

import { loadSharedToRegistry } from 'mf:remote-module-registry';
import { init as runtimeInit } from '@module-federation/runtime';

__PLUGINS__;

const usedRemotes = __REMOTES__;
const usedShared = __SHARED__;

const exposesMap = __EXPOSES_MAP__;

function get(moduleName) {
  if (!(moduleName in exposesMap)) {
    throw new Error(`Module ${moduleName} does not exist in container.`);
  }
  return exposesMap[moduleName]().then((m) => () => m);
}

const initTokens = {};

const name = __NAME__;
const shareScopeName = 'default';
const shareStrategy = __SHARE_STRATEGY__;

let hmrInitialized = false;

async function init(shared = {}, initScope = []) {
  const instance = runtimeInit({
    name,
    remotes: usedRemotes,
    shared: usedShared,
    plugins,
    shareStrategy,
  });
  // handling circular init calls
  let initToken = initTokens[shareScopeName];
  if (!initToken) {
    initToken = initTokens[shareScopeName] = {
      from: name,
    };
  }
  if (initScope.indexOf(initToken) >= 0) {
    return;
  }
  initScope.push(initToken);
  instance.initShareScopeMap(shareScopeName, shared);

  await Promise.all(
    instance.initializeSharing(shareScopeName, {
      strategy: shareStrategy,
      from: 'build',
      initScope,
    })
  );

  // load early shared deps
  __EARLY_SHARED__.forEach(loadSharedToRegistry);

  // setup HMR client after the initializing sync shared deps
  if (__DEV__ && !hmrInitialized) {
    const hmr = require('mf:remote-hmr');
    hmr.setup();
    hmrInitialized = true;
  }

  // load the rest of shared deps
  await Promise.all(Object.keys(shared).map(loadSharedToRegistry));

  return instance;
}

globalThis.__FEDERATION__ ??= {};
globalThis.__FEDERATION__.__NATIVE__ ??= {};
globalThis.__FEDERATION__.__NATIVE__[name] ??= {};

globalThis.__FEDERATION__.__NATIVE__[name].deps ??= {
  shared: {},
  remotes: {},
};

globalThis.__FEDERATION__.__NATIVE__[name].exports = {
  get,
  init,
};
