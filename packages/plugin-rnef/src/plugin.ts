import type { PluginApi, PluginOutput } from "@rnef/config";
import { color, logger, RnefError } from "@rnef/tools";
import commands from "module-federation-metro/commands";

type PluginConfig = {
  /**
   * Custom configuration for the Module Federation plugin
   */
  moduleFederation?: {
    /**
     * Default platform to use when not specified in the command
     * @default 'ios'
     */
    defaultPlatform?: string;
  };
};

type BundleArgs = BundleCommandArgs & {
  // Add any custom flags specific to this plugin
  // For example:
  // customFlag?: boolean;
};

export const pluginModuleFederation =
  (pluginConfig: PluginConfig = {}) =>
  (api: PluginApi): PluginOutput => {
    // Register the bundle-mf-remote command
    api.registerCommand({
      name: "bundle-mf-remote",
      description:
        "Bundles a Module Federation remote, including its container entry and all exposed modules for consumption by host applications",
      action: async (args: BundleArgs) => {
        if (!args.entryFile) {
          throw new RnefError(
            '"rnef bundle-mf-remote" command is missing required "--entry-file" argument.'
          );
        }

        const root = api.getProjectRoot();
        const platforms = api.getPlatforms();

        // Set default platform if not provided
        if (!args.platform) {
          args.platform =
            pluginConfig.moduleFederation?.defaultPlatform || "ios";
          logger.info(
            `No platform specified, using default: ${color.cyan(args.platform)}`
          );
        }

        logger.info(
          `Bundling Module Federation remote from ${color.cyan(
            args.entryFile
          )} for platform ${color.cyan(args.platform)}`
        );

        try {
          // Execute the bundle command
          await bundleFederatedRemote([], { root, platforms }, args);

          logger.success(
            `Successfully bundled Module Federation remote at: ${color.cyan(
              args.entryFile
            )}`
          );
        } catch (error) {
          logger.error("Failed to bundle Module Federation remote:");
          throw error;
        }
      },
      options: [
        // Pass through all the options from module-federation-metro
        ...options,
        // Add any additional options specific to this plugin
        // {
        //   name: '--custom-flag',
        //   description: 'Custom flag description',
        // },
      ],
    });

    return {
      name: "@module-federation/metro-plugin-rnef",
      description: "RNEF plugin for Module Federation with Metro",
    };
  };

export default pluginModuleFederation;
