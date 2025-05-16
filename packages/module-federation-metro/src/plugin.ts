import path from "node:path";
import fs from "node:fs";
import type { ConfigT, TransformerConfigT } from "metro-config";
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

function getSharedString(
  options: ModuleFederationConfigNormalized,
  forceEager: boolean = false
) {
  const shared = Object.keys(options.shared).reduce((acc, name) => {
    acc[name] = `__SHARED_${name}__`;
    return acc;
  }, {} as Record<string, string>);

  let sharedString = JSON.stringify(shared);
  Object.keys(options.shared).forEach((name) => {
    const sharedConfig = options.shared[name];
    const entry = createSharedModuleEntry(name, sharedConfig, forceEager);
    sharedString = sharedString.replaceAll(`"__SHARED_${name}__"`, entry);
  });

  return sharedString;
}

function getInitHostModule(options: ModuleFederationConfigNormalized) {
  const initHostPath = require.resolve("./runtime/init-host.js");
  let initHostModule = fs.readFileSync(initHostPath, "utf-8");

  // force all shared modules in host to be eager
  const sharedString = getSharedString(options, true);

  // Replace placeholders with actual values
  initHostModule = initHostModule
    .replaceAll("__NAME__", JSON.stringify(options.name))
    .replaceAll("__REMOTES__", generateRemotes(options.remotes))
    .replaceAll("__SHARED__", sharedString)
    .replaceAll("__PLUGINS__", generateRuntimePlugins(options.plugins))
    .replaceAll("__SHARE_STRATEGY__", JSON.stringify(options.shareStrategy));

  return initHostModule;
}

function getSharedRegistryModule(options: ModuleFederationConfigNormalized) {
  const sharedRegistryPath = require.resolve("./runtime/shared-registry.js");
  let sharedRegistryModule = fs.readFileSync(sharedRegistryPath, "utf-8");

  sharedRegistryModule = sharedRegistryModule.replaceAll(
    "__NAME__",
    JSON.stringify(options.name)
  );

  return sharedRegistryModule;
}

interface SharedModuleTemplate {
  version: string;
  scope: string;
  get?: string;
  lib?: string;
  shareConfig: {
    singleton: boolean;
    eager: boolean;
    requiredVersion: string;
  };
}

function createSharedModuleEntry(
  name: string,
  options: SharedConfig,
  forceEager: boolean
) {
  const template: SharedModuleTemplate = {
    version: options.version,
    scope: "default",
    shareConfig: {
      singleton: options.singleton,
      eager: options.eager,
      requiredVersion: options.requiredVersion,
    },
  };

  if (options.eager || forceEager) {
    template.lib = `__LIB_PLACEHOLDER__`;
    template.get = `__GET_SYNC_PLACEHOLDER__`;
  } else {
    template.get = `__GET_ASYNC_PLACEHOLDER__`;
  }

  const templateString = JSON.stringify(template);

  return templateString
    .replaceAll('"__LIB_PLACEHOLDER__"', `() => require("${name}")`)
    .replaceAll('"__GET_SYNC_PLACEHOLDER__"', `() => () => require("${name}")`)
    .replaceAll(
      '"__GET_ASYNC_PLACEHOLDER__"',
      `async () => import("${name}").then((m) => () => m)`
    );
}

function getSharedModule(name: string) {
  const sharedTemplatePath = require.resolve("./runtime/shared.js");

  return fs
    .readFileSync(sharedTemplatePath, "utf-8")
    .replaceAll("__MODULE_ID__", `"${name}"`);
}

