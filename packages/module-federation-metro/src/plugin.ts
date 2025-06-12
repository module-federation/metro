import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import type { ConfigT } from "metro-config";
import type { Resolution } from "metro-resolver";
import generateManifest from "./generate-manifest";
import { getModuleFederationSerializer } from "./serializer";
import {
  Shared,
  SharedConfig,
  ModuleFederationConfig,
  ModuleFederationConfigNormalized,
} from "./types";
import { ConfigError } from "./utils/errors";
import { VirtualModuleManager } from "./utils/vm-manager";

declare global {
  var __METRO_FEDERATION_CONFIG: ModuleFederationConfigNormalized;
  var __METRO_FEDERATION_REMOTE_ENTRY_PATH: string | undefined;
  var __METRO_FEDERATION_MANIFEST_PATH: string | undefined;
}

const INIT_HOST = "mf:init-host";
const ASYNC_REQUIRE = "mf:async-require";
const REMOTE_MODULE_REGISTRY = "mf:remote-module-registry";

const MANIFEST_FILENAME = "mf-manifest.json";
const DEFAULT_ENTRY_FILENAME = "remoteEntry.bundle";

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

  // Replace placeholders with actual values
  initHostModule = initHostModule
    .replaceAll("__NAME__", JSON.stringify(options.name))
    .replaceAll("__REMOTES__", generateRemotes(options.remotes))
    .replaceAll("__SHARED__", sharedString)
    .replaceAll("__PLUGINS__", generateRuntimePlugins(options.plugins))
    .replaceAll("__SHARE_STRATEGY__", JSON.stringify(options.shareStrategy));

  return initHostModule;
}

function getRemoteModuleRegistryModule() {
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
  fs.rmSync(mfMetroPath, { recursive: true, force: true });
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

function getSharedPath(name: string, dir: string) {
  const sharedName = name.replaceAll("/", "_");
  const sharedDir = path.join(dir, "shared");
  return path.join(sharedDir, `${sharedName}.js`);
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

function replaceModule(from: RegExp, to: string) {
  return (resolved: Resolution): Resolution => {
    if (resolved.type === "sourceFile" && from.test(resolved.filePath)) {
      return { type: "sourceFile", filePath: to };
    }
    return resolved;
  };
}

function createBabelTransformer({
  proxiedBabelTrasnsformerPath,
  mfConfig,
  mfMetroPath,
  blacklistedPaths,
}: {
  proxiedBabelTrasnsformerPath: string;
  mfConfig: ModuleFederationConfigNormalized;
  mfMetroPath: string;
  blacklistedPaths: string[];
}) {
  const babelTransformerPath = path.join(mfMetroPath, "babel-transformer.js");

  const babelTransformerTemplate = fs.readFileSync(
    require.resolve("./runtime/babel-transformer.js"),
    "utf-8"
  );

  const babelTransformer = babelTransformerTemplate
    .replaceAll("__BABEL_TRANSFORMER_PATH__", proxiedBabelTrasnsformerPath)
    .replaceAll("__REMOTES__", JSON.stringify(mfConfig.remotes))
    .replaceAll("__SHARED__", JSON.stringify(mfConfig.shared))
    .replaceAll("__BLACKLISTED_PATHS__", JSON.stringify(blacklistedPaths));

  fs.writeFileSync(babelTransformerPath, babelTransformer, "utf-8");

  return babelTransformerPath;
}

function createManifest(
  options: ModuleFederationConfigNormalized,
  mfMetroPath: string
) {
  const manifestPath = path.join(mfMetroPath, MANIFEST_FILENAME);
  const manifest = generateManifest(options);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, undefined, 2));
  return manifestPath;
}

function stubRemoteEntry(remoteEntryPath: string) {
  const remoteEntryModule = "// remote entry stub";
  fs.writeFileSync(remoteEntryPath, remoteEntryModule, "utf-8");
}

function replaceExtension(filepath: string, extension: string) {
  const { dir, name } = path.parse(filepath);
  return path.format({ dir, name, ext: extension });
}

