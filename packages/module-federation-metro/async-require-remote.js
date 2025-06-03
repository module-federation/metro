if (!process.env.EXPO_OS) {
  process.env.EXPO_OS = "";
  require("./vendor/expo/async-require");
}

if (process.env.NODE_ENV === "production") {
  function createLoadBundleAsyncMFWrapper() {
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

  global[`${__METRO_GLOBAL_PREFIX__}__loadBundleAsync`] =
    createLoadBundleAsyncMFWrapper();
}
