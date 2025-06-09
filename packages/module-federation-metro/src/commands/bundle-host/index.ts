import type { ConfigT } from "metro-config";
import Server from "metro/src/Server";
import type { RequestOptions } from "metro/src/shared/types";
import loadMetroConfig from "../utils/loadMetroConfig";
import { BundleFederatedHostArgs, BundleFederatedHostConfig } from "./types";
import { CLIError } from "../../utils/errors";

interface CommunityCliPlugin {
  unstable_buildBundleWithConfig: (
    args: BundleFederatedHostArgs,
    config: ConfigT,
    buildBundle: (
      server: Server,
      requestOpts: RequestOptions
    ) => Promise<{ code: string; map: string }>
  ) => Promise<void>;
}

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

  let communityCliPlugin: CommunityCliPlugin;
  try {
    const communityCliPluginPath = require.resolve(
      "@react-native/community-cli-plugin",
      { paths: [cfg.reactNativePath] }
    );
    communityCliPlugin = require(communityCliPluginPath);
  } catch {
    throw new CLIError("Community CLI plugin is not installed.");
  }

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
