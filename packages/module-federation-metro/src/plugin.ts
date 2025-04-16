import path from "node:path";
import fs from "node:fs";
import type { ConfigT } from "metro-config";

interface ModuleFederationConfiguration {
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
    sharedString = sharedString.replace(`"__SHARED_${name}__"`, entry);
  });

  return sharedString;
}

function getInitHostModule(options: ModuleFederationConfiguration) {
  const initHostPath = require.resolve("./runtime/init-host.js");
  let initHostContent = fs.readFileSync(initHostPath, "utf-8");

  const sharedString = getSharedString(options);

  // auto-inject 'metro-core-plugin' MF runtime plugin
  const plugins = [require.resolve("../runtime-plugin.js"), ...options.plugins];

  // Replace placeholders with actual values
  initHostContent = initHostContent
    .replace("__NAME__", JSON.stringify(options.name))
    .replace("__REMOTES__", generateRemotes(options.remotes))
    .replace("__SHARED__", sharedString)
    .replace("__PLUGINS__", generateRuntimePlugins(plugins));

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
  return templateString.replace(
    '"__LIB_PLACEHOLDER__"',
    `() => require("${name}")`
  );
}

function getSharedModule(name: string) {
  const sharedTemplatePath = require.resolve("./runtime/shared.js");

  return fs
    .readFileSync(sharedTemplatePath, "utf-8")
    .replace("__SHARED_MODULE_NAME__", `"${name}"`);
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

function getInitContainerModule(
  options: ModuleFederationConfiguration,
  mfMetroPath: string
) {
  const initContainerPath = require.resolve("./templates/remote-entry.js");
  let initContainerCode = fs.readFileSync(initContainerPath, "utf-8");

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

  return initContainerCode
    .replace("__PLUGINS__", "[]")
    .replace("__SHARED__", sharedString)
    .replace("__EXPOSES_MAP__", `{${exposesString}}`)
    .replace("__NAME__", `"${options.name}"`);
}

function withModuleFederation(
  config: ConfigT,
  options: ModuleFederationConfiguration
): ConfigT {
  const projectNodeModulesPath = path.resolve(
    config.projectRoot,
    "node_modules"
  );
  const mfMetroPath = createMFRuntimeNodeModules(projectNodeModulesPath);

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

  const initContainerCode = getInitContainerModule(options, mfMetroPath);
  const initContainerPath = path.join(mfMetroPath, "init-container.js");

  fs.writeFileSync(initContainerPath, initContainerCode);

  const asyncRequirePath = path.resolve(__dirname, "../async-require.js");

  return {
    ...config,
    serializer: {
      ...config.serializer,
      getModulesRunBeforeMainModule: (entryFilePath) => {
        return [initHostFilePath, asyncRequirePath];
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

        // virtual module: init-container
        if (moduleName === "mf:init-container") {
          return {
            type: "sourceFile",
            filePath: initContainerPath,
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
  };
}

export { withModuleFederation };
