import { loadShare, loadShareSync } from "@module-federation/runtime";

const registry = (global.__METRO_FEDERATION_REGISTRY__ =
  global.__METRO_FEDERATION_REGISTRY__ || {});
const loading = (global.__METRO_FEDERATION_LOADING__ =
  global.__METRO_FEDERATION_LOADING__ || {});

export async function loadSharedToRegistry(id) {
  await global.__METRO_FEDERATION_INIT__;
  const promise = loading[id];
  if (promise) {
    await promise;
  } else {
    registry[id] = {};
    loading[id] = loadShare(id);

    const shared = (await loading[id])();
    Object.getOwnPropertyNames(shared).forEach((key) => {
      registry[id][key] = shared[key];
    });
  }
}

export function loadSharedSyncToRegistry(id) {
  loading[id] = loadShareSync(id);
  registry[id] = loading[id]();
}

export function getModuleFromRegistry(id) {
  const module = registry[id];

  if (!module) {
    throw new Error(`Module ${id} not found in registry`);
  }

  return module;
}
