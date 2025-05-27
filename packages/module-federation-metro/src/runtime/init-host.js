import {
  loadSharedToRegistrySync,
  loadSharedToRegistryAsync,
} from "mf:remote-module-registry";
import { init } from "@module-federation/runtime";

__PLUGINS__;

const usedRemotes = __REMOTES__;
const usedShared = __SHARED__;

const shareScopeName = "default";
const shareStrategy = __SHARE_STRATEGY__;

const syncShared = __SYNC_SHARED_DEPS__;
const asyncShared = __ASYNC_SHARED_DEPS__;

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
).then(() => Promise.all(asyncShared.map(loadSharedToRegistryAsync)));

syncShared.forEach(loadSharedToRegistrySync);
