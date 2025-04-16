declare module "react-native/Libraries/Utilities/HMRClient" {
  export default class HMRClient {
    static registerBundle(bundlePath: string): void;
  }
}

declare module "react-native/Libraries/Core/Devtools/getDevServer" {
  export default function getDevServer(): {
    url: string;
  };
}
