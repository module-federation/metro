declare global {
  var __loadBundleAsync: (entry: string) => Promise<void>;
}

interface FederationScope {
  location?: string;
  dependencies: {
    shared: Record<string, string[]>;
    remotes: Record<string, string[]>;
  };
}

// join two paths
// e.g. /a/b/ + /c/d -> /a/b/c/d
function joinComponents(prefix: string, suffix: string) {
  return prefix.replace(/\/+$/, "") + "/" + suffix.replace(/^\/+/, "");
}

// get the public path from the url
// e.g. http://host:8081/a/b.bundle -> http://host:8081/a
function getPublicPath(url: string) {
  return url.split("/").slice(0, -1).join("/");
}

// get bundle id from the url path
// e.g. /a/b.bundle?platform=ios -> a/b
function getBundleId(urlPath: string) {
  const [bundlePath] = urlPath.split("?");
  return bundlePath.slice(1).replace(".bundle", "");
}

function isUrl(url: string) {
  return url.match(/^https?:\/\//);
}

function isSameOrigin(url: string, origin?: string) {
  return origin && url.startsWith(origin);
}

// prefix the bundle path with the public path
// e.g. /a/b.bundle -> http://host:8081/a/b.bundle
function getBundlePath(bundlePath: string, bundleOrigin?: string) {
  // don't modify the path in development
  if (process.env.NODE_ENV !== "production") {
    return bundlePath;
  }
  // don't modify fully qualified urls
  // e.g. when loading container modules
  if (isUrl(bundlePath)) {
    return bundlePath;
  }
  // don't modify the path if we don't know the bundle origin
  // e.g. when loading host split bundles
  if (!bundleOrigin) {
    return bundlePath;
  }
  return joinComponents(getPublicPath(bundleOrigin), bundlePath);
}

export function buildLoadBundleAsyncWrapper() {
  const registry = require("mf:remote-module-registry");

  const __loadBundleAsync =
    // @ts-expect-error dynamic key access on global object
    global[`${__METRO_GLOBAL_PREFIX__ ?? ""}__loadBundleAsync`];

  const loadBundleAsync = __loadBundleAsync as typeof global.__loadBundleAsync;

  return async (originalBundlePath: string) => {
    const scope = global.__METRO_FEDERATION__[
      __METRO_GLOBAL_PREFIX__
    ] as FederationScope;

    const bundlePath = getBundlePath(originalBundlePath, scope.location);

    // ../../node_modules/ -> ..%2F..%2Fnode_modules/ so that it's not automatically sanitized
    const encodedBundlePath = bundlePath.replaceAll("../", "..%2F");

    const result = await loadBundleAsync(encodedBundlePath);

    // when the origin is not the same, it means we are loading a remote container
    // we can return early since dependencies are processed differently for entry bundles
    if (!isSameOrigin(bundlePath, scope.location)) {
      return result;
    }

    // at this point the code in the bundle has been evaluated
    // but not yet executed through metroRequire
    const bundleId = getBundleId(originalBundlePath);
    const shared = scope.dependencies.shared[bundleId];
    const remotes = scope.dependencies.remotes[bundleId];

    const promises = [];
    if (shared && shared.length > 0) {
      // load shared used synchronously in the bundle
      promises.push(...shared.map(registry.loadSharedToRegistry));
    }
    if (remotes && remotes.length > 0) {
      // load remotes used synchronously in the bundle
      promises.push(...remotes.map(registry.loadRemoteToRegistry));
    }

    await Promise.all(promises);

    return result;
  };
}
