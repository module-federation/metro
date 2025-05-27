export default function getDevServer() {
  const scriptUrl =
    global.__METRO_FEDERATION__[__METRO_GLOBAL_PREFIX__].location;

  if (!scriptUrl) {
    throw new Error(
      `Cannot determine dev server URL for ${__METRO_GLOBAL_PREFIX__} remote`
    );
  }

  return {
    url: scriptUrl.match(/^https?:\/\/.*?\//)[0],
    fullBundleUrl: scriptUrl,
  };
}
