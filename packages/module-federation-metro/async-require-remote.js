if (!process.env.EXPO_OS) {
  process.env.EXPO_OS = "";
  require("./vendor/expo/async-require");
}

if (process.env.NODE_ENV === "production") {
  function loadBundleAsyncMFWrapper(bundlePath) {
    function joinComponents(prefix, suffix) {
      return prefix.replace(/\/+$/, "") + "/" + suffix.replace(/^\/+/, "");
    }

    function getPublicPath(url) {
      return url.split("/").slice(0, -1).join("/");
    }

    const loadBundleAsync =
      global[`${__METRO_GLOBAL_PREFIX__ ?? ""}__loadBundleAsync`];

    const remoteEntry =
      global.__METRO_FEDERATION__[__METRO_GLOBAL_PREFIX__].location;

    // resolve the remote bundle path based on the remote location
    const remoteBundlePath = joinComponents(
      getPublicPath(remoteEntry),
      bundlePath
    );

    return loadBundleAsync(remoteBundlePath);
  }

  global[`${__METRO_GLOBAL_PREFIX__}__loadBundleAsync`] =
    loadBundleAsyncMFWrapper;
}
