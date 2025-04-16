import type { FederationRuntimePlugin } from "@module-federation/runtime";

declare global {
  var __METRO_GLOBAL_PREFIX__: string;
  var __loadBundleAsync: (entry: string) => Promise<void>;
}

const MetroCorePlugin: () => FederationRuntimePlugin = () => ({
  name: "metro-core-plugin",
  loadEntry: async ({ remoteInfo }) => {
    const { entry, entryGlobalName } = remoteInfo;

    const loadBundleAsyncGlobalKey = `${
      globalThis.__METRO_GLOBAL_PREFIX__ ?? ""
    }__loadBundleAsync`;

    // @ts-ignore
    const __loadBundleAsync = globalThis[loadBundleAsyncGlobalKey];

    const loadBundleAsync =
      __loadBundleAsync as typeof globalThis.__loadBundleAsync;

    if (!loadBundleAsync) {
      throw new Error("loadBundleAsync is not defined");
    }

    try {
      await loadBundleAsync(entry);

      // @ts-ignore
      if (globalThis[entryGlobalName]) {
        throw new Error();
      }

      // @ts-ignore
      return globalThis[entryGlobalName];
    } catch {
      console.error(`Failed to load remote entry: ${entryGlobalName}`);
    }
  },
  generatePreloadAssets: async () => {
    // noop for compatibility
    return Promise.resolve({
      cssAssets: [],
      jsAssetsWithoutEntry: [],
      entryAssets: [],
    });
  },
});

export default MetroCorePlugin;