function createMFRuntimeNodeModules(projectNodeModulesPath: string) {
  const mfMetroPath = path.join(projectNodeModulesPath, ".mf-metro");

  if (!fs.existsSync(mfMetroPath)) {
    fs.mkdirSync(mfMetroPath, { recursive: true });
  }

  const sharedPath = path.join(mfMetroPath, "shared");
  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

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
    .map(
      (key) =>
        `"${key}": async () => {
      const module = await import("../../${exposes[key]}");

      const target = { ...module };

      Object.defineProperty(target, "__esModule", { value: true, enumerable: false });

      return target;
    }
    `
    )
    .join(",");

  return remoteEntryModule
    .replaceAll("__PLUGINS__", generateRuntimePlugins(options.plugins))
    .replaceAll("__SHARED__", sharedString)
    .replaceAll("__EXPOSES_MAP__", `{${exposesString}}`)
    .replaceAll("__NAME__", `"${options.name}"`)
    .replaceAll("__SHARE_STRATEGY__", JSON.stringify(options.shareStrategy));
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

function createSharedRegistryVirtualModule(
  options: ModuleFederationConfigNormalized,
  vmDirPath: string
) {
  const sharedRegistryModule = getSharedRegistryModule(options);
  const sharedRegistryPath = path.join(vmDirPath, "shared-registry.js");
  fs.writeFileSync(sharedRegistryPath, sharedRegistryModule, "utf-8");
  return sharedRegistryPath;
}

function createSharedVirtualModules(
  options: ModuleFederationConfigNormalized,
  vmDirPath: string
) {
  const sharedModulesPaths: Record<string, string> = {};
  Object.keys(options.shared).forEach((name) => {
    const sharedModule = getSharedModule(name);
    const sharedFilePath = path.join(vmDirPath, "shared", `${name}.js`);
    fs.writeFileSync(sharedFilePath, sharedModule, "utf-8");
    sharedModulesPaths[name] = sharedFilePath;
  });
  return sharedModulesPaths;
}

function normalizeOptions(
  options: ModuleFederationConfig
): ModuleFederationConfigNormalized {
  const filename = options.filename ?? "remoteEntry.js";
  // this is different from the default share strategy in mf-core
  // it makes more sense to have loaded-first as default on mobile
  // in order to avoid longer TTI upon app startup
  const shareStrategy = options.shareStrategy ?? "loaded-first";

  return {
    name: options.name,
    filename,
    remotes: options.remotes ?? {},
    exposes: options.exposes ?? {},
    shared: options.shared ?? {},
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

  // auto-inject 'metro-core-plugin' MF runtime plugin
  options.plugins = [
    require.resolve("../runtime-plugin.js"),
    ...options.plugins,
  ].map((plugin) => path.relative(mfMetroPath, plugin));

  const sharedRegistryPath = createSharedRegistryVirtualModule(
    options,
    mfMetroPath
  );

  const sharedModulesPaths = createSharedVirtualModules(options, mfMetroPath);

  const initHostPath = isHost
    ? createInitHostVirtualModule(options, mfMetroPath)
    : null;

  let remoteEntryPath: string | undefined;
  if (isRemote) {
    const filename = options.filename ?? "remoteEntry.js";
    remoteEntryPath = path.join(mfMetroPath, filename);
    fs.writeFileSync(remoteEntryPath, getRemoteEntryModule(options));
  }

  const asyncRequireHostPath = path.resolve(
    __dirname,
    "../async-require-host.js"
  );
  const asyncRequireRemotePath = path.resolve(
    __dirname,
    "../async-require-remote.js"
  );

  const manifestPath = path.join(mfMetroPath, "mf-manifest.json");
  const manifest = generateManifest(options);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, undefined, 2));

  // pass data to bundle-mf-remote command
  global.__METRO_FEDERATION_CONFIG = options;
  global.__METRO_FEDERATION_REMOTE_ENTRY_PATH = remoteEntryPath;
  global.__METRO_FEDERATION_MANIFEST_PATH = manifestPath;

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
        if (moduleName === "mf:init-host") {
          return { type: "sourceFile", filePath: initHostPath as string };
        }

        // virtual module: async-require-host
        if (moduleName === "mf:async-require-host") {
          return { type: "sourceFile", filePath: asyncRequireHostPath };
        }

        // virtual module: async-require-remote
        if (moduleName === "mf:async-require-remote") {
          return { type: "sourceFile", filePath: asyncRequireRemotePath };
        }

        // virtual module: shared-registry
        if (moduleName === "mf:shared-registry") {
          return { type: "sourceFile", filePath: sharedRegistryPath };
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
            const sharedPath = sharedModulesPaths[moduleName];
            return { type: "sourceFile", filePath: sharedPath };
          } else {
            return context.resolveRequest(context, moduleName, platform);
          }
        }

        // shared modules
        if (Object.keys(options.shared).includes(moduleName)) {
          const sharedPath = sharedModulesPaths[moduleName];
          return { type: "sourceFile", filePath: sharedPath };
        }

        return context.resolveRequest(context, moduleName, platform);
      },
    },
    server: {
      ...config.server,
      enhanceMiddleware: createEnhanceMiddleware(manifestPath),
    },
  };
}

export { withModuleFederation };
