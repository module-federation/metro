import HMRClient from 'react-native/Libraries/Utilities/HMRClient';

let hmrOrigin: string | null = null;

HMRClient.__originalRegisterBundle = HMRClient.registerBundle;
HMRClient.__originalSetup = HMRClient.setup;

HMRClient.setup = (config: any) => {
  const serverHost =
    config.port !== null && config.port !== ''
      ? `${config.host}:${config.port}`
      : config.host;
  hmrOrigin = `${config.scheme}://${serverHost}`;

  HMRClient.__originalSetup(config);
};

HMRClient.registerBundle = (requestUrl: string) => {
  // only process registerBundle calls from the same origin
  if (!requestUrl.startsWith(hmrOrigin as string)) {
    return;
  }

  HMRClient.__originalRegisterBundle(requestUrl);
};

export default HMRClient;
