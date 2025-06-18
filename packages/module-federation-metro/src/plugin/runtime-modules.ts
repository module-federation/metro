import fs from 'node:fs';
import path from 'node:path';
import type { ModuleFederationConfigNormalized, SharedConfig } from '../types';

export function getInitHostModule(options: ModuleFederationConfigNormalized) {
  const initHostPath = require.resolve('./runtime/init-host.js');
  let initHostModule = fs.readFileSync(initHostPath, 'utf-8');

  const sharedString = getSharedString(options);

  // Replace placeholders with actual values
  initHostModule = initHostModule
    .replaceAll('__NAME__', JSON.stringify(options.name))
    .replaceAll('__REMOTES__', generateRemotes(options.remotes))
    .replaceAll('__SHARED__', sharedString)
    .replaceAll('__PLUGINS__', generateRuntimePlugins(options.plugins))
    .replaceAll('__SHARE_STRATEGY__', JSON.stringify(options.shareStrategy));

  return initHostModule;
}

function generateRuntimePlugins(runtimePlugins: string[]) {
  const pluginNames: string[] = [];
  const pluginImports: string[] = [];

  runtimePlugins.forEach((plugin, index) => {
    const pluginName = `plugin${index}`;
    pluginNames.push(`${pluginName}()`);
    pluginImports.push(`import ${pluginName} from "${plugin}";`);
  });

  const imports = pluginImports.join('\n');
  const plugins = `const plugins = [${pluginNames.join(', ')}];`;

  return `${imports}\n${plugins}`;
}

function generateRemotes(remotes: Record<string, string> = {}) {
  const remotesEntries: string[] = [];
  for (const [remoteAlias, remoteEntry] of Object.entries(remotes)) {
    const remoteEntryParts = remoteEntry.split('@');
    const remoteName = remoteEntryParts[0];
    const remoteEntryUrl = remoteEntryParts.slice(1).join('@');

    remotesEntries.push(
      `{ 
          alias: "${remoteAlias}", 
          name: "${remoteName}", 
          entry: "${remoteEntryUrl}", 
          entryGlobalName: "${remoteName}", 
          type: "var" 
       }`
    );
  }

  return `[${remotesEntries.join(',\n')}]`;
}

function getSharedString(options: ModuleFederationConfigNormalized) {
  const shared = Object.keys(options.shared).reduce(
    (acc, name) => {
      acc[name] = `__SHARED_${name}__`;
      return acc;
    },
    {} as Record<string, string>
  );

  let sharedString = JSON.stringify(shared);
  for (const name of Object.keys(options.shared)) {
    const sharedConfig = options.shared[name];
    const entry = createSharedModuleEntry(name, sharedConfig);
    sharedString = sharedString.replaceAll(`"__SHARED_${name}__"`, entry);
  }

  return sharedString;
}

function createSharedModuleEntry(name: string, options: SharedConfig) {
  const template = {
    version: options.version,
    scope: 'default',
    shareConfig: {
      singleton: options.singleton,
      eager: options.eager,
      requiredVersion: options.requiredVersion,
    },
    get: options.eager
      ? '__GET_SYNC_PLACEHOLDER__'
      : '__GET_ASYNC_PLACEHOLDER__',
  };

  const templateString = JSON.stringify(template);

  return templateString
    .replaceAll('"__GET_SYNC_PLACEHOLDER__"', `() => () => require("${name}")`)
    .replaceAll(
      '"__GET_ASYNC_PLACEHOLDER__"',
      `async () => import("${name}").then((m) => () => m)`
    );
}

export function getRemoteModuleRegistryModule() {
  const registryPath = require.resolve('./runtime/remote-module-registry.js');
  let registryModule = fs.readFileSync(registryPath, 'utf-8');

  registryModule = registryModule.replaceAll(
    '__EARLY_MODULE_TEST__',
    '/^react(-native(\\/|$)|$)/'
  );

  return registryModule;
}

export function getRemoteHMRSetupModule() {
  const remoteHMRSetupTemplatePath = require.resolve('./runtime/remote-hmr.js');
  const remoteHMRSetupModule = fs.readFileSync(
    remoteHMRSetupTemplatePath,
    'utf-8'
  );

  return remoteHMRSetupModule;
}

export function getRemoteEntryModule(
  options: ModuleFederationConfigNormalized
) {
  const remoteEntryTemplatePath = require.resolve('./runtime/remote-entry.js');
  const remoteEntryModule = fs.readFileSync(remoteEntryTemplatePath, 'utf-8');

  const sharedString = getSharedString(options);

  const exposes = options.exposes || {};

  const exposesString = Object.keys(exposes)
    .map((key) => {
      const importName = path.relative('.', exposes[key]);
      const importPath = `../../${importName}`;

      return `"${key}": async () => {
          const module = await import("${importPath}");
          return module;
        }`;
    })
    .join(',');

  return remoteEntryModule
    .replaceAll('__PLUGINS__', generateRuntimePlugins(options.plugins))
    .replaceAll('__SHARED__', sharedString)
    .replaceAll('__REMOTES__', generateRemotes(options.remotes))
    .replaceAll('__EXPOSES_MAP__', `{${exposesString}}`)
    .replaceAll('__NAME__', `"${options.name}"`)
    .replaceAll('__SHARE_STRATEGY__', JSON.stringify(options.shareStrategy));
}

export function getRemoteModule(name: string) {
  const remoteTemplatePath = require.resolve('./runtime/remote-module.js');

  return fs
    .readFileSync(remoteTemplatePath, 'utf-8')
    .replaceAll('__MODULE_ID__', `"${name}"`);
}

export function createBabelTransformer({
  proxiedBabelTrasnsformerPath,
  mfConfig,
  mfMetroPath,
  blacklistedPaths,
}: {
  proxiedBabelTrasnsformerPath: string;
  mfConfig: ModuleFederationConfigNormalized;
  mfMetroPath: string;
  blacklistedPaths: string[];
}) {
  const babelTransformerPath = path.join(mfMetroPath, 'babel-transformer.js');

  const babelTransformerTemplate = fs.readFileSync(
    require.resolve('./runtime/babel-transformer.js'),
    'utf-8'
  );

  const babelTransformer = babelTransformerTemplate
    .replaceAll('__BABEL_TRANSFORMER_PATH__', proxiedBabelTrasnsformerPath)
    .replaceAll('__REMOTES__', JSON.stringify(mfConfig.remotes))
    .replaceAll('__SHARED__', JSON.stringify(mfConfig.shared))
    .replaceAll('__BLACKLISTED_PATHS__', JSON.stringify(blacklistedPaths));

  fs.writeFileSync(babelTransformerPath, babelTransformer, 'utf-8');

  return babelTransformerPath;
}