function isUsingMFCommands() {
  const command = process.argv[2];
  const allowedCommands = ["start", "bundle-mf-host", "bundle-mf-remote"];
  return allowedCommands.includes(command);
}

function validateOptions(options: ModuleFederationConfigNormalized) {
  // validate filename
  if (!options.filename.endsWith(".bundle")) {
    throw new ConfigError(
      `Invalid filename: ${options.filename}. ` +
        "Filename must end with .bundle extension."
    );
  }
}

function normalizeOptions(
  options: ModuleFederationConfig,
  config: ConfigT
): ModuleFederationConfigNormalized {
  const filename = options.filename ?? DEFAULT_ENTRY_FILENAME;

  const shared = getNormalizedShared(options, config);

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

function getNormalizedShared(
  options: ModuleFederationConfig,
  config: ConfigT
): Shared {
  const pkg = require(path.join(config.projectRoot, "package.json"));
  const shared = options.shared ?? {};

  // force all shared modules in host to be eager
  if (!options.exposes) {
    Object.keys(shared).forEach((sharedName) => {
      shared[sharedName].eager = true;
    });
  }

  // default requiredVersion
  Object.keys(shared).forEach((sharedName) => {
    if (!shared[sharedName].requiredVersion) {
      shared[sharedName].requiredVersion =
        pkg.dependencies?.[sharedName] || pkg.devDependencies?.[sharedName];
    }
  });

  return shared;
}

function withModuleFederation(
  config: ConfigT,
  federationOptions: ModuleFederationConfig
): ConfigT {
  if (!isUsingMFCommands()) {
    console.warn(
      chalk.yellow(
        "Warning: Module Federation build is disabled for this command.\n"
      ) +
        chalk.yellow(
          "To enable Module Federation, please use one of the dedicated bundle commands:\n"
        ) +
        ` ${chalk.dim("•")} bundle-mf-host` +
        chalk.dim(" - for bundling a host application\n") +
        ` ${chalk.dim("•")} bundle-mf-remote` +
        chalk.dim(" - for bundling a remote application\n")
    );
    return config;
  }

  const isHost = !federationOptions.exposes;
  const isRemote = !isHost;

  const options = normalizeOptions(federationOptions, config);

  validateOptions(options);

  const vmManager = new VirtualModuleManager(config);

  const projectNodeModulesPath = path.resolve(
    config.projectRoot,
    "node_modules"
  );

  const mfMetroPath = createMFRuntimeNodeModules(projectNodeModulesPath);

  // auto-inject 'metro-core-plugin' MF runtime plugin
  options.plugins = [
    require.resolve("../runtime-plugin.js"),
    ...options.plugins,
  ].map((plugin) => path.relative(mfMetroPath, plugin));

  const initHostPath = path.resolve(mfMetroPath, "init-host.js");
  const registryPath = path.resolve(mfMetroPath, "remote-module-registry.js");

  const remoteEntryFilename = replaceExtension(options.filename, ".js");
  const remoteEntryPath = path.resolve(mfMetroPath, remoteEntryFilename);
  const remoteHMRSetupPath = path.resolve(mfMetroPath, "remote-hmr.js");

  const asyncRequirePath = path.resolve(__dirname, "../async-require.js");

  const babelTransformerPath = createBabelTransformer({
    proxiedBabelTrasnsformerPath: config.transformer.babelTransformerPath,
    mfMetroPath,
    mfConfig: options,
    blacklistedPaths: [initHostPath, remoteEntryPath],
  });

  const manifestPath = createManifest(options, mfMetroPath);

  // remote entry is an entrypoint so it needs to be in the filesystem
  // we create a stub on the filesystem and then redirect to a virtual module
  stubRemoteEntry(remoteEntryPath);

  // pass data to bundle-mf-remote command
  global.__METRO_FEDERATION_CONFIG = options;
  global.__METRO_FEDERATION_REMOTE_ENTRY_PATH = remoteEntryPath;
  global.__METRO_FEDERATION_MANIFEST_PATH = manifestPath;

  return {
    ...config,
    serializer: {
      ...config.serializer,
      customSerializer: getModuleFederationSerializer(options),
      getModulesRunBeforeMainModule: () => {
        return isHost ? [initHostPath] : [];
      },
      getRunModuleStatement: (moduleId: number | string) => {
        return `${options.name}__r(${JSON.stringify(moduleId)});`;
      },
      getPolyfills: (options) => {
        return isHost ? config.serializer.getPolyfills(options) : [];
      },
    },
    transformer: {
      ...config.transformer,
      globalPrefix: options.name,
      babelTransformerPath: babelTransformerPath,
      getTransformOptions: vmManager.getTransformOptions(),
    },
    resolver: {
      ...config.resolver,
      resolveRequest: (context, moduleName, platform) => {
        // virtual module: init-host
        if (moduleName === INIT_HOST) {
          const initHostGenerator = () => getInitHostModule(options);
          vmManager.registerVirtualModule(initHostPath, initHostGenerator);
          return { type: "sourceFile", filePath: initHostPath as string };
        }

        // virtual module: async-require
        if (moduleName === ASYNC_REQUIRE) {
          return { type: "sourceFile", filePath: asyncRequirePath };
        }

        // virtual module: remote-module-registry
        if (moduleName === REMOTE_MODULE_REGISTRY) {
          const registryGenerator = () => getRemoteModuleRegistryModule();
          vmManager.registerVirtualModule(registryPath, registryGenerator);
          return { type: "sourceFile", filePath: registryPath };
        }

        // virtual module: remote-hmr
        if (moduleName === "mf:remote-hmr") {
          const remoteHMRSetupGenerator = () => getRemoteHMRSetupModule();
          vmManager.registerVirtualModule(
            remoteHMRSetupPath,
            remoteHMRSetupGenerator
          );
          return { type: "sourceFile", filePath: remoteHMRSetupPath as string };
        }

        // virtual entrypoint to create MF containers
        // MF options.filename is provided as a name only and will be requested from the root of project
        // so the filename mini.js becomes ./mini.js and we need to match exactly that
        if (moduleName === `./${path.basename(remoteEntryPath)}`) {
          const remoteEntryGenerator = () => getRemoteEntryModule(options);
          vmManager.registerVirtualModule(
            remoteEntryPath,
            remoteEntryGenerator
          );
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
            const remotePath = getRemoteModulePath(moduleName, mfMetroPath);
            const remoteGenerator = () => getRemoteModule(moduleName);
            vmManager.registerVirtualModule(remotePath, remoteGenerator);
            return { type: "sourceFile", filePath: remotePath };
          }
        }

        // shared module handling
        for (const sharedName of Object.keys(options.shared)) {
          const importName = options.shared[sharedName].import || sharedName;
          // module import
          if (moduleName === importName) {
            const sharedPath = getSharedPath(moduleName, mfMetroPath);
            const sharedGenerator = () => getRemoteModule(moduleName);
            vmManager.registerVirtualModule(sharedPath, sharedGenerator);
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
      enhanceMiddleware: vmManager.getMiddleware(),
      rewriteRequestUrl(url) {
        const { pathname } = new URL(url, "protocol://host");
        // rewrite /mini.bundle -> /mini.js.bundle
        if (pathname.startsWith(`/${options.filename}`)) {
          const target = replaceExtension(options.filename, ".js.bundle");
          return url.replace(options.filename, target);
        }
        // rewrite /mf-manifest.json -> /[metro-project]/node_modules/.mf-metro/mf-manifest.json
        if (pathname.startsWith(`/${MANIFEST_FILENAME}`)) {
          const root = config.projectRoot;
          const target = manifestPath.replace(root, "[metro-project]");
          return url.replace(MANIFEST_FILENAME, target);
        }
        // pass through to original rewriteRequestUrl
        if (config.server.rewriteRequestUrl) {
          return config.server.rewriteRequestUrl(url);
        }
        return url;
      },
    },
  };
}

export { withModuleFederation };
