import path from "node:path";
import fs from "node:fs";
import type { ConfigT } from "metro-config";
import type { Resolution } from "metro-resolver";
import generateManifest from "./generate-manifest";
import createEnhanceMiddleware from "./enhance-middleware";
import {
  SharedConfig,
  ModuleFederationConfig,
  ModuleFederationConfigNormalized,
} from "./types";

declare global {
  var __METRO_FEDERATION_CONFIG: ModuleFederationConfigNormalized;
  var __METRO_FEDERATION_REMOTE_ENTRY_PATH: string | undefined;
  var __METRO_FEDERATION_MANIFEST_PATH: string | undefined;
}

const INIT_HOST = "mf:init-host";
const REMOTE_MODULE_REGISTRY = "mf:remote-module-registry";
const ASYNC_REQUIRE_HOST = "mf:async-require-host";
const ASYNC_REQUIRE_REMOTE = "mf:async-require-remote";

const MANIFEST_FILENAME = "mf-manifest.json";
const DEFAULT_ENTRY_FILENAME = "remoteEntry.js";

function getSharedString(options: ModuleFederationConfigNormalized) {
  const shared = Object.keys(options.shared).reduce((acc, name) => {
    acc[name] = `__SHARED_${name}__`;
    return acc;
  }, {} as Record<string, string>);

  let sharedString = JSON.stringify(shared);
  Object.keys(options.shared).forEach((name) => {
    const sharedConfig = options.shared[name];
    const entry = createSharedModuleEntry(name, sharedConfig);
    sharedString = sharedString.replaceAll(`"__SHARED_${name}__"`, entry);
  });

  return sharedString;
}

function getInitHostModule(options: ModuleFederationConfigNormalized) {
  const initHostPath = require.resolve("./runtime/init-host.js");
  let initHostModule = fs.readFileSync(initHostPath, "utf-8");

  const sharedString = getSharedString(options);

  // must be loaded synchronously at all times
  const earlySharedDeps = ["react", "react-native"];

  // Replace placeholders with actual values
  initHostModule = initHostModule
    .replaceAll("__NAME__", JSON.stringify(options.name))
    .replaceAll("__REMOTES__", generateRemotes(options.remotes))
    .replaceAll("__SHARED__", sharedString)
    .replaceAll("__EARLY_SHARED__", JSON.stringify(earlySharedDeps))
    .replaceAll("__PLUGINS__", generateRuntimePlugins(options.plugins))
    .replaceAll("__SHARE_STRATEGY__", JSON.stringify(options.shareStrategy));

  return initHostModule;
}

function getRemoteModuleRegistryModule(
  options: ModuleFederationConfigNormalized
) {
  const registryPath = require.resolve("./runtime/remote-module-registry.js");
  let registryModule = fs.readFileSync(registryPath, "utf-8");

  registryModule = registryModule.replaceAll(
    "__EARLY_MODULE_TEST__",
    "/^react(-native(\\/|$)|$)/"
  );

  return registryModule;
}

function createSharedModuleEntry(name: string, options: SharedConfig) {
  const template = {
    version: options.version,
    scope: "default",
    shareConfig: {
      singleton: options.singleton,
      eager: options.eager,
      requiredVersion: options.requiredVersion,
    },
    get: options.eager
      ? `__GET_SYNC_PLACEHOLDER__`
      : `__GET_ASYNC_PLACEHOLDER__`,
  };

  const templateString = JSON.stringify(template);

  return templateString
    .replaceAll('"__GET_SYNC_PLACEHOLDER__"', `() => () => require("${name}")`)
    .replaceAll(
      '"__GET_ASYNC_PLACEHOLDER__"',
      `async () => import("${name}").then((m) => () => m)`
    );
}

function getRemoteModule(name: string) {
  const remoteTemplatePath = require.resolve("./runtime/remote-module.js");

  return fs
    .readFileSync(remoteTemplatePath, "utf-8")
    .replaceAll("__MODULE_ID__", `"${name}"`);
}

function createMFRuntimeNodeModules(projectNodeModulesPath: string) {
  const mfMetroPath = path.join(projectNodeModulesPath, ".mf-metro");
  fs.mkdirSync(mfMetroPath, { recursive: true });
  return mfMetroPath;
}

