const blacklistedPaths = __BLACKLISTED_PATHS__;

const remotes = __REMOTES__;
const shared = __SHARED__;

const proxiedBabelTransformer = require("__BABEL_TRANSFORMER_PATH__");

function transform(config) {
  const federationPlugins = [
    [
      "module-federation-metro/babel/remotes-babel-plugin",
      { blacklistedPaths, remotes },
    ],
    [
      "module-federation-metro/babel/shared-babel-plugin",
      { blacklistedPaths, shared },
    ],
  ];

  return proxiedBabelTransformer.transform({
    ...config,
    plugins: [...federationPlugins, ...config.plugins],
  });
}

module.exports = {
  ...proxiedBabelTransformer,
  transform,
};
