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
  const syncSharedModules = new Set<string>();

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

function createMainBundle(
  entryPoint: string,
  preModules: readonly Module<MixedOutput>[],
  graph: ReadOnlyGraph<MixedOutput>,
  bundleOptions: SerializerOptions<MixedOutput>
) {
  const { code: bundle } = bundleToString(
    baseJSBundle(entryPoint, preModules, graph, bundleOptions)
  );

  return bundle;
}

const getModuleFederationSerializer: (
  mfConfig: ModuleFederationConfigNormalized
) => CustomSerializer = (mfConfig) => {
  return async (entryPoint, preModules, graph, options) => {
    const syncRemoteModules = getSyncRemoteModules(graph, mfConfig.remotes);
    const syncSharedModules = getSyncSharedModules(graph, mfConfig.shared);

    const earlyShared = getEarlyShared(syncSharedModules);
    const earlyRemotes = getEarlyRemotes(syncRemoteModules);
    const finalPreModules = [earlyShared, earlyRemotes, ...preModules];

    const mainBundle = createMainBundle(
      entryPoint,
      finalPreModules,
      graph,
      options
    );

    return mainBundle;
  };
};

export { getModuleFederationSerializer };
