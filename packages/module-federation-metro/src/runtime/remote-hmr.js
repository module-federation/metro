function parseUrl(url) {
  const urlPattern = /^((https?):\/\/([^:\/]+)(?::(\d+))?)\/?(.*)?$/;
  const match = url.match(urlPattern);

  if (!match) {
    throw new Error("Invalid URL: " + url);
  }

  const [, origin, scheme, host, port, path] = match;
  return { origin, scheme, host, port, path };
}

function parseSearchParams(searchParams) {
  return searchParams
    .replace(/^\?/, "")
    .split("&")
    .reduce((acc, pair) => {
      if (!pair) return acc;
      const [key, value] = pair
        .split("=")
        .map((part) => part.replace(/\+/g, " "));
      acc[key] = String(value);
      return acc;
    }, {});
}

export function registerBundle(moduleName) {
  const HMRClient = require("react-native/Libraries/Utilities/HMRClient");
  const bundleName = `${moduleName}.bundle`;
  const { origin, path } = parseUrl(
    global.__METRO_FEDERATION__[__METRO_GLOBAL_PREFIX__].location
  );

  const params = parseSearchParams(path.split("?")[1]);
  // modify query params for split non-container bundles
  params.runModule = [false];
  params.modulesOnly = [true];

  const queryParams = new URLSearchParams(params).toString();
  const bundleUrl = `${origin}/${bundleName}?${queryParams}`;
  HMRClient.default.registerBundle(bundleUrl);
}

export function setup() {
  const HMRClient = require("react-native/Libraries/Utilities/HMRClient");
  const platform = require("react-native").Platform.OS;
  const { scheme, host, port, path } = parseUrl(
    global.__METRO_FEDERATION__[__METRO_GLOBAL_PREFIX__].location
  );

  HMRClient.default.setup(platform, path, host, port, true, scheme);
}
