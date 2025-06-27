import HMRClient from 'react-native/Libraries/Utilities/HMRClient';

let hmrOrigin: string | null = null;

HMRClient.__originalRegisterBundle = HMRClient.registerBundle;
HMRClient.__originalSetup = HMRClient.setup;

HMRClient.setup = (
  platform: string,
  bundleEntry: string,
  host: string,
  port: number | string,
  isEnabled: boolean,
  scheme = 'http'
) => {
  const serverHost = port !== null && port !== '' ? `${host}:${port}` : host;
  hmrOrigin = `${scheme}://${serverHost}`;

  return HMRClient.__originalSetup(
    platform,
    bundleEntry,
    host,
    port,
    isEnabled,
    scheme
  );
};

HMRClient.registerBundle = (requestUrl: string) => {
  console.log('HMRClient.registerBundle', requestUrl);
  // only process registerBundle calls from the same origin
  if (!requestUrl.includes(hmrOrigin as string)) {
    return;
  }

  return HMRClient.__originalRegisterBundle(requestUrl);
};

export default HMRClient;
