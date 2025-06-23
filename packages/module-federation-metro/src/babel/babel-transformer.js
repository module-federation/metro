const blacklistedPaths = __BLACKLISTED_PATHS__;
const remotes = __REMOTES__;
const shared = __SHARED__;

const babelTransformer = require('__BABEL_TRANSFORMER_PATH__');

function transform(config) {
  const federationPlugins = [
    [
      'module-federation-metro/babel-plugin',
      { blacklistedPaths, remotes, shared },
    ],
  ];

  return babelTransformer.transform({
    ...config,
    plugins: [...federationPlugins, ...config.plugins],
  });
}

module.exports = { ...babelTransformer, transform };