function generateRuntimePlugins(runtimePlugins: string[]) {
  const pluginNames: string[] = [];
  const pluginImports: string[] = [];

  runtimePlugins.forEach((plugin, index) => {
    const pluginName = `plugin${index}`;
    pluginNames.push(`${pluginName}()`);
    pluginImports.push(`import ${pluginName} from "${plugin}";`);
  });

  const imports = pluginImports.join("\n");
  const plugins = `const plugins = [${pluginNames.join(", ")}];`;

  return `${imports}\n${plugins}`;
}

function generateRemotes(remotes: Record<string, string> = {}) {
  const remotesEntries: string[] = [];
  Object.entries(remotes).forEach(([remoteAlias, remoteEntry]) => {
    const remoteEntryParts = remoteEntry.split("@");
    const remoteName = remoteEntryParts[0];
    const remoteEntryUrl = remoteEntryParts.slice(1).join("@");

    remotesEntries.push(
      `{ 
          alias: "${remoteAlias}", 
          name: "${remoteName}", 
          entry: "${remoteEntryUrl}", 
          entryGlobalName: "${remoteName}", 
          type: "var" 
       }`
    );
  });

  return `[${remotesEntries.join(",\n")}]`;
}

function getRemoteEntryModule(options: ModuleFederationConfigNormalized) {
  const remoteEntryTemplatePath = require.resolve("./runtime/remote-entry.js");
  let remoteEntryModule = fs.readFileSync(remoteEntryTemplatePath, "utf-8");

  const sharedString = getSharedString(options);
  const earlySharedDeps = ["react", "react-native"];

  const exposes = options.exposes || {};

  const exposesString = Object.keys(exposes)
    .map((key) => {
      const importName = path.relative(".", exposes[key]);
      const importPath = `../../${importName}`;

      return `"${key}": async () => {
          const module = await import("${importPath}");
          return module;
        }`;
    })
    .join(",");

  return remoteEntryModule
    .replaceAll("__PLUGINS__", generateRuntimePlugins(options.plugins))
    .replaceAll("__SHARED__", sharedString)
    .replaceAll("__REMOTES__", generateRemotes(options.remotes))
    .replaceAll("__EARLY_SHARED__", JSON.stringify(earlySharedDeps))
    .replaceAll("__EXPOSES_MAP__", `{${exposesString}}`)
    .replaceAll("__NAME__", `"${options.name}"`)
    .replaceAll("__SHARE_STRATEGY__", JSON.stringify(options.shareStrategy));
}

function getRemoteHMRSetupModule() {
  const remoteHMRSetupTemplatePath = require.resolve("./runtime/remote-hmr.js");
  let remoteHMRSetupModule = fs.readFileSync(
    remoteHMRSetupTemplatePath,
    "utf-8"
  );

  return remoteHMRSetupModule;
}

function createInitHostVirtualModule(
  options: ModuleFederationConfigNormalized,
  vmDirPath: string
) {
  const initHostModule = getInitHostModule(options);
  const initHostPath = path.join(vmDirPath, "init-host.js");
  fs.writeFileSync(initHostPath, initHostModule, "utf-8");
  return initHostPath;
}

// virtual module: remote-module-registry
function createRemoteModuleRegistryModule(
  options: ModuleFederationConfigNormalized,
  vmDirPath: string
) {
  const registryModule = getRemoteModuleRegistryModule(options);
  const registryPath = path.join(vmDirPath, "remote-module-registry.js");
  fs.writeFileSync(registryPath, registryModule, "utf-8");
  return registryPath;
}

function createSharedModule(sharedName: string, outputDir: string) {
  const sharedFilePath = getSharedPath(sharedName, outputDir);
  // we need to create the shared module if it doesn't exist
  const sharedModule = getRemoteModule(sharedName);
  fs.mkdirSync(path.dirname(sharedFilePath), { recursive: true });
  fs.writeFileSync(sharedFilePath, sharedModule, "utf-8");
  return sharedFilePath;
}

function getSharedPath(name: string, dir: string) {
  const sharedName = name.replaceAll("/", "_");
  const sharedDir = path.join(dir, "shared");
  return path.join(sharedDir, `${sharedName}.js`);
}

