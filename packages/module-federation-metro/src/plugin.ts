import path from "node:path";
import fs from "node:fs";
import type { ConfigT } from "metro-config";
import generateManifest from "./generate-manifest";

export interface ModuleFederationConfiguration {
  name: string;
  filename: string;
  shared: Record<
    string,
    {
      singleton: boolean;
      eager: boolean;
      version: string;
      requiredVersion: string;
    }
  >;
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
  let initHostContent = fs.readFileSync(initHostPath, "utf-8");

  const sharedString = getSharedString(options);

  // Replace placeholders with actual values
  initHostContent = initHostContent
    .replaceAll("__NAME__", JSON.stringify(options.name))
    .replaceAll("__REMOTES__", generateRemotes(options.remotes))
    .replaceAll("__SHARED__", sharedString)
    .replaceAll("__PLUGINS__", generateRuntimePlugins(options.plugins));

  return initHostContent;
}

function createSharedModuleEntry(
  name: string,
  options: { version: string; config: Record<any, any> }
) {
  const template = {
    version: options.version,
    scope: "default",
    lib: "__LIB_PLACEHOLDER__",
    shareConfig: {
      singleton: true,
      eager: true,
      requiredVersion: options.version,
    },
  };

  const templateString = JSON.stringify(template);
  return templateString.replaceAll(
    '"__LIB_PLACEHOLDER__"',
    `() => require("${name}")`
  );
}

function getSharedModule(name: string) {
  const sharedTemplatePath = require.resolve("./runtime/shared.js");

  return fs
    .readFileSync(sharedTemplatePath, "utf-8")
    .replaceAll("__SHARED_MODULE_NAME__", `"${name}"`);
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

function withModuleFederation(
  config: ConfigT,
  federationOptions: ModuleFederationConfiguration
): ConfigT {
  const options = { ...federationOptions };

  const isContainer = !!options.exposes;
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

  const initHostModule = getInitHostModule(options);
  const initHostFilePath = path.join(mfMetroPath, "init-host.js");

  fs.writeFileSync(initHostFilePath, initHostModule, "utf-8");

  const sharedModulesPaths: Record<string, string> = {};

  Object.keys(options.shared).forEach((name) => {
    const sharedModule = getSharedModule(name);
    const sharedFilePath = path.join(mfMetroPath, "shared", `${name}.js`);

    fs.writeFileSync(sharedFilePath, sharedModule, "utf-8");

    sharedModulesPaths[name] = sharedFilePath;
  });

  let remoteEntryPath: string | undefined;
  if (isContainer) {
    const filename = options.filename ?? "remoteEntry.js";
    remoteEntryPath = path.join(mfMetroPath, filename);
    fs.writeFileSync(remoteEntryPath, getRemoteEntryModule(options));
  }

  const asyncRequirePath = path.resolve(__dirname, "../async-require.js");

  const manifestPath = path.join(mfMetroPath, "mf-manifest.json");
  const manifest = generateManifest(options);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, undefined, 2));

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
        return [initHostFilePath];
      },
    },
    resolver: {
      ...config.resolver,
      resolveRequest: (context, moduleName, platform) => {
        // virtual module: init-host
        if (moduleName === "mf:init-host") {
          return {
            type: "sourceFile",
            filePath: initHostFilePath,
          };
        }

        // virtual module: async-require
        if (moduleName === "mf:async-require") {
          return {
            type: "sourceFile",
            filePath: asyncRequirePath,
          };
        }

        // virtual entrypoint to create MF containers
        // MF options.filename is provided as a name only and will be requested from the root of project
        // so the filename mini.js becomes ./mini.js and we need to match exactly that
        if (moduleName === `./${options.filename}`) {
          return {
            type: "sourceFile",
            filePath: remoteEntryPath as string,
          };
        }

        // shared modules
        // init-host contains definition of shared modules so we need to prevent
        // circular import of shared module, by allowing import shared dependencies directly
        if (![initHostFilePath].includes(context.originModulePath)) {
          if (Object.keys(options.shared).includes(moduleName)) {
            return {
              type: "sourceFile",
              filePath: sharedModulesPaths[moduleName],
            };
          }
        }

        return context.resolveRequest(context, moduleName, platform);
      },
    },
    server: {
      ...config.server,
      enhanceMiddleware: (metroMiddleware) => {
        return (req, res, next) => {
          if (req.url === "/mf-manifest.json") {
            console.log("Serving MF manifest");
            res.setHeader("Content-Type", "application/json");
            res.writeHead(200);
            res.end(JSON.stringify(manifest));
          } else {
            // @ts-ignore
            metroMiddleware(req, res, next);
          }
        };
      },
    },
  };
}

export { withModuleFederation };
