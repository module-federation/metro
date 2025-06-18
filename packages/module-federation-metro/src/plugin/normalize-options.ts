import fs from 'node:fs';
import path from 'node:path';
import type { ConfigT } from 'metro-config';
import type {
  ModuleFederationConfig,
  ModuleFederationConfigNormalized,
  Shared,
} from '../types';
import { DEFAULT_ENTRY_FILENAME } from './constants';

export function normalizeOptions(
  options: ModuleFederationConfig,
  config: ConfigT
): ModuleFederationConfigNormalized {
  const filename = options.filename ?? DEFAULT_ENTRY_FILENAME;

  const shared = getNormalizedShared(options, config);
  const shareStrategy = getNormalizedShareStrategy(options);

  return {
    name: options.name,
    filename,
    remotes: options.remotes ?? {},
    exposes: options.exposes ?? {},
    shared,
    shareStrategy,
    plugins: options.plugins ?? [],
  };
}

function getNormalizedShared(
  options: ModuleFederationConfig,
  config: ConfigT
): Shared {
  const pkg = getProjectPackageJson(config.projectRoot);
  const shared = options.shared ?? {};

  // force all shared modules in host to be eager
  if (!options.exposes) {
    for (const sharedName of Object.keys(shared)) {
      shared[sharedName].eager = true;
    }
  }

  // default requiredVersion
  for (const sharedName of Object.keys(shared)) {
    if (!shared[sharedName].requiredVersion) {
      // @ts-expect-error - TODO fix this
      shared[sharedName].requiredVersion =
        pkg.dependencies?.[sharedName] || pkg.devDependencies?.[sharedName];
    }
  }

  return shared;
}

function getNormalizedShareStrategy(options: ModuleFederationConfig) {
  // this is different from the default share strategy in mf-core
  // it makes more sense to have loaded-first as default on mobile
  // in order to avoid longer TTI upon app startup
  return options.shareStrategy ?? 'loaded-first';
}

function getProjectPackageJson(projectRoot: string): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
}
