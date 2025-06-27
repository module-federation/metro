const babelTransformer = require('__BABEL_TRANSFORMER_PATH__');

function transform(config) {
  return babelTransformer.transform({
    ...config,
    plugins: [...__BABEL_PLUGINS__, ...config.plugins],
  });
}

module.exports = { ...babelTransformer, transform };
