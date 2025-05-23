import "mf:async-require-remote";

import { loadSharedToRegistryAsync } from "mf:shared-registry";
import { init as runtimeInit } from "@module-federation/runtime";

__PLUGINS__;

const usedRemotes = [];
const usedShared = __SHARED__;

const exposesMap = __EXPOSES_MAP__;

function get(moduleName) {
  if (!(moduleName in exposesMap)) {
    throw new Error(`Module ${moduleName} does not exist in container.`);
  }
  return exposesMap[moduleName]().then((m) => () => m);
}

const initTokens = {};
const shareScopeName = "default";
const shareStrategy = __SHARE_STRATEGY__;
const name = __NAME__;

let hmrInitialized = false;

async function init(shared = {}, initScope = []) {
  const initRes = runtimeInit({
    name,
    remotes: usedRemotes,
    shared: usedShared,
    plugins,
    shareStrategy,
  });
  // handling circular init calls
  var initToken = initTokens[shareScopeName];
  if (!initToken) {
    initToken = initTokens[shareScopeName] = {
      from: name,
    };
  }
  if (initScope.indexOf(initToken) >= 0) {
    return;
  }
  initScope.push(initToken);
  initRes.initShareScopeMap(shareScopeName, shared);

  await Promise.all(
    initRes.initializeSharing(shareScopeName, {
      strategy: shareStrategy,
      from: "build",
      initScope,
    })
  );

  // TODO we should load only sync shared deps here
  // non-eager shared deps should be loaded after HMR is initialized
  await Promise.all(
    Object.keys(usedShared)
      .filter((m) => m === "react" || m.startsWith("react-native"))
      .map(loadSharedToRegistryAsync)
  );

  // setup HMR client after the initializing sync shared deps
  if (__DEV__ && !hmrInitialized) {
    const hmr = require("mf:remote-hmr");
    hmr.setup();
    hmrInitialized = true;
  }

  // load non-eager shared deps
  await Promise.all(
    Object.keys(shared)
      .filter((m) => m !== "react" && !m.startsWith("react-native"))
      .map(loadSharedToRegistryAsync)
  );

  return initRes;
}

global.__METRO_FEDERATION__[__NAME__] =
  global.__METRO_FEDERATION__[__NAME__] || {};

global.__METRO_FEDERATION__[__NAME__].get = get;
global.__METRO_FEDERATION__[__NAME__].init = init;