function createRemoteModule(name: string, outputDir: string) {
  const remoteModule = getRemoteModule(name);
  const remoteFilePath = getRemoteModulePath(name, outputDir);
  fs.mkdirSync(path.dirname(remoteFilePath), { recursive: true });
  fs.writeFileSync(remoteFilePath, remoteModule, "utf-8");
  return remoteFilePath;
}

function getRemoteModulePath(name: string, outputDir: string) {
  const remoteModuleName = name.replaceAll("/", "_");
  const remoteModulePath = path.join(
    outputDir,
    "remote",
    `${remoteModuleName}.js`
  );
  return remoteModulePath;
}

function stubSharedModules(
  options: ModuleFederationConfigNormalized,
  outputDir: string
) {
  const sharedDir = path.join(outputDir, "shared");
  fs.mkdirSync(sharedDir, { recursive: true });
  Object.keys(options.shared).forEach((sharedName) => {
    const sharedFilePath = getSharedPath(sharedName, outputDir);
    fs.writeFileSync(sharedFilePath, `// shared/${sharedName} stub`, "utf-8");
  });
}

function replaceModule(from: RegExp, to: string) {
  return (resolved: Resolution): Resolution => {
    if (resolved.type === "sourceFile" && from.test(resolved.filePath)) {
      return { type: "sourceFile", filePath: to };
    }
    return resolved;
  };
}

function normalizeOptions(
  options: ModuleFederationConfig
): ModuleFederationConfigNormalized {
  const filename = options.filename ?? DEFAULT_ENTRY_FILENAME;

  // force all shared modules in host to be eager
  const shared = options.shared ?? {};
  if (!options.exposes) {
    Object.keys(shared).forEach((sharedName) => {
      shared[sharedName].eager = true;
    });
  }

  // this is different from the default share strategy in mf-core
  // it makes more sense to have loaded-first as default on mobile
  // in order to avoid longer TTI upon app startup
  const shareStrategy = options.shareStrategy ?? "loaded-first";

  return {
    name: options.name,
    filename,
    remotes: options.remotes ?? {},
    exposes: options.exposes ?? {},
    shared,
    shareStrategy,
    plugins: options.plugins ?? [],
  };
}

