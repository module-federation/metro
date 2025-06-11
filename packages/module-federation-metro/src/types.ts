export interface SharedConfig {
  singleton: boolean;
  eager: boolean;
  version: string;
  requiredVersion: string;
  import?: false;
}

export type Shared = Record<string, SharedConfig>;

export type ManifestConfig = {
  filePath?: string;
  fileName?: string;
};

export interface ModuleFederationConfig {
  name: string;
  filename?: string;
  remotes?: Record<string, string>;
  exposes?: Record<string, string>;
  shared?: Shared;
  shareStrategy?: "loaded-first" | "version-first";
  plugins?: string[];
  manifest?: ManifestConfig;
}

export type ModuleFederationConfigNormalized =
  Required<ModuleFederationConfig> & { manifest: Required<ManifestConfig> };
