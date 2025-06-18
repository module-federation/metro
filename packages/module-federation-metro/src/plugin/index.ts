import path from 'node:path';
import chalk from 'chalk';
import type { ConfigT } from 'metro-config';
import type {
  ModuleFederationConfig,
  ModuleFederationConfigNormalized,
} from '../types';
import { VirtualModuleManager } from '../utils';
import {
  createMFRuntimeNodeModules,
  isUsingMFCommand,
  replaceExtension,
  stubRemoteEntry,
} from './helpers';
import { createManifest } from './manifest';
import { normalizeOptions } from './normalize-options';
import { createResolveRequest } from './resolver';
import { createRewriteRequest } from './rewrite-request.js';
import { createBabelTransformer } from './runtime-modules';
import { getModuleFederationSerializer } from './serializer';
import { validateOptions } from './validate-options';

declare global {
  var __METRO_FEDERATION_CONFIG: ModuleFederationConfigNormalized;
  var __METRO_FEDERATION_REMOTE_ENTRY_PATH: string | undefined;
  var __METRO_FEDERATION_MANIFEST_PATH: string | undefined;
}

export function withModuleFederation(
  config: ConfigT,
  federationOptions: ModuleFederationConfig
): ConfigT {
  if (isUsingMFCommand()) {
    return augmentConfig(config, federationOptions);
  }

  console.warn(
    chalk.yellow(
      'Warning: Module Federation build is disabled for this command.\n'
    ) +
      chalk.yellow(
        'To enable Module Federation, please use one of the dedicated bundle commands:\n'
      ) +
      ` ${chalk.dim('•')} bundle-mf-host` +
      chalk.dim(' - for bundling a host application\n') +
      ` ${chalk.dim('•')} bundle-mf-remote` +
      chalk.dim(' - for bundling a remote application\n')
  );

  return config;
}

function augmentConfig(
  config: ConfigT,
  federationOptions: ModuleFederationConfig
): ConfigT {
  const isHost = !federationOptions.exposes;
  const isRemote = !isHost;

  const options = normalizeOptions(federationOptions, config);

  validateOptions(options);

  const vmManager = new VirtualModuleManager(config);

  const projectNodeModulesPath = path.resolve(
    config.projectRoot,
    'node_modules'
  );

  const mfMetroPath = createMFRuntimeNodeModules(projectNodeModulesPath);

  // auto-inject 'metro-core-plugin' MF runtime plugin
  options.plugins = [
    require.resolve('./modules/metroCorePlugin.ts'),
    ...options.plugins,
  ].map((plugin) => path.relative(mfMetroPath, plugin));

  const initHostPath = path.resolve(mfMetroPath, 'init-host.js');
  const registryPath = path.resolve(mfMetroPath, 'remote-module-registry.js');

  const remoteEntryFilename = replaceExtension(options.filename, '.js');
  const remoteEntryPath = path.resolve(mfMetroPath, remoteEntryFilename);
  const remoteHMRSetupPath = path.resolve(mfMetroPath, 'remote-hmr.js');

  const asyncRequirePath = path.resolve(__dirname, './modules/asyncRequire.ts');

  const babelTransformerPath = createBabelTransformer({
    proxiedBabelTrasnsformerPath: config.transformer.babelTransformerPath,
    mfMetroPath,
    mfConfig: options,
    blacklistedPaths: [initHostPath, remoteEntryPath],
  });

  const manifestPath = createManifest(options, mfMetroPath);

  // remote entry is an entrypoint so it needs to be in the filesystem
  // we create a stub on the filesystem and then redirect to a virtual module
  stubRemoteEntry(remoteEntryPath);

  // pass data to bundle-mf-remote command
  global.__METRO_FEDERATION_CONFIG = options;
  global.__METRO_FEDERATION_REMOTE_ENTRY_PATH = remoteEntryPath;
  global.__METRO_FEDERATION_MANIFEST_PATH = manifestPath;

  return {
    ...config,
    serializer: {
      ...config.serializer,
      customSerializer: getModuleFederationSerializer(options),
      getModulesRunBeforeMainModule: () => {
        return isHost ? [initHostPath] : [];
      },
      getRunModuleStatement: (moduleId: number | string) => {
        return `${options.name}__r(${JSON.stringify(moduleId)});`;
      },
      getPolyfills: (options) => {
        return isHost ? config.serializer.getPolyfills(options) : [];
      },
    },
    transformer: {
      ...config.transformer,
      globalPrefix: options.name,
      babelTransformerPath: babelTransformerPath,
      getTransformOptions: vmManager.getTransformOptions(),
    },
    resolver: {
      ...config.resolver,
      resolveRequest: createResolveRequest({
        isRemote,
        vmManager,
        options,
        paths: {
          initHost: initHostPath,
          asyncRequire: asyncRequirePath,
          registry: registryPath,
          remoteHMRSetup: remoteHMRSetupPath,
          remoteEntry: remoteEntryPath,
          mfMetro: mfMetroPath,
        },
      }),
    },
    server: {
      ...config.server,
      enhanceMiddleware: vmManager.getMiddleware(),
      rewriteRequestUrl: createRewriteRequest({
        options,
        config,
        manifestPath,
      }),
    },
  };
}
