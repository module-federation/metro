import path from "node:path";
import { pathToFileURL } from "node:url";
import chalk from "chalk";
import { promises as fs } from "fs";
import type { Config } from "@react-native-community/cli-types";
import Server from "metro/src/Server";
import type { RequestOptions, OutputOptions } from "metro/src/shared/types";
import type { ModuleFederationConfigNormalized } from "../types";
import loadMetroConfig from "./utils/loadMetroConfig";
import relativizeSerializedMap from "./utils/relativizeSerializedMap";
import { CLIError } from "./utils/cliError";

declare global {
  var __METRO_FEDERATION_CONFIG: ModuleFederationConfigNormalized;
  var __METRO_FEDERATION_REMOTE_ENTRY_PATH: string | undefined;
}

export type BundleCommandArgs = {
  entryFile: string;
  platform: string;
  dev: boolean;
  minify?: boolean;
  bundleEncoding?: "utf8" | "utf16le" | "ascii";
  maxWorkers?: number;
  sourcemapOutput?: string;
  sourcemapSourcesRoot?: string;
  sourcemapUseAbsolutePath?: boolean;
  assetsDest?: string;
  assetCatalogDest?: string;
  config?: string;
};

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
    log(`Writing bundle output to: ${bundleOutput}`);
    await fs.writeFile(bundleOutput, bundle.code, encoding);
    log("Done writing bundle output");
  });

  if (sourcemapOutput) {
    let { map } = bundle;
    if (sourcemapSourcesRoot != null) {
      log("start relativating source map");

      map = relativizeSerializedMap(map, sourcemapSourcesRoot);
      log("finished relativating");
    }

    writeFns.push(async () => {
      log(`Writing sourcemap output to: ${sourcemapOutput}`);
      await fs.writeFile(sourcemapOutput, map);
      log("Done writing sourcemap output");
    });
  }

  // Wait until everything is written to disk.
  await Promise.all(writeFns.map((cb) => cb()));
}

function getRequestOpts(
  args: BundleCommandArgs,
  opts: {
    isContainer: boolean;
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
    lazy: opts.isContainer,
    // remove prelude for non-container modules
    modulesOnly: !opts.isContainer,
    // don't run module for non-container modules
    runModule: !opts.isContainer,
  };
}

function getSaveBundleOpts(
  args: BundleCommandArgs,
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
  ctx: Config,
  args: BundleCommandArgs
): Promise<void> {
  const config = await loadMetroConfig(ctx, {
    maxWorkers: args.maxWorkers,
    config: args.config,
  });

  // TODO: pass this without globals
  const federationConfig = global.__METRO_FEDERATION_CONFIG;
  if (!federationConfig) {
    console.error(
      `${chalk.red("error")}: Module Federation configuration is missing.`
    );
    console.info(
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
    console.error(
      `${chalk.red("error")}: Cannot determine the container entry file path.`
    );
    console.info(
      "To bundle a container, you need to expose at least one module " +
        "in your Module Federation configuration."
    );
    throw new CLIError("Bundling failed");
  }

  if (config.resolver.platforms.indexOf(args.platform) === -1) {
    console.error(
      `${chalk.red("error")}: Invalid platform ${
        args.platform ? `"${chalk.bold(args.platform)}" ` : ""
      }selected.`
    );

    console.info(
      `Available platforms are: ${config.resolver.platforms
        .map((x) => `"${chalk.bold(x)}"`)
        .join(
          ", "
        )}. If you are trying to bundle for an out-of-tree platform, it may not be installed.`
    );

    throw new CLIError("Bundling failed");
  }

  // This is used by a bazillion of npm modules we don't control so we don't
  // have other choice than defining it as an env variable here.
  process.env.NODE_ENV = args.dev ? "development" : "production";

  // TODO: make this configurable
  const outputDir = path.join(config.projectRoot, "dist");

  const containerModule = {
    [federationConfig.name]: {
      moduleFilepath: containerEntryFilepath,
      isContainer: true,
    },
  };

  const exposedModules = Object.entries(federationConfig.exposes)
    .map(([moduleName, moduleFilepath]) => [
      moduleName.slice(2),
      moduleFilepath,
    ])
    .reduce((acc, [moduleName, moduleFilepath]) => {
      acc[moduleName] = { moduleFilepath, isContainer: false };
      return acc;
    }, {} as Record<string, { moduleFilepath: string; isContainer: boolean }>);

  const requests = Object.entries({
    ...containerModule,
    ...exposedModules,
  }).map(
    ([moduleName, { moduleFilepath: moduleInputFilepath, isContainer }]) => {
      const moduleBundleName = `${moduleName}.bundle`;
      const moduleBundleOutputFilepath = path.join(outputDir, moduleBundleName);
      // TODO: should this use `file:///` protocol?
      const moduleBundleUrl = pathToFileURL(moduleBundleOutputFilepath).href;
      const moduleSourceMapName = `${moduleBundleName}.map`;
      const moduleSourceMapFilepath = path.join(outputDir, moduleSourceMapName);
      // TODO: should this use `file:///` protocol?
      const moduleSourceMapUrl = pathToFileURL(moduleSourceMapFilepath).href;

      return {
        requestOpts: getRequestOpts(args, {
          isContainer,
          entryFile: moduleInputFilepath,
          sourceUrl: moduleBundleUrl,
          sourceMapUrl: moduleSourceMapUrl,
        }),
        saveBundleOpts: getSaveBundleOpts(args, {
          bundleOutput: moduleBundleOutputFilepath,
          sourcemapOutput: moduleSourceMapFilepath,
        }),
      };
    }
  );

  const server = new Server(config);

  try {
    // ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true, mode: 0o755 });

    for (const { requestOpts, saveBundleOpts } of requests) {
      const bundle = await buildBundle(server, requestOpts);
      await saveBundleAndMap(bundle, saveBundleOpts, console.info);

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
  } finally {
    // incomplete types - this should be awaited
    await server.end();
  }
}

export default bundleFederatedRemote;
