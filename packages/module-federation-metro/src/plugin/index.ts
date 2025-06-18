import fs from 'node:fs';
import path from 'node:path';
import type { ConfigT } from 'metro-config';
import type {
  ModuleFederationConfig,
  ModuleFederationConfigNormalized,
} from '../types';
import { VirtualModuleManager } from '../utils';
import {
  isUsingMFCommand,
  mfDisabledWarning,
  replaceExtension,
} from './helpers';
import { createManifest } from './manifest';
import { normalizeOptions } from './normalize';
import createResolveRequest from './resolver';
import { createRewriteRequest } from './rewrite-request.js';
import { createBabelTransformer } from './runtime-modules';
import { getModuleFederationSerializer } from './serializer';
import { validateOptions } from './validate';

declare global {
  var __METRO_FEDERATION_CONFIG: ModuleFederationConfigNormalized;
  var __METRO_FEDERATION_REMOTE_ENTRY_PATH: string | undefined;
  var __METRO_FEDERATION_MANIFEST_PATH: string | undefined;
}

function createMFRuntimeNodeModules(projectNodeModulesPath: string) {
  const mfMetroPath = path.join(projectNodeModulesPath, '.mf-metro');
  fs.rmSync(mfMetroPath, { recursive: true, force: true });
  fs.mkdirSync(mfMetroPath, { recursive: true });
  return mfMetroPath;
}

function stubRemoteEntry(remoteEntryPath: string) {
  const remoteEntryModule = '// remote entry stub';
  fs.writeFileSync(remoteEntryPath, remoteEntryModule, 'utf-8');
}

function withModuleFederation(
  config: ConfigT,
  federationOptions: ModuleFederationConfig
): ConfigT {
  if (!isUsingMFCommand()) {
    mfDisabledWarning();
    return config;
  }

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

export { withModuleFederation };
