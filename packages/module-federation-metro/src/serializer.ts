import path from "node:path";
import type {
  MixedOutput,
  Module,
  ReadOnlyGraph,
  SerializerOptions,
} from "metro";
import type { SerializerConfigT } from "metro-config";
import baseJSBundle from "metro/src/DeltaBundler/Serializers/baseJSBundle";
import bundleToString from "metro/src/lib/bundleToString";
import CountingSet from "metro/src/lib/CountingSet";

import type { ModuleFederationConfigNormalized, Shared } from "./types";

type CustomSerializer = SerializerConfigT["customSerializer"];

const newline = /\r\n?|\n|\u2028|\u2029/g;

function countLines(string: string): number {
  return (string.match(newline) || []).length + 1;
}

function getFederationSharedDependenciesNamespace(scope: string) {
  return `globalThis.__METRO_FEDERATION__["${scope}"].dependencies.shared`;
}

function getFederationRemotesDependenciesNamespace(scope: string) {
  return `globalThis.__METRO_FEDERATION__["${scope}"].dependencies.remotes`;
}

function getRequiredSharedDependencies(
  shared: string[],
  entry: string,
  scope: string
): Module<MixedOutput> {
  const namespace = getFederationSharedDependenciesNamespace(scope);
  const code = `${namespace}["${entry}"]=${JSON.stringify(shared)};`;
  return generateVirtualModule("__required_shared__", code);
}

function getRequiredRemotesDependencies(
  remotes: string[],
  entry: string,
  scope: string
): Module<MixedOutput> {
  const namespace = getFederationRemotesDependenciesNamespace(scope);
  const code = `${namespace}["${entry}"]=${JSON.stringify(remotes)};`;
  return generateVirtualModule("__required_remotes__", code);
}

function getEarlyShared(shared: string[]): Module<MixedOutput> {
  const code = `var __EARLY_SHARED__=${JSON.stringify(shared)};`;
  return generateVirtualModule("__early_shared__", code);
}

function getEarlyRemotes(remotes: string[]): Module<MixedOutput> {
  const code = `var __EARLY_REMOTES__=${JSON.stringify(remotes)};`;
  return generateVirtualModule("__early_remotes__", code);
}

function generateVirtualModule(
  name: string,
  code: string
): Module<MixedOutput> {
  return {
    dependencies: new Map(),
    getSource: (): Buffer => Buffer.from(code),
    inverseDependencies: new CountingSet(),
    path: name,
    output: [
      {
        type: "js/script/virtual",
        data: {
          code,
          // @ts-ignore
          lineCount: countLines(code),
          map: [],
        },
      },
    ],
  };
}

function getSyncRemoteModules(
  graph: ReadOnlyGraph<MixedOutput>,
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
      const remoteCandidate = dependency.data.name.split("/")[0];
      const isValidCandidate =
        remoteCandidate.length < dependency.data.name.length;
      if (isValidCandidate && remotes.has(remoteCandidate)) {
        syncRemoteModules.add(dependency.data.name);
      }
    }
  }
  return Array.from(syncRemoteModules);
}

function getSyncSharedModules(
  graph: ReadOnlyGraph<MixedOutput>,
  _shared: Shared
) {
  const sharedImports = new Set(
    Object.keys(_shared).map((sharedName) => {
      return _shared[sharedName].import || sharedName;
    })
  );
  // always include `react` and `react-native`
  const syncSharedModules = new Set<string>(["react", "react-native"]);
  for (const [, module] of graph.dependencies) {
    for (const dependency of module.dependencies.values()) {
      // null means it's a sync dependency
      if (dependency.data.data.asyncType !== null) {
        continue;
      }
      if (module.path.endsWith("init-host.js")) {
        continue;
      }
      if (sharedImports.has(dependency.data.name)) {
        syncSharedModules.add(dependency.data.name);
      }
    }
  }
  return Array.from(syncSharedModules);
}

function isProjectSource(entryPoint: string, projectRoot: string) {
  const relativePath = path.relative(projectRoot, entryPoint);
  return (
    !relativePath.startsWith("..") && !relativePath.startsWith("node_modules")
  );
}

function getBundlePath(entryPoint: string, projectRoot: string) {
  const relativePath = path.relative(projectRoot, entryPoint);
  const { dir, name } = path.parse(relativePath);
  return path.format({ dir, name, ext: "" });
}

function getBundleCode(
  entryPoint: string,
  preModules: readonly Module<MixedOutput>[],
  graph: ReadOnlyGraph<MixedOutput>,
  options: SerializerOptions<MixedOutput>
) {
  const { code } = bundleToString(
    baseJSBundle(entryPoint, preModules, graph, options)
  );
  return code;
}

const getModuleFederationSerializer: (
  mfConfig: ModuleFederationConfigNormalized
) => CustomSerializer = (mfConfig) => {
  return async (entryPoint, preModules, graph, options) => {
    const syncRemoteModules = getSyncRemoteModules(graph, mfConfig.remotes);
    const syncSharedModules = getSyncSharedModules(graph, mfConfig.shared);
    // main entrypoints always have runModule set to true
    if (options.runModule === true) {
      const earlyShared = getEarlyShared(syncSharedModules);
      const earlyRemotes = getEarlyRemotes(syncRemoteModules);

      const finalPreModules = [earlyShared, earlyRemotes, ...preModules];
      return getBundleCode(entryPoint, finalPreModules, graph, options);
    }

    // TODO revisit this
    // skip non-project source like node_modules
    if (!isProjectSource(entryPoint, options.projectRoot)) {
      return getBundleCode(entryPoint, preModules, graph, options);
    }

    const bundlePath = getBundlePath(entryPoint, options.projectRoot);

    const earlyShared = getRequiredSharedDependencies(
      syncSharedModules,
      bundlePath,
      mfConfig.name
    );
    const earlyRemotes = getRequiredRemotesDependencies(
      syncRemoteModules,
      bundlePath,
      mfConfig.name
    );

    const finalPreModules = [earlyShared, earlyRemotes];
    if (options.modulesOnly === false) {
      finalPreModules.push(...preModules);
    }

    // prevent resetting preModules in metro/src/DeltaBundler/Serializers/baseJSBundle.js
    const finalOptions = { ...options, modulesOnly: false };
    return getBundleCode(entryPoint, finalPreModules, graph, finalOptions);
  };
};

export { getModuleFederationSerializer };
