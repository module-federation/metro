import { loadShare, loadShareSync } from "@module-federation/runtime";

const registry = {};
const loading = {};

export async function loadSharedToRegistryAsync(id) {
  const promise = loading[id];
  if (promise) {
    await promise;
  } else {
    registry[id] = {};
    loading[id] = (async () => {
      const factory = await loadShare(id);
      const sharedModule = factory();
      Object.getOwnPropertyNames(sharedModule).forEach((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(sharedModule, key);
        Object.defineProperty(registry[id], key, descriptor);
      });
    })();
  }
}

export function loadSharedToRegistrySync(id) {
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
