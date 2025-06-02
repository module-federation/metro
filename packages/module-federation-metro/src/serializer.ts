import type {
  MixedOutput,
  Module,
  ReadOnlyGraph,
  SerializerOptions,
} from "metro";
import type { SerializerConfigT } from "metro-config";

import baseJSBundle from "metro/src/DeltaBundler/Serializers/baseJSBundle";
import bundleToString from "metro/src/lib/bundleToString";
import type { ModuleFederationConfigNormalized } from "./types";

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
        syncRemoteModules.add(dependency.absolutePath);
      }
    }
  }

  return syncRemoteModules;
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

    const mainBundle = createMainBundle(entryPoint, preModules, graph, options);

    return mainBundle;
  };
};

export { getModuleFederationSerializer };
