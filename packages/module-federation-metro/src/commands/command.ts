import path from "node:path";
import chalk from "chalk";
import { promises as fs } from "fs";
import type { Config } from "@react-native-community/cli-types";
import type { ConfigT } from "metro-config";
import Server from "metro/src/Server";
import type { RequestOptions, OutputOptions } from "metro/src/shared/types";
import loadMetroConfig from "./utils/loadMetroConfig";
import relativizeSerializedMap from "./utils/relativizeSerializedMap";

declare global {
  var __METRO_FEDERATION_CONFIG: any;
  var __METRO_FEDERATION_REMOTE_ENTRY_PATH: string | undefined;
}

export type BundleCommandArgs = {
  entryFile: string;
  platform: string;
  dev: boolean;
  minify?: boolean;
  maxWorkers?: number;
  bundleOutput: string;
  sourcemapOutput?: string;
  sourcemapSourcesRoot?: string;
  assetsDest?: string;
  config?: string;
};

async function buildBundle(server: Server, requestOpts: RequestOptions) {
  const bundle = await server.build({
    ...Server.DEFAULT_BUNDLE_OPTIONS,
    lazy: true,
    bundleType: "bundle",
    ...requestOpts,
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

async function buildContainerBundle(
  _argv: Array<string>,
  ctx: Config,
  args: BundleCommandArgs
): Promise<void> {
  const config = await loadMetroConfig(ctx, {
    maxWorkers: args.maxWorkers,
    config: args.config,
  });

  return buildBundleWithConfig(args, config);
}

async function buildBundleWithConfig(
  args: BundleCommandArgs,
  config: ConfigT
): Promise<void> {
  const containerEntryFile = global.__METRO_FEDERATION_REMOTE_ENTRY_PATH;

  if (!containerEntryFile) {
    throw new Error("Name of the container entry file is not set");
  }

  const bundleOutput = path.join(config.projectRoot, "dist", "mini.bundle");

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

    throw new Error("Bundling failed");
  }

  // This is used by a bazillion of npm modules we don't control so we don't
  // have other choice than defining it as an env variable here.
  process.env.NODE_ENV = args.dev ? "development" : "production";

  let sourceMapUrl = args.sourcemapOutput;
  if (sourceMapUrl != null) {
    sourceMapUrl = path.basename(sourceMapUrl);
  }

  const requestOpts: RequestOptions = {
    entryFile: containerEntryFile,
    sourceMapUrl,
    dev: args.dev,
    minify: args.minify !== undefined ? args.minify : !args.dev,
    platform: args.platform,
  };

  const saveBundleOpts: OutputOptions = {
    bundleOutput,
    bundleEncoding: "utf8",
    dev: args.dev,
    indexedRamBundle: false,
    platform: args.platform,
  };

  const server = new Server(config);

  try {
    const bundle = await buildBundle(server, requestOpts);

    // Ensure destination directory exists before saving the bundle
    await fs.mkdir(path.dirname(bundleOutput), {
      recursive: true,
      mode: 0o755,
    });

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
  } finally {
    await server.end();
  }
}

export default buildContainerBundle;
