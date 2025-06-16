import type { PluginApi, PluginOutput } from '@rnef/config';
import { color, logger, outro } from '@rnef/tools';
import commands from 'module-federation-metro/commands';

interface PluginConfig {
  platforms?: Record<string, object>;
}

export const pluginMetroModuleFederation =
  (pluginConfig: PluginConfig = {}) =>
  (api: PluginApi): PluginOutput => {
    // Register the bundle-mf-host command
    api.registerCommand({
      name: 'bundle-mf-host',
      description: 'Bundles a Module Federation host',
      action: async (args: commands.BundleFederatedHostArgs) => {
        const commandConfig = {
          root: api.getProjectRoot(),
          platforms: api.getPlatforms(),
          reactNativePath: api.getReactNativePath(),
          ...pluginConfig,
        };

        logger.info(
          `Bundling Module Federation host for platform ${color.cyan(
            args.platform
          )}`
        );

        await commands.bundleFederatedHost([], commandConfig, args);
        logger.info('Bundle artifacts available at ...');
        outro('Success 🎉.');
      },
      options: commands.bundleFederatedHostOptions,
    });

    // Register the bundle-mf-remote command
    api.registerCommand({
      name: 'bundle-mf-remote',
      description:
        'Bundles a Module Federation remote, including its container entry and all exposed modules for consumption by host applications',
      action: async (args: commands.BundleFederatedRemoteArgs) => {
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

        await commands.bundleFederatedRemote([], commandConfig, args);
        logger.info('Bundle artifacts available at ...');
        outro('Success 🎉.');
      },
      options: commands.bundleFederatedRemoteOptions,
    });

    return {
      name: '@module-federation/metro-plugin-rnef',
      description: 'RNEF plugin for Module Federation with Metro',
    };
  };
