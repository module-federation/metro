import bundleFederatedHost, { bundleFederatedHostOptions } from './bundle-host';
import bundleFederatedRemote, {
  bundleFederatedRemoteOptions,
} from './bundle-remote';

export {
  bundleFederatedHost,
  bundleFederatedHostOptions,
  bundleFederatedRemote,
  bundleFederatedRemoteOptions,
};

export default {
  bundleFederatedHost,
  bundleFederatedHostOptions,
  bundleFederatedRemote,
  bundleFederatedRemoteOptions,
};

export type { BundleFederatedHostArgs } from './bundle-host/types';
export type { BundleFederatedRemoteArgs } from './bundle-remote/types';
export type { Config } from './types';
