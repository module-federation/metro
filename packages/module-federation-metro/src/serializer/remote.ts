import fs from "node:fs";
import path from "node:path";

export function generateRemotes(remotes: Record<string, string> = {}) {
  const remotesEntries: string[] = [];
  Object.entries(remotes).forEach(([remoteAlias, remoteEntry]) => {
    const remoteEntryParts = remoteEntry.split("@");
    const remoteName = remoteEntryParts[0];
    const remoteEntryUrl = remoteEntryParts.slice(1).join("@");

    remotesEntries.push(
      `{ 
          alias: "${remoteAlias}", 
          name: "${remoteName}", 
          entry: "${remoteEntryUrl}", 
          entryGlobalName: "${remoteName}", 
          type: "var" 
       }`
    );
  });

  return `[${remotesEntries.join(",\n")}]`;
}

export function getRemoteModule(name: string) {
  const remoteTemplatePath = require.resolve("../runtime/remote-module.js");

  return fs
    .readFileSync(remoteTemplatePath, "utf-8")
    .replaceAll("__MODULE_ID__", `"${name}"`);
}

export function createRemoteModule(name: string, outputDir: string) {
  const remoteModule = getRemoteModule(name);
  const remoteFilePath = getRemoteModulePath(name, outputDir);
  fs.mkdirSync(path.dirname(remoteFilePath), { recursive: true });
  fs.writeFileSync(remoteFilePath, remoteModule, "utf-8");
  return remoteFilePath;
}

export function getRemoteModulePath(name: string, outputDir: string) {
  const remoteModuleName = name.replaceAll("/", "_");
  const remoteModulePath = path.join(
    outputDir,
    "remote",
    `${remoteModuleName}.js`
  );
  return remoteModulePath;
}
