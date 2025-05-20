import type Server from "metro/src/Server";

export async function createResolver(server: Server, platform: string | null) {
  const bundler = server.getBundler().getBundler();
  const depGraph = await bundler.getDependencyGraph();

  const resolve = (from: string, to: string) => {
    const config = { name: to, data: { asyncType: null, key: to, locs: [] } };
    const options = { assumeFlatNodeModules: false };
    const res = depGraph.resolveDependency(from, config, platform, {}, options);
    return res.filePath;
  };

  return { resolve };
}
