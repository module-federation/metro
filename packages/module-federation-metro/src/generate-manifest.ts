import type { Manifest, StatsAssets } from "@module-federation/sdk";
import type { ModuleFederationConfigNormalized } from "./types";

export default function generateManifest(
  config: ModuleFederationConfigNormalized
): Manifest {
  return {
    id: config.name,
    name: config.name,
    metaData: generateMetaData(config),
    remotes: generateRemotes(config),
    shared: generateShared(config),
    exposes: generateExposes(config),
  };
}

function generateMetaData(
  config: ModuleFederationConfigNormalized
): Manifest["metaData"] {
  return {
    name: config.name,
    type: "app",
    buildInfo: {
      buildVersion: "1.0.0",
      buildName: config.name,
    },
    remoteEntry: {
      name: `${config.filename}.bundle`,
      path: "",
      type: "global",
    },
    types: {
      path: "",
      name: "",
      api: "",
      zip: "",
    },
    globalName: config.name,
    pluginVersion: "",
    publicPath: "auto",
  };
}

function generateRemotes(
  config: ModuleFederationConfigNormalized
): Manifest["remotes"] {
  return Object.keys(config.remotes).map((remote) => ({
    federationContainerName: config.remotes[remote],
    moduleName: remote,
    alias: remote,
    entry: "*",
  }));
}

function generateShared(
  config: ModuleFederationConfigNormalized
): Manifest["shared"] {
  return Object.keys(config.shared).map((sharedName) => {
    const assets = getEmptyAssets();

    if (config.shared[sharedName].import !== false) {
      assets.js.sync.push(`shared/${sharedName}.bundle`);
    }

    return {
      id: sharedName,
      name: sharedName,
      version: config.shared[sharedName].version,
      requiredVersion: config.shared[sharedName].requiredVersion,
      singleton: config.shared[sharedName].singleton,
      hash: "",
      assets,
    };
  });
}

function generateExposes(
  config: ModuleFederationConfigNormalized
): Manifest["exposes"] {
  return Object.keys(config.exposes).map((expose) => {
    const formatKey = expose.replace("./", "");
    const assets = getEmptyAssets();

    assets.js.sync.push(config.exposes[expose]);

    return {
      id: `${config.name}:${formatKey}`,
      name: formatKey,
      path: expose,
      assets,
    };
  });
}

function getEmptyAssets(): StatsAssets {
  return {
    js: {
      sync: [],
      async: [],
    },
    css: {
      sync: [],
      async: [],
    },
  };
}
