import path from "node:path";
import { pathToFileURL } from "node:url";
import chalk from "chalk";
import { promises as fs } from "fs";
import { mergeConfig } from "metro";
import Server from "metro/src/Server";
import type { RequestOptions, OutputOptions } from "metro/src/shared/types";
import type { ModuleFederationConfigNormalized } from "../types";
import loadMetroConfig from "./utils/loadMetroConfig";
import relativizeSerializedMap from "./utils/relativizeSerializedMap";
import { CLIError } from "../utils/errors";
import { createResolver } from "./utils/createResolver";
import { createModulePathRemapper } from "./utils/createModulePathRemapper";
import {
  BundleFederatedRemoteArgs,
  BundleFederatedRemoteConfig,
} from "./types";

declare global {
  var __METRO_FEDERATION_CONFIG: ModuleFederationConfigNormalized;
  var __METRO_FEDERATION_REMOTE_ENTRY_PATH: string | undefined;
  var __METRO_FEDERATION_MANIFEST_PATH: string | undefined;
}

interface ModuleDescriptor {
  [moduleName: string]: {
    isContainerModule?: boolean;
    moduleInputFilepath: string;
    moduleOutputDir: string;
  };
}

interface BundleRequestOptions extends RequestOptions {
  lazy: boolean;
  modulesOnly: boolean;
  runModule: boolean;
  sourceUrl: string;
}

async function buildBundle(server: Server, requestOpts: BundleRequestOptions) {
  const bundle = await server.build({
    ...Server.DEFAULT_BUNDLE_OPTIONS,
    ...requestOpts,
    bundleType: "bundle",
  });

  return bundle;
}

async function saveBundleAndMap(
  bundle: { code: string; map: string },
  options: OutputOptions,
  log: (msg: string) => void
) {
  const {
    bundleOutput,
    bundleEncoding: encoding,
    sourcemapOutput,
    sourcemapSourcesRoot,
  } = options;

  const writeFns = [];

  writeFns.push(async () => {
    log(`Writing bundle output to:\n${chalk.dim(bundleOutput)}`);
    await fs.writeFile(bundleOutput, bundle.code, encoding);
    log("Done writing bundle output");
  });

  if (sourcemapOutput) {
    let { map } = bundle;
    if (sourcemapSourcesRoot != null) {
      log("Start relativating source map");

      map = relativizeSerializedMap(map, sourcemapSourcesRoot);
      log("Finished relativating");
    }

    writeFns.push(async () => {
      log(`Writing sourcemap output to:\n${chalk.dim(sourcemapOutput)}`);
      await fs.writeFile(sourcemapOutput, map);
      log("Done writing sourcemap output");
    });
  }

  // Wait until everything is written to disk.
  await Promise.all(writeFns.map((cb) => cb()));
}

function getRequestOpts(
  args: BundleFederatedRemoteArgs,
  opts: {
    isContainerModule: boolean;
    entryFile: string;
    sourceUrl: string;
    sourceMapUrl: string;
  }
): BundleRequestOptions {
  return {
    dev: args.dev,
    minify: args.minify !== undefined ? args.minify : !args.dev,
    platform: args.platform,
    entryFile: opts.entryFile,
    sourceUrl: opts.sourceUrl,
    sourceMapUrl: opts.sourceMapUrl,
    // only use lazy for container bundles
    lazy: opts.isContainerModule,
    // only run module for container bundles
    runModule: opts.isContainerModule,
    // remove prelude for non-container modules
    modulesOnly: !opts.isContainerModule,
  };
}

function getSaveBundleOpts(
  args: BundleFederatedRemoteArgs,
  opts: {
    bundleOutput: string;
    sourcemapOutput: string;
  }
): OutputOptions {
  return {
    indexedRamBundle: false,
    bundleEncoding: args.bundleEncoding,
    dev: args.dev,
    platform: args.platform,
    sourcemapSourcesRoot: args.sourcemapSourcesRoot,
    sourcemapUseAbsolutePath: args.sourcemapUseAbsolutePath,
    bundleOutput: opts.bundleOutput,
    sourcemapOutput: opts.sourcemapOutput,
  };
}

