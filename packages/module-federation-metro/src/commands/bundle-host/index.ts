import Server from "metro/src/Server";
import type { RequestOptions } from "metro/src/shared/types";
import { getCommunityCliPlugin } from "../utils/getCommunityPlugin";
import loadMetroConfig from "../utils/loadMetroConfig";
import type {
  BundleFederatedHostArgs,
  BundleFederatedHostConfig,
} from "./types";

async function bundleFederatedHost(
  _argv: Array<string>,
  cfg: BundleFederatedHostConfig,
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

  return buildBundleWithConfig(
    args,
    config,
    (server: Server, requestOpts: RequestOptions) => {
      // setup enhance middleware to trigger virtual modules setup
      config.server.enhanceMiddleware(server.processRequest, server);
      return server.build({
        ...Server.DEFAULT_BUNDLE_OPTIONS,
        ...requestOpts,
        bundleType: "bundle",
      });
    }
  );
}

export default bundleFederatedHost;

export { default as bundleFederatedHostOptions } from "./options";
