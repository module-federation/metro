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

  // load eager shared modules
  const eagerSharedModules = Object.entries(usedShared)
    .filter(([, shared]) => shared.shareConfig.eager)
    .map(([name]) => loadSharedToRegistryAsync(name));

  // load shared modules loaded in host
  const scope = initRes.shareScopeMap[shareScopeName];
  const loadedSharedModules = Object.entries(scope)
    .filter(([, versions]) =>
      Object.values(versions)
        .map((shared) => shared.loaded)
        .some(Boolean)
    )
    .map(([sharedName]) => loadSharedToRegistryAsync(sharedName));

  await Promise.all([...eagerSharedModules, ...loadedSharedModules]);

  return initRes;
}

global.__METRO_FEDERATION__[__NAME__] =
  global.__METRO_FEDERATION__[__NAME__] || {};

global.__METRO_FEDERATION__[__NAME__].get = get;
global.__METRO_FEDERATION__[__NAME__].init = init;
