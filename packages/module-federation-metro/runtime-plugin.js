const MetroCorePlugin = () => ({
  name: "metro-core-plugin",
  loadEntry: async ({ remoteInfo }) => {
    const { entry, entryGlobalName } = remoteInfo;
    const loadBundleAsync =
      globalThis[
        `${globalThis.__METRO_GLOBAL_PREFIX__ ?? ""}__loadBundleAsync`
      ];

    if (!loadBundleAsync) {
      throw new Error("loadBundleAsync is not defined");
    }

    try {
      await loadBundleAsync(entry);

      if (!globalThis[entryGlobalName]) {
        throw new Error();
      }

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
