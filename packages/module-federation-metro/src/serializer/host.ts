import fs from "node:fs";
import path from "node:path";
import type { ModuleFederationConfigNormalized } from "../types";
import { generateRuntimePlugins } from "./plugins";
import { generateRemotes } from "./remote";
import { getEarlySharedDeps, getSharedString } from "./shared";

export function createInitHostVirtualModule(
  options: ModuleFederationConfigNormalized,
  vmDirPath: string
) {
  const initHostModule = getInitHostModule(options);
  const initHostPath = path.join(vmDirPath, "init-host.js");
  fs.writeFileSync(initHostPath, initHostModule, "utf-8");
  return initHostPath;
}

function getInitHostModule(options: ModuleFederationConfigNormalized) {
  const initHostPath = require.resolve("../runtime/init-host.js");
  let initHostModule = fs.readFileSync(initHostPath, "utf-8");

  const sharedString = getSharedString(options);

  // must be loaded synchronously at all times
  const earlySharedDeps = getEarlySharedDeps(options.shared);

  // Replace placeholders with actual values
  initHostModule = initHostModule
    .replaceAll("__NAME__", JSON.stringify(options.name))
    .replaceAll("__REMOTES__", generateRemotes(options.remotes))
    .replaceAll("__SHARED__", sharedString)
    .replaceAll("__EARLY_SHARED__", JSON.stringify(earlySharedDeps))
    .replaceAll("__PLUGINS__", generateRuntimePlugins(options.plugins))
    .replaceAll("__SHARE_STRATEGY__", JSON.stringify(options.shareStrategy));

  return initHostModule;
}
