import fs from "node:fs";
import path from "node:path";
import type {
  ModuleFederationConfigNormalized,
  Shared,
  SharedConfig,
} from "../types";

export function getEarlySharedDeps(shared: Shared) {
  return Object.keys(shared).filter((name) => {
    if (name === "react") return true;
    if (name === "react-native") return true;
    if (name.startsWith("react-native/")) return true;
    return false;
  });
}

export function getSharedString(options: ModuleFederationConfigNormalized) {
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

export function createSharedModuleEntry(name: string, options: SharedConfig) {
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

export function getSharedModule(name: string) {
  const sharedTemplatePath = require.resolve("../runtime/remote-module.js");

  return fs
    .readFileSync(sharedTemplatePath, "utf-8")
    .replaceAll("__MODULE_ID__", `"${name}"`);
}

export function createSharedModule(sharedName: string, outputDir: string) {
  const sharedFilePath = getSharedPath(sharedName, outputDir);
  // we need to create the shared module if it doesn't exist
  const sharedModule = getSharedModule(sharedName);
  fs.mkdirSync(path.dirname(sharedFilePath), { recursive: true });
  fs.writeFileSync(sharedFilePath, sharedModule, "utf-8");
  return sharedFilePath;
}

export function getSharedPath(name: string, dir: string) {
  const sharedName = name.replaceAll("/", "_");
  const sharedDir = path.join(dir, "shared");
  return path.join(sharedDir, `${sharedName}.js`);
}
