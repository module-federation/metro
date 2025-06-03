const proxiedBabelTransformer = require("__BABEL_TRANSFORMER_PATH__");

function transform(config) {
  const enhancedPlugins = [
    "module-federation-metro/babel/remotes-babel-plugin",
    "module-federation-metro/babel/shared-babel-plugin",
    ...config.plugins,
  ];

  return proxiedBabelTransformer.transform({
    ...config,
    plugins: enhancedPlugins,
  });
}

module.exports = {
  ...proxiedBabelTransformer,
  transform,
};
