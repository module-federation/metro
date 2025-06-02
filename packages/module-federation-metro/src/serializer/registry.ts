import fs from "node:fs";
import path from "node:path";
import type { ModuleFederationConfigNormalized } from "../types";

export function getRemoteModuleRegistryModule(
  options: ModuleFederationConfigNormalized
) {
  const registryPath = require.resolve("../runtime/remote-module-registry.js");
  let registryModule = fs.readFileSync(registryPath, "utf-8");

  registryModule = registryModule.replaceAll(
    "__EARLY_MODULE_TEST__",
    "/^react(-native(\\/|$)|$)/"
  );

  return registryModule;
}

export function createRemoteModuleRegistryModule(
  options: ModuleFederationConfigNormalized,
  vmDirPath: string
) {
  const registryModule = getRemoteModuleRegistryModule(options);
  const registryPath = path.join(vmDirPath, "remote-module-registry.js");
  fs.writeFileSync(registryPath, registryModule, "utf-8");
  return registryPath;
}
