import type { MetroConfig } from "metro-config";

function withModuleFederation(config: MetroConfig) {
  console.log("withModuleFederation plugin");

  return config;
}

export { withModuleFederation };
