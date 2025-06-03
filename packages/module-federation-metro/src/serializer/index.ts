import type {
  MixedOutput,
  Module,
  ReadOnlyGraph,
  SerializerOptions,
} from "metro";
import type { SerializerConfigT } from "metro-config";

import bundleToString from "metro/src/lib/bundleToString";
import CountingSet from "metro/src/lib/CountingSet";
import getAppendScripts from "metro/src/lib/getAppendScripts";
import processModules from "metro/src/DeltaBundler/Serializers/helpers/processModules";

import type { ModuleFederationConfigNormalized, Shared } from "../types";
import { countLines } from "./utils";

type CustomSerializer = SerializerConfigT["customSerializer"];

interface Bundle {
  modules: readonly [number, string][];
  post: string;
  pre: string;
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

function baseJSBundle(
  entryPoint: string,
  preModules: readonly Module[],
  graph: ReadOnlyGraph,
  options: SerializerOptions,
  mfConfig: ModuleFederationConfigNormalized
): Bundle {
  for (const module of graph.dependencies.values()) {
    options.createModuleId(module.path);
  }

  const processModulesOptions = {
    filter: options.processModuleFilter,
    createModuleId: options.createModuleId,
    dev: options.dev,
    includeAsyncPaths: options.includeAsyncPaths,
    projectRoot: options.projectRoot,
    serverRoot: options.serverRoot,
    sourceUrl: options.sourceUrl,
  };

  // Do not prepend polyfills or the require runtime when only modules are requested
  if (options.modulesOnly) {
    preModules = [];
  }

  const preCode = processModules(preModules, processModulesOptions)
    .map(([_, code]) => code)
    .join("\n");

  const modules = [...graph.dependencies.values()].sort(
    (a: Module<MixedOutput>, b: Module<MixedOutput>) =>
      options.createModuleId(a.path) - options.createModuleId(b.path)
  );

  const postCode = processModules(
    [
      // generateInitHostModule(mfConfig),
      ...getAppendScripts(entryPoint, [...preModules, ...modules], {
        asyncRequireModulePath: options.asyncRequireModulePath,
        createModuleId: options.createModuleId,
        getRunModuleStatement: options.getRunModuleStatement,
        inlineSourceMap: options.inlineSourceMap,
        runBeforeMainModule: options.runBeforeMainModule,
        runModule: options.runModule,
        shouldAddToIgnoreList: options.shouldAddToIgnoreList,
        sourceMapUrl: options.sourceMapUrl,
        sourceUrl: options.sourceUrl,
        // @ts-expect-error incomplete declaration
        getSourceUrl: options.getSourceUrl,
      }),
    ],
    processModulesOptions
  )
    .map(([_, code]) => code)
    .join("\n");

  return {
    pre: preCode,
    post: postCode,
    modules: processModules(
      [...graph.dependencies.values()],
      processModulesOptions
    ).map(([module, code]) => [options.createModuleId(module.path), code]),
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
  bundleOptions: SerializerOptions<MixedOutput>,
  mfConfig: ModuleFederationConfigNormalized
) {
  const { code: bundle } = bundleToString(
    baseJSBundle(entryPoint, preModules, graph, bundleOptions, mfConfig)
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
      options,
      mfConfig
    );

    return mainBundle;
  };
};

export { getModuleFederationSerializer };
