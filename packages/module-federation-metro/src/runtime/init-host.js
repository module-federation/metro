import { init } from "@module-federation/runtime";

const usedShared = __SHARED__;

const initRes = init({
  name: __NAME__,
  shared: usedShared,
  shareStrategy: "loaded-first",
});

initRes.initializeSharing("default", {
  strategy: "loaded-first",
  from: "build",
  initScope: [],
});
