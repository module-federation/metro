import type { PluginApi, PluginOutput } from "@rnef/config";
import { color, logger, outro } from "@rnef/tools";
import metroFederation from "module-federation-metro";
import commands from "module-federation-metro/commands";
import type {
  BundleFederatedHostArgs,
  BundleFederatedRemoteArgs,
} from "module-federation-metro/commands";
import { zephyrCommandWrapper as createZephyrCommand } from "zephyr-metro-plugin";

interface PluginConfig {
  platforms?: Record<string, object>;
}

export const zephyrMetroRNEFPlugin =
  (pluginConfig: PluginConfig = {}) =>
  (api: PluginApi): PluginOutput => {
    // Register the bundle-mf-host command
    api.registerCommand({
      name: "bundle-mf-host",
      description: "Bundles a Module Federation host with Zephyr Cloud",
      action: async (args: BundleFederatedHostArgs) => {
        const commandConfig = {
          root: api.getProjectRoot(),
          platforms: api.getPlatforms(),
          reactNativePath: api.getReactNativePath(),
          ...pluginConfig,
        };

        logger.info(
          `Bundling Module Federation host for platform ${color.cyan(
            args.platform
          )} with Zephyr Cloud`
        );

        let bundleZephyrHostCommand = await createZephyrCommand(
          commands.bundleFederatedHost,
          commands.loadMetroConfig,
          () => {
            metroFederation.updateManifest(
              global.__METRO_FEDERATION_MANIFEST_PATH!,
              global.__METRO_FEDERATION_CONFIG
            );
          }
        );

        await bundleZephyrHostCommand([{ ...args }], commandConfig, args);
        logger.info("Bundle artifacts available at ...");
        outro(`Success 🎉.`);
      },
      options: commands.bundleFederatedHostOptions,
    });

    // Register the bundle-mf-remote command
    api.registerCommand({
      name: "bundle-mf-remote",
      description: "Bundles a Module Federation remote with Zephyr Cloud",
      action: async (args: BundleFederatedRemoteArgs) => {
        const commandConfig = {
          root: api.getProjectRoot(),
          platforms: api.getPlatforms(),
          reactNativePath: api.getReactNativePath(),
          ...pluginConfig,
        };

        logger.info(
          `Bundling Module Federation remote for platform ${color.cyan(
            args.platform
          )} with Zephyr Cloud`
        );

        let bundleZephyrRemoteCommand = await createZephyrCommand(
          commands.bundleFederatedRemote,
          commands.loadMetroConfig,
          () => {
            metroFederation.updateManifest(
              global.__METRO_FEDERATION_MANIFEST_PATH!,
              global.__METRO_FEDERATION_CONFIG
            );
          }
        );

        await bundleZephyrRemoteCommand([{ ...args }], commandConfig, args);
        logger.info("Bundle artifacts available at ...");
        outro(`Success 🎉.`);
      },
      options: commands.bundleFederatedRemoteOptions,
    });

    return {
      name: "@module-federation/metro-plugin-rnef",
      description: "RNEF plugin for Module Federation with Metro",
    };
  };