async function bundleFederatedRemote(
  _argv: Array<string>,
  cfg: BundleFederatedRemoteConfig,
  args: BundleFederatedRemoteArgs
): Promise<void> {
  const rawConfig = await loadMetroConfig(cfg, {
    maxWorkers: args.maxWorkers,
    resetCache: args.resetCache,
    config: args.config,
  });

  const logger = cfg.logger ?? console;

  // TODO: pass this without globals
  const federationConfig = global.__METRO_FEDERATION_CONFIG;
  if (!federationConfig) {
    logger.error(
      `${chalk.red("error")} Module Federation configuration is missing.`
    );
    logger.info(
      "Import the plugin 'withModuleFederation' " +
        "from 'module-federation-metro' package " +
        "and wrap your final Metro config with it."
    );
    throw new CLIError("Bundling failed");
  }

  // TODO: pass this without globals
  // TODO: this should be validated inside the plugin
  const containerEntryFilepath = global.__METRO_FEDERATION_REMOTE_ENTRY_PATH;
  if (!containerEntryFilepath) {
    logger.error(
      `${chalk.red("error")} Cannot determine the container entry file path.`
    );
    logger.info(
      "To bundle a container, you need to expose at least one module " +
        "in your Module Federation configuration."
    );
    throw new CLIError("Bundling failed");
  }

  const manifestFilepath = global.__METRO_FEDERATION_MANIFEST_PATH;
  if (!manifestFilepath) {
    logger.error(
      `${chalk.red("error")} Cannot determine the manifest file path.`
    );
    throw new CLIError("Bundling failed");
  }

  if (rawConfig.resolver.platforms.indexOf(args.platform) === -1) {
    logger.error(
      `${chalk.red("error")}: Invalid platform ${
        args.platform ? `"${chalk.bold(args.platform)}" ` : ""
      }selected.`
    );

    logger.info(
      `Available platforms are: ${rawConfig.resolver.platforms
        .map((x) => `"${chalk.bold(x)}"`)
        .join(
          ", "
        )}. If you are trying to bundle for an out-of-tree platform, it may not be installed.`
    );

    throw new CLIError("Bundling failed");
  }

  if (process.env.METRO_FEDERATION_DEV) {
    // Don't set global NODE_ENV to production inside the monorepo
    // because it breaks Metro's babel-register ad hoc transforms
    // when building with args.dev === false
    process.env.NODE_ENV = "development";
  } else {
    // This is used by a bazillion of npm modules we don't control so we don't
    // have other choice than defining it as an env variable here.
    process.env.NODE_ENV = args.dev ? "development" : "production";
  }

  // wrap the resolveRequest with our own remapper
  // to replace the paths of remote/shared modules
  const modulePathRemapper = createModulePathRemapper();

  const config = mergeConfig(rawConfig, {
    resolver: {
      // remap the paths of remote & shared modules to prevent raw project paths
      // ending up in the bundles e.g. ../../node_modules/lodash.js -> shared/lodash.js
      resolveRequest: (context, moduleName, platform) => {
        // always defined since we define it in the MF plugin
        const originalResolveRequest = rawConfig.resolver!.resolveRequest!;
        const res = originalResolveRequest(context, moduleName, platform);
        return modulePathRemapper.remap(res);
      },
    },
    serializer: {
      // since we override the paths of split modules, we need to remap the module ids
      // back to the original paths, so that they point to correct modules in runtime
      // note: the split modules become separate entrypoints, and entrypoints are not
      // resolved using the metro resolver, so the only way is to remap the module ids
      createModuleIdFactory: () => {
        const factory = rawConfig.serializer.createModuleIdFactory();
        return (path: string) => factory(modulePathRemapper.reverse(path));
      },
    },
  });

  const server = new Server(config);
  const resolver = await createResolver(server, args.platform);

  const outputDir = path.resolve(path.join(args.output ?? 'dist', args.platform))

  const containerModule: ModuleDescriptor = {
    [federationConfig.filename]: {
      moduleInputFilepath: containerEntryFilepath,
      moduleOutputDir: outputDir,
      isContainerModule: true,
    },
  };

  const exposedModules = Object.entries(federationConfig.exposes)
    .map(([moduleName, moduleFilepath]) => [
      moduleName.slice(2),
      moduleFilepath,
    ])
    .reduce((acc, [moduleName, moduleInputFilepath]) => {
      acc[moduleName] = {
        moduleInputFilepath: path.resolve(
          config.projectRoot,
          moduleInputFilepath
        ),
        moduleOutputDir: path.resolve(outputDir, "exposed"),
        isContainerModule: false,
      };
      return acc;
    }, {} as ModuleDescriptor);

  // TODO: we might detect if the dependency is native and skip emitting the bundle altogether
  const sharedModules = Object.entries(federationConfig.shared)
    .filter(([, sharedConfig]) => {
      return !sharedConfig.eager && sharedConfig.import !== false;
    })
    .reduce((acc, [moduleName]) => {
      const inputFilepath = resolver.resolve(
        containerEntryFilepath,
        moduleName
      );
      acc[moduleName] = {
        moduleInputFilepath: inputFilepath,
        moduleOutputDir: path.resolve(outputDir, "shared"),
        isContainerModule: false,
      };
      return acc;
    }, {} as ModuleDescriptor);

  const requests = Object.entries({
    ...containerModule,
    ...exposedModules,
    ...sharedModules,
  }).map(
    ([
      moduleName,
      { moduleInputFilepath, moduleOutputDir, isContainerModule = false },
    ]) => {
      const moduleBundleName = isContainerModule
        ? moduleName
        : `${moduleName}.bundle`;
      const moduleBundleFilepath = path.resolve(
        moduleOutputDir,
        moduleBundleName
      );
      // TODO: should this use `file:///` protocol?
      const moduleBundleUrl = pathToFileURL(moduleBundleFilepath).href;
      const moduleSourceMapName = `${moduleBundleName}.map`;
      const moduleSourceMapFilepath = path.resolve(
        moduleOutputDir,
        moduleSourceMapName
      );
      // TODO: should this use `file:///` protocol?
      const moduleSourceMapUrl = pathToFileURL(moduleSourceMapFilepath).href;

      if (!isContainerModule) {
        modulePathRemapper.addMapping(
          moduleInputFilepath,
          path.relative(outputDir, moduleBundleFilepath)
        );
      }

      return {
        targetDir: path.dirname(moduleBundleFilepath),
        requestOpts: getRequestOpts(args, {
          isContainerModule,
          entryFile: moduleInputFilepath,
          sourceUrl: moduleBundleUrl,
          sourceMapUrl: moduleSourceMapUrl,
        }),
        saveBundleOpts: getSaveBundleOpts(args, {
          bundleOutput: moduleBundleFilepath,
          sourcemapOutput: moduleSourceMapFilepath,
        }),
      };
    }
  );

  try {
    logger.info(
      `${chalk.blue("Processing remote container and exposed modules")}`
    );

    for (const { requestOpts, saveBundleOpts, targetDir } of requests) {
      // ensure output directory exists
      await fs.mkdir(targetDir, { recursive: true, mode: 0o755 });
      const bundle = await buildBundle(server, requestOpts);
      await saveBundleAndMap(bundle, saveBundleOpts, logger.info);

      // Save the assets of the bundle
      // const outputAssets = await server.getAssets({
      //   ...Server.DEFAULT_BUNDLE_OPTIONS,
      //   ...requestOpts,
      //   bundleType: "todo",
      // });

      // When we're done saving bundle output and the assets, we're done.
      // return await saveAssets(
      //   outputAssets,
      //   args.platform,
      //   args.assetsDest,
      //   args.assetCatalogDest
      // );
    }

    logger.info(`${chalk.blue("Processing manifest")}`);
    const manifestOutputFilepath = path.resolve(outputDir, "mf-manifest.json");
    await fs.copyFile(manifestFilepath, manifestOutputFilepath);
    logger.info(
      `Done writing MF Manifest to:\n${chalk.dim(manifestOutputFilepath)}`
    );
  } finally {
    // incomplete types - this should be awaited
    await server.end();
  }
}

export default bundleFederatedRemote;
