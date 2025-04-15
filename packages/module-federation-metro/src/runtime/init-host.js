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

initRes.initializeSharing("default", {
  strategy: "loaded-first",
  from: "build",
  initScope: [],
});
