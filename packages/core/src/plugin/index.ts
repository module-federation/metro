import path from 'node:path';
import chalk from 'chalk';
import type { ConfigT } from 'metro-config';
import type {
  ModuleFederationConfig,
  ModuleFederationConfigNormalized,
} from '../types';
import { VirtualModuleManager } from '../utils';
import { createBabelTransformer } from './babel-transformer';
import {
  isUsingMFCommand,
  prepareTmpDir,
  replaceExtension,
  stubHostEntry,
  stubRemoteEntry,
} from './helpers';
import { createManifest } from './manifest';
import { normalizeOptions } from './normalize-options';
import { createResolveRequest } from './resolver';
import { createRewriteRequest } from './rewrite-request';
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

  const tmpDirPath = prepareTmpDir(config.projectRoot);
  const options = normalizeOptions(federationOptions, {
    projectRoot: config.projectRoot,
    tmpDirPath,
  });

  validateOptions(options);

  const vmManager = new VirtualModuleManager(config);

  const hostEntryPath = path.resolve(tmpDirPath, 'hostEntry.js');
  const initHostPath = path.resolve(tmpDirPath, 'init-host.js');

  const remoteEntryFilename = replaceExtension(options.filename, '.js');
  const remoteEntryPath = path.resolve(tmpDirPath, remoteEntryFilename);
  const remoteHMRSetupPath = path.resolve(tmpDirPath, 'remote-hmr.js');
  const remoteModuleRegistryPath = path.resolve(
    tmpDirPath,
    'remote-module-registry.js'
  );

  const asyncRequirePath = require.resolve('../modules/asyncRequire.ts');

  const babelTransformerPath = createBabelTransformer({
    blacklistedPaths: [initHostPath, remoteEntryPath],
    federationConfig: options,
    originalBabelTransformerPath: config.transformer.babelTransformerPath,
    tmpDirPath: tmpDirPath,
  });

  const manifestPath = createManifest(options, tmpDirPath);

  // host & remote entry is are entrypoints so they needs to be present in the filesystem
  // we create stubs on the filesystem and then redirect corresponding virtual modules
  stubHostEntry(hostEntryPath);
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
          asyncRequire: asyncRequirePath,
          hostEntry: hostEntryPath,
          initHost: initHostPath,
          remoteModuleRegistry: remoteModuleRegistryPath,
          remoteHMRSetup: remoteHMRSetupPath,
          remoteEntry: remoteEntryPath,
          projectDir: config.projectRoot,
          tmpDir: tmpDirPath,
        },
      }),
    },
    server: {
      ...config.server,
      enhanceMiddleware: vmManager.getMiddleware(),
      rewriteRequestUrl: createRewriteRequest({
        options,
        config,
        hostEntryPath,
        manifestPath,
      }),
    },
  };
}
