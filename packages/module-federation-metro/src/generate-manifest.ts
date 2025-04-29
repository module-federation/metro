import type { Manifest } from "@module-federation/sdk";
import type { ModuleFederationConfiguration } from "./plugin";

export default function generateManifest(
  config: ModuleFederationConfiguration
): Manifest {
  return {
    id: config.name,
    name: config.name,
    metaData: {
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
    },
    remotes: Object.keys(config.remotes || {}).map((remote) => ({
      federationContainerName: config.remotes[remote],
      moduleName: remote,
      alias: remote,
      entry: "*",
    })),
    shared: Object.keys(config.shared).map((shared) => ({
      id: shared,
      name: shared,
      version: config.shared[shared].version,
      requiredVersion: config.shared[shared].requiredVersion,
      singleton: config.shared[shared].singleton,
      hash: "",
      assets: {
        js: {
          sync: [],
          async: [],
        },
        css: {
          sync: [],
          async: [],
        },
      },
    })),
    exposes: Object.keys(config.exposes || {}).map((expose) => {
      const formatKey = expose.replace("./", "");
      return {
        id: `${config.name}:${formatKey}`,
        name: formatKey,
        path: expose,
        assets: {
          js: {
            sync: [(config.exposes || {})[expose]],
            async: [],
          },
          css: {
            sync: [],
            async: [],
          },
        },
      };
    }),
  };
}
