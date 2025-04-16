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

function getInitHostModule(options: ModuleFederationConfiguration) {
  const initHostPath = require.resolve("./runtime/init-host.js");
  const fs = require("fs");
  let initHostContent = fs.readFileSync(initHostPath, "utf-8");

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

  // Replace placeholders with actual values
  initHostContent = initHostContent
    .replace("__NAME__", JSON.stringify(options.name))
    .replace("__REMOTES__", generateRemotes(options.remotes))
    .replace("__SHARED__", sharedString)
    .replace("__PLUGINS__", generateRuntimePlugins(options.plugins));

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

function writeInitHostModule(filePath: string, content: string) {
  const fs = require("fs");

  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function getSharedModule(name: string) {
  const sharedTemplatePath = require.resolve("./runtime/shared.js");
  const fs = require("fs");
  let sharedTemplate = fs.readFileSync(sharedTemplatePath, "utf-8");

  return sharedTemplate.replace("__SHARED_MODULE_NAME__", `"${name}"`);
}

function writeSharedModule(filePath: string, content: string) {
  const fs = require("fs");

  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function createMFRuntimeNodeModules(projectNodeModulesPath: string) {
  const fs = require("fs");
  const path = require("path");

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

function getInitContainerModule(options: ModuleFederationConfiguration) {
  const initContainerPath = require.resolve("./templates/remote-entry.js");
  let initContainerCode = fs.readFileSync(initContainerPath, "utf-8");

  return initContainerCode
    .replace("__PLUGINS__", "[]")
    .replace("__SHARED__", "[]")
    .replace("__EXPOSES_MAP__", JSON.stringify(options.exposes || {}))
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
  const initHostFilePath = writeInitHostModule(
    path.join(mfMetroPath, "init-host.js"),
    initHostModule
  );

  const sharedModulesPaths: Record<string, string> = {};

  Object.keys(options.shared).forEach((name) => {
    const sharedModule = getSharedModule(name);
    const sharedFilePath = path.join(mfMetroPath, "shared", `${name}.js`);
    writeSharedModule(sharedFilePath, sharedModule);
    sharedModulesPaths[name] = sharedFilePath;
  });

  const initContainerCode = getInitContainerModule(options);
  const initContainerPath = path.join(mfMetroPath, "init-container.js");

  fs.writeFileSync(initContainerPath, initContainerCode);

  return {
    ...config,
    serializer: {
      ...config.serializer,
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

        if (moduleName.includes("mf:init-container")) {
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
      }
    }
  }
}
