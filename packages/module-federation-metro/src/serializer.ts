import fs from "node:fs/promises";
import path from "node:path";

import { baseJSBundle } from "metro/src/DeltaBundler/Serializers/baseJSBundle";
import { bundleToString } from "metro/src/lib/bundleToString";

const getLazyModules = (graph) => {
  const lazyModules = new Set();

  for (const [, module] of graph.dependencies) {
    for (const dependency of module.dependencies.values()) {
      if (dependency.data.data.asyncType === "async") {
        lazyModules.add(dependency.absolutePath);
      }
    }
  }

  return lazyModules;
};

const getMainBundleModules = (entryPoint, graph) => {
  const mainBundleModules = new Set();

  const stack = [entryPoint];
  const visited = new Set();

  while (stack.length > 0) {
    const modulePath = stack.pop();

    if (visited.has(modulePath)) {
      continue;
    }

    visited.add(modulePath);

    const module = graph.dependencies.get(modulePath);
    mainBundleModules.add(module.path);

    if (module.dependencies) {
      stack.push(
        ...module.dependencies
          .values()
          .filter((dependency) => dependency.data.data.asyncType !== "async")
          .map((dependency) => dependency.absolutePath)
      );
    }
  }

  return mainBundleModules;
};

const createMainBundle = (
  entryPoint,
  preModules,
  graph,
  bundleOptions,
  lazyModules
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

  return bundleToString(
    baseJSBundle(entryPoint, preModules, filteredGraph, bundleOptions)
  );
};

const createLazyBundle = (
  entryPoint,
  graph,
  bundleOptions,
  mainBundleModules
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

  const bundle = bundleToString(
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

const getBundleSplittingSerializer = () => {
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
          bundle.code
        );
      })
    );

    return mainBundle;
  };
};

module.exports = getBundleSplittingSerializer;
