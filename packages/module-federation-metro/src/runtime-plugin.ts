import type { FederationRuntimePlugin } from "@module-federation/runtime";

declare global {
  var __DEV__: boolean;
  var __METRO_GLOBAL_PREFIX__: string;
  var __METRO_FEDERATION__: Record<string, any> & {
    [key: string]: { __shareInit: Promise<void> };
  };
  var __loadBundleAsync: (entry: string) => Promise<void>;
}

const getPublicPath = (url: string) => {
  return url.split("/").slice(0, -1).join("/");
};

const buildUrlForEntryBundle = (entry: string) => {
  if (__DEV__) {
    // inlined by metro
    const platform = require("react-native").Platform.OS;
    return `${entry}?platform=${platform}&dev=${true}&lazy=${true}`;
  } else {
    return entry;
  }
};

const MetroCorePlugin: () => FederationRuntimePlugin = () => ({
  name: "metro-core-plugin",
  loadEntry: async ({ remoteInfo }) => {
    const { entry, entryGlobalName } = remoteInfo;
    const loadBundleAsyncGlobalKey = `${
      __METRO_GLOBAL_PREFIX__ ?? ""
    }__loadBundleAsync`;

    // @ts-ignore
    const __loadBundleAsync = global[loadBundleAsyncGlobalKey];

    const loadBundleAsync =
      __loadBundleAsync as typeof global.__loadBundleAsync;

    if (!loadBundleAsync) {
      throw new Error("loadBundleAsync is not defined");
    }

    try {
      const entryUrl = buildUrlForEntryBundle(entry);
      await loadBundleAsync(entryUrl);

      if (!global.__METRO_FEDERATION__[entryGlobalName]) {
        throw new Error();
      }

      global.__METRO_FEDERATION__[entryGlobalName].location =
        getPublicPath(entry);

      return global.__METRO_FEDERATION__[entryGlobalName];
    } catch (error) {
      console.error(
        `Failed to load remote entry: ${entryGlobalName}. Reason: ${error}`
      );
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
