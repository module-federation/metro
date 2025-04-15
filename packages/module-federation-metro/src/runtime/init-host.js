import { init } from "@module-federation/runtime";

let __once__ = false;
const usedShared = __SHARED__;

if (!__once__) {
  __once__ = true;
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
}
