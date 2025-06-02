const projectRoot = process.cwd();
const metroConfig = require(`${projectRoot}/metro.config.js`);

const proxiedBabelTransformer = require(metroConfig.extra
  .proxiedBabelTransformerPath);

function transform({ filename, options, src, plugins }) {
  const enhancedPlugins = [
    // Add the module federation plugin to the list of plugins
    ...plugins,
    "module-federation-metro/babel-plugin",
  ];
  // Ensure the proxied transformer is called with the correct parameters
  return proxiedBabelTransformer.transform({
    filename,
    options,
    src,
    plugins: enhancedPlugins,
  });
}

module.exports = {
  ...proxiedBabelTransformer,
  transform,
};
