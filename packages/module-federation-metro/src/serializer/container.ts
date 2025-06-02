import fs from "node:fs";
import path from "node:path";

import type { ModuleFederationConfigNormalized } from "../types";
import { getEarlySharedDeps, getSharedString } from "./shared";
import { generateRuntimePlugins } from "./plugins";
import { generateRemotes } from "./remote";

export function getRemoteEntryModule(
  options: ModuleFederationConfigNormalized
) {
  const remoteEntryTemplatePath = require.resolve("../runtime/remote-entry.js");
  let remoteEntryModule = fs.readFileSync(remoteEntryTemplatePath, "utf-8");

  const sharedString = getSharedString(options);
  const earlySharedDeps = getEarlySharedDeps(options.shared);

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
    .replaceAll("__EARLY_SHARED__", JSON.stringify(earlySharedDeps))
    .replaceAll("__EXPOSES_MAP__", `{${exposesString}}`)
    .replaceAll("__NAME__", `"${options.name}"`)
    .replaceAll("__SHARE_STRATEGY__", JSON.stringify(options.shareStrategy));
}

export function getRemoteHMRSetupModule() {
  const remoteHMRSetupTemplatePath = require.resolve(
    "../runtime/remote-hmr.js"
  );
  let remoteHMRSetupModule = fs.readFileSync(
    remoteHMRSetupTemplatePath,
    "utf-8"
  );

  return remoteHMRSetupModule;
}
