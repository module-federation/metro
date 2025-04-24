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
  shareStrategy: "version-first",
});

global.__METRO_FEDERATION__ = global.__METRO_FEDERATION__ || {};
global.__METRO_FEDERATION__[__NAME__] =
  global.__METRO_FEDERATION__[__NAME__] || {};
global.__METRO_FEDERATION__.__HOST__ = global.__METRO_FEDERATION__[__NAME__];

global.__METRO_FEDERATION__[__NAME__]["init"] = Promise.all(
  initRes.initializeSharing("default", {
    strategy: "version-first",
    from: "build",
    initScope: [],
  })
);

Object.keys(usedShared).forEach(loadSharedToRegistry);
