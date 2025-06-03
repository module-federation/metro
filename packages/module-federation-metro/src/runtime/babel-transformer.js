const proxiedBabelTransformer = require("__BABEL_TRANSFORMER_PATH__");

function transform({ filename, options, src, plugins }) {
  const enhancedPlugins = [
    ...plugins,
    "module-federation-metro/babel/remotes-babel-plugin",
    "module-federation-metro/babel/shared-babel-plugin",
  ];

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
