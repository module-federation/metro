import { loadSharedToRegistry } from "mf:shared-registry";
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
const name = __NAME__;

async function init(shared = {}, initScope = []) {
  const initRes = runtimeInit({
    name,
    remotes: usedRemotes,
    shared: usedShared,
    plugins,
    shareStrategy: "version-first",
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
  initRes.initShareScopeMap("default", shared);

  global.__METRO_FEDERATION__[__NAME__].__shareInit = Promise.all(
    initRes.initializeSharing("default", {
      strategy: "version-first",
      from: "build",
      initScope,
    })
  );

  Object.keys(usedShared).forEach(loadSharedToRegistry);

  await Promise.all(
    Object.values(global.__METRO_FEDERATION__[__NAME__].__shareLoading)
  );

  return initRes;
}

global.__METRO_FEDERATION__[__NAME__] =
  global.__METRO_FEDERATION__[__NAME__] || {};

global.__METRO_FEDERATION__[__NAME__].get = get;
global.__METRO_FEDERATION__[__NAME__].init = init;
