import Server from 'metro/src/Server';
import type { RequestOptions } from 'metro/src/shared/types';
import { VIRTUAL_HOST_ENTRY_NAME } from '../../plugin/constants';
import type { ModuleFederationConfigNormalized } from '../../types';
import type { Config } from '../types';
import { getCommunityCliPlugin } from '../utils/get-community-plugin';
import loadMetroConfig from '../utils/load-metro-config';
import { saveBundleAndMap } from '../utils/save-bundle-and-map';
import type { BundleFederatedHostArgs } from './types';

declare global {
  var __METRO_FEDERATION_CONFIG: ModuleFederationConfigNormalized;
  var __METRO_FEDERATION_ORIGINAL_ENTRY_PATH: string | undefined;
  var __METRO_FEDERATION_REMOTE_ENTRY_PATH: string | undefined;
  var __METRO_FEDERATION_MANIFEST_PATH: string | undefined;
}

async function bundleFederatedHost(
  _argv: Array<string>,
  cfg: Config,
  args: BundleFederatedHostArgs
): Promise<void> {
  // expose original entrypoint
  global.__METRO_FEDERATION_ORIGINAL_ENTRY_PATH = args.entryFile;

  // use virtual host entrypoint
  args.entryFile = VIRTUAL_HOST_ENTRY_NAME;

  const config = await loadMetroConfig(cfg, {
    maxWorkers: args.maxWorkers,
    resetCache: args.resetCache,
    config: args.config,
  });

  const communityCliPlugin = getCommunityCliPlugin(cfg.reactNativePath);

  const buildBundleWithConfig =
    communityCliPlugin.unstable_buildBundleWithConfig;

  return buildBundleWithConfig(args, config, {
    build: (server: Server, requestOpts: RequestOptions) => {
      // setup enhance middleware to trigger virtual modules setup
      config.server.enhanceMiddleware(server.processRequest, server);
      return server.build({
        ...Server.DEFAULT_BUNDLE_OPTIONS,
        ...requestOpts,
        bundleType: 'bundle',
      });
    },
    save: saveBundleAndMap,
    formatName: 'bundle',
  });
}

export default bundleFederatedHost;

export { default as bundleFederatedHostOptions } from './options';
