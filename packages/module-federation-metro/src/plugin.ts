import path from "node:path";
import fs from "node:fs";
import type { ConfigT } from "metro-config";
import type { Resolution } from "metro-resolver";
import generateManifest from "./generate-manifest";
import { getModuleFederationSerializer } from "./serializer";
import {
  ModuleFederationConfig,
  ModuleFederationConfigNormalized,
} from "./types";
import { ConfigError } from "./utils/errors";
import { createSharedModule, getSharedPath } from "./serializer/shared";
import { createRemoteModule } from "./serializer/remote";
import {
  getRemoteEntryModule,
  getRemoteHMRSetupModule,
} from "./serializer/container";
import { createRemoteModuleRegistryModule } from "./serializer/registry";
import { createInitHostVirtualModule } from "./serializer/host";

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
const DEFAULT_ENTRY_FILENAME = "remoteEntry.bundle";

function createMFRuntimeNodeModules(projectNodeModulesPath: string) {
  const mfMetroPath = path.join(projectNodeModulesPath, ".mf-metro");
  fs.mkdirSync(mfMetroPath, { recursive: true });
  return mfMetroPath;
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

function replaceExtension(filepath: string, extension: string) {
  const { dir, name } = path.parse(filepath);
  return path.format({ dir, name, ext: extension });
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

  validateOptions(options);

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

  let remoteEntryFilename: string | undefined,
    remoteEntryPath: string | undefined,
    remoteHMRSetupPath: string | undefined;

  if (isRemote) {
    remoteEntryFilename = replaceExtension(options.filename, ".js");
    remoteEntryPath = path.join(mfMetroPath, remoteEntryFilename);
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
      customSerializer: getModuleFederationSerializer(options),
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
        if (moduleName === `./${remoteEntryFilename}`) {
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
