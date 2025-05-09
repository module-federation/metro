function loadBundleAsyncMFWrapper(bundlePath) {
  function joinComponents(prefix, suffix) {
    return prefix.replace(/\/+$/, "") + "/" + suffix.replace(/^\/+/, "");
  }

  // grab the global loadBundleAsync from host
  const loadBundleAsync =
    global[`${global.__METRO_GLOBAL_PREFIX__ ?? ""}__loadBundleAsync`];

  if (!loadBundleAsync) {
    throw new Error("loadBundleAsync is not defined in host");
  }

  // resolve the remote bundle path based on the remote location
  const remoteBundlePath = joinComponents(
    global.__METRO_FEDERATION__[__METRO_GLOBAL_PREFIX__].location,
    bundlePath
  );

  return loadBundleAsync(remoteBundlePath);
}

global[`${__METRO_GLOBAL_PREFIX__}__loadBundleAsync`] =
  loadBundleAsyncMFWrapper;
