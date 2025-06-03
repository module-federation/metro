const MF_CONFIG = __MF_CONFIG__;
const proxiedBabelTransformer = require("__BABEL_TRANSFORMER_PATH__");

function transform(config) {
  const enhancedPlugins = [
    ["module-federation-metro/babel/remotes-babel-plugin", MF_CONFIG],
    ["module-federation-metro/babel/shared-babel-plugin", MF_CONFIG],
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
