import path from "node:path";
import fs from "node:fs";
import type { ConfigT } from "metro-config";

interface SharedConfig {
  singleton: boolean;
  eager: boolean;
  version: string;
  requiredVersion: string;
  import?: false;
}

interface ModuleFederationConfiguration {
  name: string;
  filename: string;
  shared: Record<string, SharedConfig>;
  plugins: string[];
  remotes: Record<string, string>;
  exposes?: Record<string, string>;
}

function getSharedString(options: ModuleFederationConfiguration) {
  const shared = Object.keys(options.shared).reduce((acc, name) => {
    acc[name] = `__SHARED_${name}__`;
    return acc;
  }, {} as Record<string, string>);

  let sharedString = JSON.stringify(shared);
  Object.keys(options.shared).forEach((name) => {
    // @ts-ignore
    const entry = createSharedModuleEntry(name, options.shared[name]);
    sharedString = sharedString.replaceAll(`"__SHARED_${name}__"`, entry);
  });

  return sharedString;
}

function getInitHostModule(options: ModuleFederationConfiguration) {
  const initHostPath = require.resolve("./runtime/init-host.js");
  let initHostModule = fs.readFileSync(initHostPath, "utf-8");

  const sharedString = getSharedString(options);

  // Replace placeholders with actual values
  initHostModule = initHostModule
    .replaceAll("__NAME__", JSON.stringify(options.name))
    .replaceAll("__REMOTES__", generateRemotes(options.remotes))
    .replaceAll("__SHARED__", sharedString)
    .replaceAll("__PLUGINS__", generateRuntimePlugins(options.plugins));

  return initHostModule;
}

function getSharedRegistryModule(options: ModuleFederationConfiguration) {
  const sharedRegistryPath = require.resolve("./runtime/shared-registry.js");
  let sharedRegistryModule = fs.readFileSync(sharedRegistryPath, "utf-8");

  sharedRegistryModule = sharedRegistryModule.replaceAll(
    "__NAME__",
    JSON.stringify(options.name)
  );

  return sharedRegistryModule;
}

function createSharedModuleEntry(name: string, options: SharedConfig) {
  const template = {
    version: options.version,
    scope: "default",
    get: "__GET_PLACEHOLDER__",
    shareConfig: {
      singleton: options.singleton,
      eager: options.eager,
      requiredVersion: options.requiredVersion,
    },
  };
  const templateString = JSON.stringify(template);

  return templateString.replaceAll(
    '"__GET_PLACEHOLDER__"',
    `() => () => require("${name}")`
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
  Object.entries(remotes).forEach(([remoteName, remoteEntry]) => {
    remotesEntries.push(
      `{ 
          alias: "${remoteName}", 
          name: "${remoteName}", 
          entry: "${remoteEntry}", 
          entryGlobalName: "${remoteName}", 
          type: "var" }`
    );
  });

  return `[${remotesEntries.join(",\n")}]`;
}

function getRemoteEntryModule(options: ModuleFederationConfiguration) {
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
    .replaceAll("__NAME__", `"${options.name}"`);
}

function createInitHostVirtualModule(
  options: ModuleFederationConfiguration,
  vmDirPath: string
) {
  const initHostModule = getInitHostModule(options);
  const initHostPath = path.join(vmDirPath, "init-host.js");
  fs.writeFileSync(initHostPath, initHostModule, "utf-8");
  return initHostPath;
}

function createSharedRegistryVirtualModule(
  options: ModuleFederationConfiguration,
  vmDirPath: string
) {
  const sharedRegistryModule = getSharedRegistryModule(options);
  const sharedRegistryPath = path.join(vmDirPath, "shared-registry.js");
  fs.writeFileSync(sharedRegistryPath, sharedRegistryModule, "utf-8");
  return sharedRegistryPath;
}

function withModuleFederation(
  config: ConfigT,
  federationOptions: ModuleFederationConfiguration
): ConfigT {
  const options = { ...federationOptions };

  const isHost = !options.exposes;
  const isContainer = !isHost;

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

  const initHostPath = isHost
    ? createInitHostVirtualModule(options, mfMetroPath)
    : null;

  const sharedModulesPaths: Record<string, string> = {};

  if (options.shared) {
    Object.keys(options.shared).forEach((name) => {
      const sharedModule = getSharedModule(name);
      const sharedFilePath = path.join(mfMetroPath, "shared", `${name}.js`);

      fs.writeFileSync(sharedFilePath, sharedModule, "utf-8");
      sharedModulesPaths[name] = sharedFilePath;
    });
  }

  let remoteEntryPath: string | undefined;
  if (isContainer) {
    const filename = options.filename ?? "remoteEntry.js";
    remoteEntryPath = path.join(mfMetroPath, filename);
    fs.writeFileSync(remoteEntryPath, getRemoteEntryModule(options));
  }

  const asyncRequirePath = path.resolve(__dirname, "../async-require.js");

  return {
    ...config,
    serializer: {
      ...config.serializer,
      createModuleIdFactory: () => {
        // identical to metro's default module id factory
        // but we offset the ids for container modules by 10000
        // reference: https://github.com/facebook/metro/blob/cc7316b1f40ed5e4202a997673b26d55ff1b4ca5/packages/metro/src/lib/createModuleIdFactory.js
        const fileToIdMap: Map<string, number> = new Map();
        let nextId = isContainer ? 10000 : 0;
        return (modulePath: string) => {
          let id = fileToIdMap.get(modulePath);
          if (typeof id !== "number") {
            id = nextId++;
            fileToIdMap.set(modulePath, id);
          }
          return id;
        };
      },
      getModulesRunBeforeMainModule: (entryFilePath) => {
        return initHostPath ? [initHostPath] : [];
      },
    },
    resolver: {
      ...config.resolver,
      resolveRequest: (context, moduleName, platform) => {
        // virtual module: init-host
        if (moduleName === "mf:init-host") {
          return { type: "sourceFile", filePath: initHostPath as string };
        }

        // virtual module: async-require
        if (moduleName === "mf:async-require") {
          return { type: "sourceFile", filePath: asyncRequirePath };
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
  };
}

export { withModuleFederation };
