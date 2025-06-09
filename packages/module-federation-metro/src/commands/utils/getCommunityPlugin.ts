import type { ConfigT } from "metro-config";
import type Server from "metro/src/Server";
import type { RequestOptions } from "metro/src/shared/types";
import { CLIError } from "../../utils/errors";

interface CommunityCliPlugin {
  bundleCommand: any;
  startCommand: any;
  unstable_buildBundleWithConfig: (
    args: any,
    config: ConfigT,
    buildBundle: (
      server: Server,
      requestOpts: RequestOptions
    ) => Promise<{ code: string; map: string }>
  ) => Promise<void>;
}

export function getCommunityCliPlugin(reactNativePath?: string) {
  let communityCliPlugin: CommunityCliPlugin;
  try {
    const communityCliPluginPath = require.resolve(
      "@react-native/community-cli-plugin",
      { paths: [reactNativePath ?? require.resolve("react-native")] }
    );
    communityCliPlugin = require(communityCliPluginPath);
  } catch {
    throw new CLIError("Community CLI plugin is not installed.");
  }
  return communityCliPlugin;
}
