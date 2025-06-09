type Logger = {
  success: (...messages: Array<unknown>) => void;
  info: (...messages: Array<unknown>) => void;
  warn: (...messages: Array<unknown>) => void;
  error: (...messages: Array<unknown>) => void;
  debug: (...messages: Array<unknown>) => void;
  log: (...messages: Array<unknown>) => void;
};

export interface BundleFederatedHostConfig {
  root: string;
  platforms: Record<string, object>;
  reactNativePath: string;
  logger?: Logger;
}

export type BundleFederatedHostArgs = {
  entryFile: string;
  platform: string;
  dev: boolean;
  minify?: boolean;
  bundleEncoding?: "utf8" | "utf16le" | "ascii";
  maxWorkers?: string;
  sourcemapOutput?: string;
  sourcemapSourcesRoot?: string;
  sourcemapUseAbsolutePath?: boolean;
  assetsDest?: string;
  assetCatalogDest?: string;
  resetCache?: boolean;
  config?: string;
  output?: string;
};
