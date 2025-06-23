import path from 'node:path';
import type { Module, ReadOnlyGraph, SerializerOptions } from 'metro';
import type { SerializerConfigT } from 'metro-config';
import baseJSBundle from 'metro/src/DeltaBundler/Serializers/baseJSBundle';
import CountingSet from 'metro/src/lib/CountingSet';
import bundleToString from 'metro/src/lib/bundleToString';
import type { ModuleFederationConfigNormalized, Shared } from '../types';

type CustomSerializer = SerializerConfigT['customSerializer'];

export function getModuleFederationSerializer(
  mfConfig: ModuleFederationConfigNormalized
): CustomSerializer {
  return async (entryPoint, preModules, graph, options) => {
    const syncRemoteModules = collectSyncRemoteModules(graph, mfConfig.remotes);
    const syncSharedModules = collectSyncSharedModules(graph, mfConfig.shared);
    // main entrypoints always have runModule set to true
    if (options.runModule === true) {
      const finalPreModules = [
        getEarlyShared(syncSharedModules),
        getEarlyRemotes(syncRemoteModules),
        ...preModules,
      ];
      return getBundleCode(entryPoint, finalPreModules, graph, options);
    }

    // skip non-project source like node_modules
    if (!isProjectSource(entryPoint, options.projectRoot)) {
      return getBundleCode(entryPoint, preModules, graph, options);
    }

    const bundlePath = getBundlePath(entryPoint, options.projectRoot);
    const finalPreModules = [
      getSyncShared(syncSharedModules, bundlePath, mfConfig.name),
      getSyncRemotes(syncRemoteModules, bundlePath, mfConfig.name),
    ];

    // include the original preModules if not in modulesOnly mode
    if (options.modulesOnly === false) {
      finalPreModules.push(...preModules);
    }

    // prevent resetting preModules in metro/src/DeltaBundler/Serializers/baseJSBundle.js
    const finalOptions = { ...options, modulesOnly: false };
    return getBundleCode(entryPoint, finalPreModules, graph, finalOptions);
  };
}

function collectSyncRemoteModules(
  graph: ReadOnlyGraph,
  _remotes: Record<string, string>
) {
  const remotes = new Set(Object.keys(_remotes));
  const syncRemoteModules = new Set<string>();
  for (const [, module] of graph.dependencies) {
    for (const dependency of module.dependencies.values()) {
      // null means it's a sync dependency
      if (dependency.data.data.asyncType !== null) {
        continue;
      }
      // remotes always follow format of <remoteName>/<exposedModule>
      const remoteCandidate = dependency.data.name.split('/')[0];
      const isValidCandidate =
        remoteCandidate.length < dependency.data.name.length;
      if (isValidCandidate && remotes.has(remoteCandidate)) {
        syncRemoteModules.add(dependency.data.name);
      }
    }
  }
  return Array.from(syncRemoteModules);
}

function collectSyncSharedModules(graph: ReadOnlyGraph, _shared: Shared) {
  const sharedImports = new Set(
    Object.keys(_shared).map((sharedName) => {
      return _shared[sharedName].import || sharedName;
    })
  );
  // always include `react` and `react-native`
  const syncSharedModules = new Set<string>(['react', 'react-native']);
  for (const [, module] of graph.dependencies) {
    for (const dependency of module.dependencies.values()) {
      // null means it's a sync dependency
      if (dependency.data.data.asyncType !== null) {
        continue;
      }
      if (module.path.endsWith('init-host.js')) {
        continue;
      }
      if (sharedImports.has(dependency.data.name)) {
        syncSharedModules.add(dependency.data.name);
      }
    }
  }
  return Array.from(syncSharedModules);
}

function getFederationSharedDependenciesNamespace(scope: string) {
  return `globalThis.__METRO_FEDERATION__["${scope}"].dependencies.shared`;
}

function getFederationRemotesDependenciesNamespace(scope: string) {
  return `globalThis.__METRO_FEDERATION__["${scope}"].dependencies.remotes`;
}

function getSyncShared(shared: string[], entry: string, scope: string): Module {
  const namespace = getFederationSharedDependenciesNamespace(scope);
  const code = `${namespace}["${entry}"]=${JSON.stringify(shared)};`;
  return generateVirtualModule('__required_shared__', code);
}

function getSyncRemotes(
  remotes: string[],
  entry: string,
  scope: string
): Module {
  const namespace = getFederationRemotesDependenciesNamespace(scope);
  const code = `${namespace}["${entry}"]=${JSON.stringify(remotes)};`;
  return generateVirtualModule('__required_remotes__', code);
}

function getEarlyShared(shared: string[]): Module {
  const code = `var __EARLY_SHARED__=${JSON.stringify(shared)};`;
  return generateVirtualModule('__early_shared__', code);
}

function getEarlyRemotes(remotes: string[]): Module {
  const code = `var __EARLY_REMOTES__=${JSON.stringify(remotes)};`;
  return generateVirtualModule('__early_remotes__', code);
}

function generateVirtualModule(name: string, code: string): Module {
  return {
    dependencies: new Map(),
    getSource: (): Buffer => Buffer.from(code),
    inverseDependencies: new CountingSet(),
    path: name,
    output: [
      {
        type: 'js/script/virtual',
        data: {
          code,
          // @ts-ignore
          lineCount: 1,
          map: [],
        },
      },
    ],
  };
}

function isProjectSource(entryPoint: string, projectRoot: string) {
  const relativePath = path.relative(projectRoot, entryPoint);
  return (
    !relativePath.startsWith('..') && !relativePath.startsWith('node_modules')
  );
}

function getBundlePath(entryPoint: string, projectRoot: string) {
  const relativePath = path.relative(projectRoot, entryPoint);
  const { dir, name } = path.parse(relativePath);
  return path.format({ dir, name, ext: '' });
}

function getBundleCode(
  entryPoint: string,
  preModules: readonly Module[],
  graph: ReadOnlyGraph,
  options: SerializerOptions
) {
  const { code } = bundleToString(
    baseJSBundle(entryPoint, preModules, graph, options)
  );
  return code;
}
