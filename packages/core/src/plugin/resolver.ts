import path from 'node:path';
import type { CustomResolver, Resolution } from 'metro-resolver';
import type { ModuleFederationConfigNormalized } from '../types';
import type { VirtualModuleManager } from '../utils';
import {
  ASYNC_REQUIRE,
  INIT_HOST,
  REMOTE_HMR_SETUP,
  REMOTE_MODULE_REGISTRY,
} from './constants';
import {
  getInitHostModule,
  getRemoteEntryModule,
  getRemoteHMRSetupModule,
  getRemoteModule,
  getRemoteModuleRegistryModule,
} from './generators';
import { isUsingMFBundleCommand } from './helpers';

interface CreateResolveRequestOptions {
  isRemote: boolean;
  paths: {
    initHost: string;
    asyncRequire: string;
    registry: string;
    remoteHMRSetup: string;
    remoteEntry: string;
    mfMetro: string;
  };
  options: ModuleFederationConfigNormalized;
  vmManager: VirtualModuleManager;
}

export function createResolveRequest({
  vmManager,
  options,
  paths,
  isRemote,
}: CreateResolveRequestOptions): CustomResolver {
  return function resolveRequest(context, moduleName, platform) {
    // virtual module: init-host
    if (moduleName === INIT_HOST) {
      const initHostGenerator = () => getInitHostModule(options);
      vmManager.registerVirtualModule(paths.initHost, initHostGenerator);
      return { type: 'sourceFile', filePath: paths.initHost as string };
    }

    // virtual module: async-require
    if (moduleName === ASYNC_REQUIRE) {
      return { type: 'sourceFile', filePath: paths.asyncRequire };
    }

    // virtual module: remote-module-registry
    if (moduleName === REMOTE_MODULE_REGISTRY) {
      const registryGenerator = () => getRemoteModuleRegistryModule();
      vmManager.registerVirtualModule(paths.registry, registryGenerator);
      return { type: 'sourceFile', filePath: paths.registry };
    }

    // virtual module: remote-hmr
    if (moduleName === REMOTE_HMR_SETUP) {
      const remoteHMRSetupGenerator = () => getRemoteHMRSetupModule();
      vmManager.registerVirtualModule(
        paths.remoteHMRSetup,
        remoteHMRSetupGenerator
      );
      return { type: 'sourceFile', filePath: paths.remoteHMRSetup as string };
    }

    // virtual entrypoint to create MF containers
    // MF options.filename is provided as a name only and will be requested from the root of project
    // so the filename mini.js becomes ./mini.js and we need to match exactly that
    if (moduleName === `./${path.basename(paths.remoteEntry)}`) {
      const remoteEntryGenerator = () => getRemoteEntryModule(options);
      vmManager.registerVirtualModule(paths.remoteEntry, remoteEntryGenerator);
      return { type: 'sourceFile', filePath: paths.remoteEntry as string };
    }

    // shared modules handling in init-host.js
    if ([paths.initHost].includes(context.originModulePath)) {
      // init-host contains definition of shared modules so we need to prevent
      // circular import of shared module, by allowing import shared dependencies directly
      return context.resolveRequest(context, moduleName, platform);
    }

    // shared modules handling in remote-entry.js
    if ([paths.remoteEntry].includes(context.originModulePath)) {
      const sharedModule = options.shared[moduleName];
      // import: false means that the module is marked as external
      if (sharedModule && sharedModule.import === false) {
        const sharedPath = getSharedPath(moduleName, paths.mfMetro);
        return { type: 'sourceFile', filePath: sharedPath };
      }
      return context.resolveRequest(context, moduleName, platform);
    }

    // remote modules
    for (const remoteName of Object.keys(options.remotes)) {
      if (moduleName.startsWith(remoteName + '/')) {
        const remotePath = getRemoteModulePath(moduleName, paths.mfMetro);
        const remoteGenerator = () => getRemoteModule(moduleName);
        vmManager.registerVirtualModule(remotePath, remoteGenerator);
        return { type: 'sourceFile', filePath: remotePath };
      }
    }

    // shared module handling
    for (const sharedName of Object.keys(options.shared)) {
      const importName = options.shared[sharedName].import || sharedName;
      // module import
      if (moduleName === importName) {
        const sharedPath = getSharedPath(moduleName, paths.mfMetro);
        const sharedGenerator = () => getRemoteModule(moduleName);
        vmManager.registerVirtualModule(sharedPath, sharedGenerator);
        return { type: 'sourceFile', filePath: sharedPath };
      }
    }

    // replace getDevServer module in remote with our own implementation
    if (isRemote && moduleName.endsWith('getDevServer')) {
      const res = context.resolveRequest(context, moduleName, platform);
      const from = /react-native\/Libraries\/Core\/Devtools\/getDevServer\.js$/;
      const to = resolveModule('getDevServer.ts');
      return replaceModule(from, to)(res);
    }

    // replace HMRClient module with HMRClientShim when using bundle commands
    if (isUsingMFBundleCommand() && moduleName.endsWith('HMRClient')) {
      const res = context.resolveRequest(context, moduleName, platform);
      const from = /react-native\/Libraries\/Utilities\/HMRClient\.js$/;
      const to = resolveModule('HMRClientShim.ts');
      return replaceModule(from, to)(res);
    }

    return context.resolveRequest(context, moduleName, platform);
  };
}

function getSharedPath(name: string, dir: string) {
  const sharedModuleName = name.replaceAll('/', '_');
  const sharedModuleDir = path.join(dir, 'shared');
  return path.join(sharedModuleDir, `${sharedModuleName}.js`);
}

function getRemoteModulePath(name: string, dir: string) {
  const remoteModuleName = name.replaceAll('/', '_');
  const remoteModuleDir = path.join(dir, 'remote');
  return path.join(remoteModuleDir, `${remoteModuleName}.js`);
}

function resolveModule(moduleName: string): string {
  return path.resolve(__dirname, `../modules/${moduleName}`);
}

function replaceModule(from: RegExp, to: string) {
  return (resolved: Resolution): Resolution => {
    if (resolved.type === 'sourceFile' && from.test(resolved.filePath)) {
      return { type: 'sourceFile', filePath: to };
    }
    return resolved;
  };
}
