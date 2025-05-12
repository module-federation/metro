export interface SharedConfig {
  singleton: boolean;
  eager: boolean;
  version: string;
  requiredVersion: string;
  import?: false;
}

export interface ModuleFederationConfig {
  name: string;
  filename?: string;
  remotes?: Record<string, string>;
  exposes?: Record<string, string>;
  shared?: Record<string, SharedConfig>;
  shareStrategy?: "loaded-first" | "version-first";
  plugins?: string[];
}

export type ModuleFederationConfigNormalized = Required<ModuleFederationConfig>;
