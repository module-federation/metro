function loadBundleAsyncMFWrapper(bundlePath) {
  function joinComponents(prefix, suffix) {
    return prefix.replace(/\/+$/, "") + "/" + suffix.replace(/^\/+/, "");
  }

  function getPublicPath(url) {
    return url.split("/").slice(0, -1).join("/");
  }

  // grab the global loadBundleAsync from host
  const loadBundleAsync =
    global[`${global.__METRO_GLOBAL_PREFIX__ ?? ""}__loadBundleAsync`];

  if (!loadBundleAsync) {
    throw new Error("loadBundleAsync is not defined in host");
  }

  const remoteEntry =
    global.__METRO_FEDERATION__[__METRO_GLOBAL_PREFIX__].location;

  // resolve the remote bundle path based on the remote public path
  const remoteBundlePath = joinComponents(
    getPublicPath(remoteEntry),
    bundlePath
  );

  return loadBundleAsync(remoteBundlePath);
}

global[`${__METRO_GLOBAL_PREFIX__}__loadBundleAsync`] =
  loadBundleAsyncMFWrapper;
