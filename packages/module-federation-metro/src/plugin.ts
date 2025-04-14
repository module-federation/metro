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

function withModuleFederation(
  config: ConfigT,
  options: ModuleFederationConfiguration
): ConfigT {
  console.log("withModuleFederation plugin");

  return config;
}

export { withModuleFederation };
