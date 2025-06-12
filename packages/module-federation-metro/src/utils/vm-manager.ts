import fs from "node:fs";
import path from "node:path";
import type MetroServer from "metro/src/Server";
import type {
  GetTransformOptions,
  MetroConfig,
  Middleware,
} from "metro-config";
import type { FileSystem } from "metro-file-map";

type Bundler = ReturnType<ReturnType<MetroServer["getBundler"]>["getBundler"]>;

export class VirtualModuleManager {
  private setupFinished: Promise<boolean> | null = null;
  private virtualModules: Map<string, string> = new Map();

  constructor(
    private metroConfig: MetroConfig,
    private options: { forceWriteFileSystem?: boolean } = {}
  ) {}

  registerVirtualModule(filePath: string, generator: () => string) {
    const moduleCode = generator();
    // skip when the module code is the same
    if (this.virtualModules.get(filePath) === moduleCode) {
      return;
    }

    this.virtualModules.set(filePath, moduleCode);
    if (this.options.forceWriteFileSystem) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, moduleCode);
    }
  }

  getMiddleware() {
    return (middleware: Middleware, metroServer: MetroServer) => {
      const bundler = metroServer.getBundler().getBundler();

      this.setup(bundler);

      const originalMiddleware = this.metroConfig.server?.enhanceMiddleware;
      return originalMiddleware
        ? originalMiddleware(middleware, metroServer)
        : middleware;
    };
  }

  getTransformOptions(): GetTransformOptions {
    return async (...args) => {
      if (this.setupFinished === null) {
        throw new Error("Expected virtual module setup to be finished");
      }

      await this.setupFinished;

      const originalGetTransformOptions =
        this.metroConfig.transformer?.getTransformOptions;

      if (originalGetTransformOptions) {
        return originalGetTransformOptions(...args);
      }
      return {};
    };
  }

  setup(bundler: Bundler) {
    this.setupFinished = (async () => {
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
