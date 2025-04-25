import { loadSharedToRegistry } from "mf:shared-registry";
import { init } from "@module-federation/runtime";

__PLUGINS__;

const usedRemotes = __REMOTES__;
const usedShared = __SHARED__;

const initRes = init({
  name: __NAME__,
  remotes: usedRemotes,
  plugins,
  shared: usedShared,
  shareStrategy: "loaded-first",
});

global.__METRO_FEDERATION__ = global.__METRO_FEDERATION__ || {};
global.__METRO_FEDERATION__[__NAME__] =
  global.__METRO_FEDERATION__[__NAME__] || {};

global.__METRO_FEDERATION__.__HOST__ = global.__METRO_FEDERATION__[__NAME__];

global.__METRO_FEDERATION__[__NAME__].__shareInit = Promise.all(
  initRes.initializeSharing("default", {
    strategy: "loaded-first",
    from: "build",
    initScope: [],
  })
);

global.__METRO_FEDERATION__[__NAME__].__shareLoading = Promise.all(
  Object.keys(usedShared).map(loadSharedToRegistry)
);
