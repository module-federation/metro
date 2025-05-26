import { loadSharedToRegistry } from "mf:shared-registry";
import { init } from "@module-federation/runtime";

__PLUGINS__;

const usedRemotes = __REMOTES__;
const usedShared = __SHARED__;
const earlyShared = __EARLY_SHARED__;

const shareScopeName = "default";
const shareStrategy = __SHARE_STRATEGY__;

const initRes = init({
  name: __NAME__,
  remotes: usedRemotes,
  plugins,
  shared: usedShared,
  shareStrategy,
});

global.__METRO_FEDERATION__ = global.__METRO_FEDERATION__ || {};
global.__METRO_FEDERATION__[__NAME__] =
  global.__METRO_FEDERATION__[__NAME__] || {};

global.__METRO_FEDERATION__[__NAME__].__shareInit = Promise.all(
  initRes.initializeSharing(shareScopeName, {
    strategy: shareStrategy,
    from: "build",
    initScope: [],
  })
).then(() => Promise.all(Object.keys(usedShared).map(loadSharedToRegistry)));

earlyShared.forEach(loadSharedToRegistry);
