import fs from "node:fs";
import path from "node:path";
import connect from "connect";
import type MetroServer from "metro/src/Server";
import type { FileSystem } from "metro-file-map";
import type { GetTransformOptions, MetroConfig } from "metro-config";

type Bundler = ReturnType<ReturnType<MetroServer["getBundler"]>["getBundler"]>;

const isRadonIDE = "REACT_NATIVE_IDE_LIB_PATH" in process.env;

export class VirtualModuleManager {
  private enabled: Promise<boolean> | false = false;
  private virtualModules: Map<string, string> = new Map();

  constructor(
    private metroConfig: MetroConfig,
    private forceWriteFileSystem: boolean
  ) {}

  registerVirtualModule(filePath: string, generator: () => string) {
    const moduleCode = generator();
    // skip when the module code is the same
    if (this.virtualModules.get(filePath) === moduleCode) {
      return;
    }

    this.virtualModules.set(filePath, moduleCode);
    if (this.forceWriteFileSystem) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, moduleCode);
    }
  }

  getMiddleware() {
    return (middleware: any, metroServer: MetroServer) => {
      const server = connect();
      const bundler = metroServer.getBundler().getBundler();

      if (!this.forceWriteFileSystem && !isRadonIDE) {
        this.setup(bundler);

        server.use(async (_, __, next) => {
          // Wait until the bundler patching has completed
          await this.enabled;
          next();
        });
      }

      const originalMiddleware = this.metroConfig.server?.enhanceMiddleware;
      return originalMiddleware
        ? server.use(originalMiddleware(middleware, metroServer))
        : server.use(middleware);
    };
  }

  getTransformOptions(): GetTransformOptions {
    return async (entryPoints, transformOptions, getDependenciesOf) => {
      if (this.enabled) {
        await this.enabled;
      }

      // We need to write to the file system if virtual modules are not possible and/or we are building for production
      // const writeToFileSystem = !this.enabled || !transformOptions.dev;

      const originalGetTransformOptions =
        this.metroConfig.transformer?.getTransformOptions;

      return Object.assign(
        {},
        await originalGetTransformOptions?.(
          entryPoints,
          transformOptions,
          getDependenciesOf
        )
      );
    };
  }

  private setup(bundler: Bundler) {
    this.enabled = (async () => {
      const graph = await bundler.getDependencyGraph();
      // @ts-expect-error incomplete types
      this.ensureFileSystemPatched(graph._fileSystem);
      this.ensureBundlerPatched(bundler);
      return true;
    })();
  }

  // Patch the bundler to use virtual modules
  private ensureFileSystemPatched(
    fs: FileSystem & { getSha1: { __vm__patched?: boolean } }
  ) {
    if (!fs.getSha1.__vm__patched) {
      const original_getSha1 = fs.getSha1.bind(fs);
      fs.getSha1 = (filename) => {
        if (this.virtualModules.has(filename)) {
          // Don't cache this file. It should always be fresh.
          return `${filename}-${Date.now()}`;
        }
        return original_getSha1(filename);
      };
      fs.getSha1.__vm__patched = true;
    }

    return fs;
  }

  // Patch the bundler to use virtual modules
  private ensureBundlerPatched(
    bundler: Bundler & { transformFile: { __vm__patched?: boolean } }
  ) {
    if (bundler.transformFile.__vm__patched) {
      return;
    }

    const manager = this;
    const transformFile = bundler.transformFile.bind(bundler);

    bundler.transformFile = async function (
      filePath,
      transformOptions,
      fileBuffer
    ) {
      const virtualModule = manager.virtualModules.get(filePath);

      if (virtualModule) {
        fileBuffer = Buffer.from(virtualModule);
      }
      return transformFile(filePath, transformOptions, fileBuffer);
    };
    bundler.transformFile.__vm__patched = true;
  }
}
