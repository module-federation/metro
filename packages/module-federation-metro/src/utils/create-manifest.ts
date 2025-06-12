import fs from "node:fs";
import generateManifest from "../generate-manifest";
import { ModuleFederationConfigNormalized } from "../types";

export const updateManifest = (
  manifestPath: string,
  options: ModuleFederationConfigNormalized
): string => {
  const manifest = generateManifest(options);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, undefined, 2));
  return manifestPath;
};
