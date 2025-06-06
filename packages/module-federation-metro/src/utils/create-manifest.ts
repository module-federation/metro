import path from "node:path";
import fs from "node:fs";
import generateManifest from "../generate-manifest";
import { ModuleFederationConfigNormalized } from "../types";

export const createManifest = (
  mfMetroPath: string,
  MANIFEST_FILENAME: string,
  options: ModuleFederationConfigNormalized
): string => {
  const manifestPath = path.join(mfMetroPath, MANIFEST_FILENAME);
  const manifest = generateManifest(options);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, undefined, 2));

  return manifestPath;
};

export const updateManifest = (
  manifestPath: string,
  options: ModuleFederationConfigNormalized
): string => {
  const manifest = generateManifest(options);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, undefined, 2));
  return manifestPath;
};