function withModuleFederation(
  config: ConfigT,
  federationOptions: ModuleFederationConfig
): ConfigT {
  const isHost = !federationOptions.exposes;
  const isRemote = !isHost;

  const options = normalizeOptions(federationOptions);

  const projectNodeModulesPath = path.resolve(
    config.projectRoot,
    "node_modules"
  );

  const mfMetroPath = createMFRuntimeNodeModules(projectNodeModulesPath);

  // create stubs for shared modules for watchman
  stubSharedModules(options, mfMetroPath);

  // auto-inject 'metro-core-plugin' MF runtime plugin
  options.plugins = [
    require.resolve("../runtime-plugin.js"),
    ...options.plugins,
  ].map((plugin) => path.relative(mfMetroPath, plugin));

  const registryPath = createRemoteModuleRegistryModule(options, mfMetroPath);

  const initHostPath = isHost
    ? createInitHostVirtualModule(options, mfMetroPath)
    : null;

  let remoteEntryPath: string | undefined,
    remoteHMRSetupPath: string | undefined;

  if (isRemote) {
    remoteEntryPath = path.join(mfMetroPath, options.filename);
    fs.writeFileSync(remoteEntryPath, getRemoteEntryModule(options));

    remoteHMRSetupPath = path.join(mfMetroPath, "remote-hmr.js");
    fs.writeFileSync(remoteHMRSetupPath, getRemoteHMRSetupModule());
  }

  const asyncRequireHostPath = path.resolve(
    __dirname,
    "../async-require-host.js"
  );
  const asyncRequireRemotePath = path.resolve(
    __dirname,
    "../async-require-remote.js"
  );

  const manifestPath = path.join(mfMetroPath, MANIFEST_FILENAME);
  const manifest = generateManifest(options);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, undefined, 2));

  // pass data to bundle-mf-remote command
  global.__METRO_FEDERATION_CONFIG = options;
  global.__METRO_FEDERATION_REMOTE_ENTRY_PATH = remoteEntryPath;
  global.__METRO_FEDERATION_MANIFEST_PATH = manifestPath;

  const createdSharedModules = new Set<string>();

  return {
    ...config,
    serializer: {
      ...config.serializer,
      getModulesRunBeforeMainModule: (entryFilePath) => {
        return initHostPath ? [initHostPath] : [];
      },
      getRunModuleStatement: (moduleId: number | string) =>
        `${options.name}__r(${JSON.stringify(moduleId)});`,
      getPolyfills: (options) => {
        return isHost ? config.serializer?.getPolyfills?.(options) : [];
      },
    },
    transformer: {
      ...config.transformer,
      globalPrefix: options.name,
    },
    resolver: {
      ...config.resolver,
      resolveRequest: (context, moduleName, platform) => {
        // virtual module: init-host
        if (moduleName === INIT_HOST) {
          return { type: "sourceFile", filePath: initHostPath as string };
        }

        // virtual module: async-require-host
        if (moduleName === ASYNC_REQUIRE_HOST) {
          return { type: "sourceFile", filePath: asyncRequireHostPath };
        }

        // virtual module: async-require-remote
        if (moduleName === ASYNC_REQUIRE_REMOTE) {
          return { type: "sourceFile", filePath: asyncRequireRemotePath };
        }

        // virtual module: remote-module-registry
        if (moduleName === REMOTE_MODULE_REGISTRY) {
          return { type: "sourceFile", filePath: registryPath };
        }

        // virtual module: remote-hmr
        if (moduleName === "mf:remote-hmr") {
          return { type: "sourceFile", filePath: remoteHMRSetupPath as string };
        }

        // virtual entrypoint to create MF containers
        // MF options.filename is provided as a name only and will be requested from the root of project
        // so the filename mini.js becomes ./mini.js and we need to match exactly that
        if (moduleName === `./${options.filename}`) {
          return { type: "sourceFile", filePath: remoteEntryPath as string };
        }

        // shared modules handling in init-host.js
        if ([initHostPath].includes(context.originModulePath)) {
          // init-host contains definition of shared modules so we need to prevent
          // circular import of shared module, by allowing import shared dependencies directly
          return context.resolveRequest(context, moduleName, platform);
        }

        // shared modules handling in remote-entry.js
        if ([remoteEntryPath].includes(context.originModulePath)) {
          const sharedModule = options.shared[moduleName];
          // import: false means that the module is marked as external
          if (sharedModule && sharedModule.import === false) {
            const sharedPath = getSharedPath(moduleName, mfMetroPath);
            return { type: "sourceFile", filePath: sharedPath };
          } else {
            return context.resolveRequest(context, moduleName, platform);
          }
        }

        // remote modules
        for (const remoteName of Object.keys(options.remotes)) {
          if (moduleName.startsWith(remoteName + "/")) {
            const remotePath = createRemoteModule(moduleName, mfMetroPath);
            return { type: "sourceFile", filePath: remotePath };
          }
        }

        // shared module handling
        for (const sharedName of Object.keys(options.shared)) {
          const importName = options.shared[sharedName].import || sharedName;
          // module import
          if (moduleName === importName) {
            const sharedPath = getSharedPath(moduleName, mfMetroPath);
            if (!createdSharedModules.has(sharedPath)) {
              createSharedModule(moduleName, mfMetroPath);
              createdSharedModules.add(sharedPath);
            }
            return { type: "sourceFile", filePath: sharedPath };
          }
          // TODO: module deep import
          // if (importName.endsWith("/") && moduleName.startsWith(importName)) {
          //   const sharedPath = createSharedModule(moduleName, mfMetroPath);
          //   return { type: "sourceFile", filePath: sharedPath };
          // }
        }

        // replace getDevServer module in remote with our own implementation
        if (isRemote && moduleName.includes("getDevServer")) {
          const res = context.resolveRequest(context, moduleName, platform);
          const from =
            /react-native\/Libraries\/Core\/Devtools\/getDevServer\.js$/;
          const to = path.resolve(__dirname, "../getDevServer.js");
          return replaceModule(from, to)(res);
        }

        return context.resolveRequest(context, moduleName, platform);
      },
    },
    server: {
      ...config.server,
      enhanceMiddleware: createEnhanceMiddleware(
        MANIFEST_FILENAME,
        manifestPath
      ),
    },
  };
}

export { withModuleFederation };
