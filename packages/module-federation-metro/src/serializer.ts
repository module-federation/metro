import fs from "node:fs/promises";
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
  bundleOptions: SerializerOptions<MixedOutput>,
  lazyModules: Set<string>
) => {
  const filteredGraph = {
    ...graph,
    dependencies: new Map(),
  };

  for (const [id, module] of graph.dependencies) {
    if (!lazyModules.has(module.path)) {
      filteredGraph.dependencies.set(id, module);
    }
  }

  const { code: bundle } = bundleToString(
    baseJSBundle(entryPoint, preModules, filteredGraph, bundleOptions)
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

const getBundleSplittingSerializer: () => CustomSerializer = () => {
  return async (entryPoint, preModules, graph, options) => {
    const lazyModules = getLazyModules(graph);
    const mainBundleModules = getMainBundleModules(entryPoint, graph);
    const lazyBundles = Array.from(lazyModules).map((module) =>
      createLazyBundle(module, graph, options, mainBundleModules)
    );

    const manifest = Object.fromEntries(
      lazyBundles.map(({ id }) => [
        id,
        `http://localhost:8888/${path.basename(id).split(".")[0]}.bundle`,
      ])
    );

    // @ts-expect-error - preModules is marked as readonly
    preModules.push({
      path: "manifest",
      dependencies: new Map(),
      getSource: () => Buffer.from(""),
      inverseDependencies: new Set(),
      output: [
        {
          type: "js/script/virtual",
          data: {
            code: `var __BUNDLE_SPLITTING_MAP__=${JSON.stringify(manifest)}`,
            lineCount: 1,
            map: [],
          },
        },
      ],
    });

    const mainBundle = createMainBundle(
      entryPoint,
      preModules,
      graph,
      options,
      lazyModules
    );

    await Promise.all(
      lazyBundles.map(async ({ id, bundle }) => {
        await fs.writeFile(
          path.join(
            __dirname,
            "dist",
            `${path.basename(id).split(".")[0]}.bundle`
          ),
          bundle
        );
      })
    );

    return mainBundle;
  };
};

export { getBundleSplittingSerializer };
