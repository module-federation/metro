import { loadShare, loadShareSync } from "@module-federation/runtime";

const registry = {};
const loading = {};

const earlyModuleTest = __EARLY_MODULE_TEST__;

function cloneModule(module, target) {
  Object.getOwnPropertyNames(module).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(module, key);
    Object.defineProperty(target, key, descriptor);
  });
}

export function loadSharedToRegistry(id) {
  if (earlyModuleTest.test(id)) {
    return loadSharedToRegistrySync(id);
  } else {
    return loadSharedToRegistryAsync(id);
  }
}

export async function loadSharedToRegistryAsync(id) {
  const promise = loading[id];
  if (promise) {
    await promise;
  } else {
    registry[id] = {};
    loading[id] = async () => {
      const factory = await loadShare(id);
      const sharedModule = factory();
      cloneModule(sharedModule, registry[id]);
    };
    await loading[id]();
  }
}

export function loadSharedToRegistrySync(id) {
  if (loading[id]) {
    return;
  }
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
