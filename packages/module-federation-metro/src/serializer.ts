import type {
  MixedOutput,
  Module,
  ReadOnlyGraph,
  SerializerOptions,
} from "metro";
import type { SerializerConfigT } from "metro-config";

import baseJSBundle from "metro/src/DeltaBundler/Serializers/baseJSBundle";
import bundleToString from "metro/src/lib/bundleToString";

type CustomSerializer = SerializerConfigT["customSerializer"];

const getLazyModules = (graph: ReadOnlyGraph<MixedOutput>) => {
  const lazyModules = new Set<string>();

  for (const [, module] of graph.dependencies) {
    for (const dependency of module.dependencies.values()) {
      if (dependency.data.data.asyncType === "async") {
        lazyModules.add(dependency.absolutePath);
      }
    }
  }

  return lazyModules;
};

const getMainBundleModules = (
  entryPoint: string,
  graph: ReadOnlyGraph<MixedOutput>
) => {
  const mainBundleModules = new Set<string>();

  const stack = [entryPoint];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const modulePath = stack.pop() as string;

    if (visited.has(modulePath)) {
      continue;
    }

    visited.add(modulePath);

    const module = graph.dependencies.get(modulePath);

    if (!module) {
      continue;
    }

    mainBundleModules.add(module.path);

    if (module.dependencies) {
      for (const [, dependency] of module.dependencies) {
        if (dependency.data.data.asyncType === "async") {
          stack.push(dependency.absolutePath);
        }
      }
    }
  }

  return mainBundleModules;
};

const createMainBundle = (
  entryPoint: string,
  preModules: readonly Module<MixedOutput>[],
  graph: ReadOnlyGraph<MixedOutput>,
  bundleOptions: SerializerOptions<MixedOutput>
) => {
  const { code: bundle } = bundleToString(
    baseJSBundle(entryPoint, preModules, graph, bundleOptions)
  );

  return bundle;
};

const createLazyBundle = (
  entryPoint: string,
  graph: ReadOnlyGraph<MixedOutput>,
  bundleOptions: SerializerOptions<MixedOutput>,
  mainBundleModules: Set<unknown>
) => {
  const filteredGraph = {
    ...graph,
    entryPoints: new Set([entryPoint]),
    dependencies: new Map(),
  };

  for (const [id, module] of graph.dependencies) {
    if (!mainBundleModules.has(module.path)) {
      filteredGraph.dependencies.set(id, module);
    }
  }

  const { code: bundle } = bundleToString(
    baseJSBundle(entryPoint, [], filteredGraph, {
      ...bundleOptions,
      modulesOnly: true,
      runModule: true,
    })
  );

  return {
    id: entryPoint,
    bundle,
  };
};

const getModuleFederationSerializer: () => CustomSerializer = () => {
  return async (entryPoint, preModules, graph, options) => {
    const lazyModules = getLazyModules(graph);
    const mainBundleModules = getMainBundleModules(entryPoint, graph);
    const lazyBundles = Array.from(lazyModules).map((module) =>
      createLazyBundle(module, graph, options, mainBundleModules)
    );

    const mainBundle = createMainBundle(entryPoint, preModules, graph, options);

    return mainBundle;
  };
};

export { getModuleFederationSerializer };
