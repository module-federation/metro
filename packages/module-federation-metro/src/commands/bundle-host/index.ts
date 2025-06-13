import Server from 'metro/src/Server';
import type { RequestOptions } from 'metro/src/shared/types';
import type { Config } from '../types.js';
import { getCommunityCliPlugin } from '../utils/getCommunityPlugin.js';
import loadMetroConfig from '../utils/loadMetroConfig.js';
import { saveBundleAndMap } from '../utils/saveBundleAndMap.js';
import type { BundleFederatedHostArgs } from './types.js';

async function bundleFederatedHost(
  _argv: Array<string>,
  cfg: Config,
  args: BundleFederatedHostArgs
): Promise<void> {
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

export { default as bundleFederatedHostOptions } from './options.js';
