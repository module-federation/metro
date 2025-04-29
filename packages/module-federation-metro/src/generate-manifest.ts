import type { Manifest, StatsAssets } from "@module-federation/sdk";
import type { ModuleFederationConfiguration } from "./plugin";

export default function generateManifest(
  config: ModuleFederationConfiguration
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
  config: ModuleFederationConfiguration
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
  config: ModuleFederationConfiguration
): Manifest["remotes"] {
  return Object.keys(config.remotes).map((remote) => ({
    federationContainerName: config.remotes[remote],
    moduleName: remote,
    alias: remote,
    entry: "*",
  }));
}

function generateShared(
  config: ModuleFederationConfiguration
): Manifest["shared"] {
  return Object.keys(config.shared).map((shared) => ({
    id: shared,
    name: shared,
    version: config.shared[shared].version,
    requiredVersion: config.shared[shared].requiredVersion,
    singleton: config.shared[shared].singleton,
    hash: "",
    assets: getEmptyAssets(),
  }));
}

function generateExposes(
  config: ModuleFederationConfiguration
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
