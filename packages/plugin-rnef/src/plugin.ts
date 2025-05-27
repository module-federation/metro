import type { PluginApi, PluginOutput } from "@rnef/config";
import { color, logger, outro } from "@rnef/tools";
import commands from "module-federation-metro/commands";

interface PluginConfig {
  platforms?: Record<string, object>;
}

const bundleFederatedRemote = commands[0];

type BundleRemoteArgs = Parameters<(typeof bundleFederatedRemote)["func"]>[2];

export const pluginMetroModuleFederation =
  (pluginConfig: PluginConfig = {}) =>
  (api: PluginApi): PluginOutput => {
    // Register the bundle-mf-remote command
    api.registerCommand({
      name: "bundle-mf-remote",
      description:
        "Bundles a Module Federation remote, including its container entry and all exposed modules for consumption by host applications",
      action: async (args: BundleRemoteArgs) => {
        const commandConfig = {
          root: api.getProjectRoot(),
          platforms: api.getPlatforms(),
          reactNativePath: api.getReactNativePath(),
          ...pluginConfig,
        };

        logger.info(
          `Bundling Module Federation remote for platform ${color.cyan(
            args.platform
          )}`
        );

        await bundleFederatedRemote.func([], commandConfig, args);
        logger.info("Bundle artifacts available at ...");
        outro(`Success 🎉.`);
      },
      options: bundleFederatedRemote.options,
    });

    return {
      name: "@module-federation/metro-plugin-rnef",
      description: "RNEF plugin for Module Federation with Metro",
    };
  };
