// load expo async require if outside expo
if (!process.env.EXPO_OS) {
  // @expo/metro-runtime/src/async-require/fetchAsync.native.ts requires
  // process.env.EXPO_OS to be set but since expo is optional, we set it
  // to an empty string as a fallback to prevent reference errors
  process.env.EXPO_OS = "";
  require("./vendor/expo/async-require");
}

// wrapper for loading federated bundles in production
if (process.env.NODE_ENV === "production") {
  global[`${__METRO_GLOBAL_PREFIX__}__loadBundleAsync`] =
    createProductionLoadBundleAsyncWrapper();
}

// wrapper for loading federated dependencies
global[`${__METRO_GLOBAL_PREFIX__}__loadBundleAsync`] =
  createFederatedDependenciesLoadBundleAsyncWrapper();

function createProductionLoadBundleAsyncWrapper() {
  function joinComponents(prefix, suffix) {
    return prefix.replace(/\/+$/, "") + "/" + suffix.replace(/^\/+/, "");
  }

  function getPublicPath(url) {
    return url.split("/").slice(0, -1).join("/");
  }

  function getBundlePath(bundlePath, entryUrl) {
    if (bundlePath.match(/^https?:\/\//)) {
      return bundlePath;
    }
    return joinComponents(getPublicPath(entryUrl), bundlePath);
  }

  const originalLoadBundleAsync =
    global[`${__METRO_GLOBAL_PREFIX__ ?? ""}__loadBundleAsync`];

  return (bundlePath) => {
    const remoteEntry =
      global.__METRO_FEDERATION__[__METRO_GLOBAL_PREFIX__].location;
    // resolve the remote bundle path based on the remote location
    const remoteBundlePath = getBundlePath(bundlePath, remoteEntry);
    return originalLoadBundleAsync(remoteBundlePath);
  };
}

function createFederatedDependenciesLoadBundleAsyncWrapper() {
  function getBundleId(urlPath) {
    // strip the query params
    const [bundlePath] = urlPath.split("?");
    // remove the leading slash and the bundle extension
    return bundlePath.slice(1).replace(".bundle", "");
  }

  function getDependencies(bundleId) {
    const scope = global.__METRO_FEDERATION__[__METRO_GLOBAL_PREFIX__];
    const shared = scope.dependencies.shared[bundleId];
    const remotes = scope.dependencies.remotes[bundleId];
    return { shared, remotes };
  }

  const {
    loadSharedToRegistry,
    loadRemoteToRegistry,
  } = require("mf:remote-module-registry");

  const originalLoadBundleAsync =
    global[`${__METRO_GLOBAL_PREFIX__ ?? ""}__loadBundleAsync`];

  return async (bundlePath) => {
    // resolve the remote bundle path based on the remote location
    const result = await originalLoadBundleAsync(bundlePath);

    // at this point the code in the bundle has been evaluated
    // but not yet executed through metroRequire
    const { shared, remotes } = getDependencies(getBundleId(bundlePath));

    const promises = [];
    if (shared && shared.length > 0) {
      // load shared used synchronously in the bundle
      promises.push(...shared.map(loadSharedToRegistry));
    }

    if (remotes && remotes.length > 0) {
      // load remotes used synchronously in the bundle
      promises.push(...remotes.map(loadRemoteToRegistry));
    }

    await Promise.all(promises);

    return result;
  };
}
