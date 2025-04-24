import {
  loadSharedToRegistry,
  loadSharedSyncToRegistry,
} from "mf:shared-registry";
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

global.__METRO_FEDERATION_INIT__ = Promise.all(
  initRes.initializeSharing("default", {
    strategy: "version-first",
    from: "build",
    initScope: [],
  })
);

loadSharedSyncToRegistry("react");
loadSharedSyncToRegistry("react-native");

Object.keys(usedShared).forEach(loadSharedToRegistry);
