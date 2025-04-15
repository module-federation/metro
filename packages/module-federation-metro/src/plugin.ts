import path from "node:path";
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
    .replace("__SHARED__", sharedString);

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

function withModuleFederation(
  config: ConfigT,
  options: ModuleFederationConfiguration
): ConfigT {
  console.log("withModuleFederation plugin");

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
        // special case: init-host
        if (moduleName === "mf:init-host") {
          return {
            type: "sourceFile",
            filePath: initHostFilePath,
          };
        }

        // shared modules
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
