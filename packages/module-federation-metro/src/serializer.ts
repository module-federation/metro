import type {
  MixedOutput,
  Module,
  ReadOnlyGraph,
  SerializerOptions,
} from "metro";
import type { SerializerConfigT } from "metro-config";

import baseJSBundle from "metro/src/DeltaBundler/Serializers/baseJSBundle";
import bundleToString from "metro/src/lib/bundleToString";
import type { ModuleFederationConfigNormalized, Shared } from "./types";

type CustomSerializer = SerializerConfigT["customSerializer"];

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

  return syncRemoteModules;
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

  return syncSharedModules;
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

    const mainBundle = createMainBundle(entryPoint, preModules, graph, options);

    return mainBundle;
  };
};

export { getModuleFederationSerializer };
