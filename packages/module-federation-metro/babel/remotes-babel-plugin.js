// reuse `@babel/types` from `metro`
const metroPath = require.resolve('metro');
const babelTypesPath = require.resolve('@babel/types', { paths: [metroPath] });
const t = require(babelTypesPath);

function getRemotesRegExp(remotes) {
  return new RegExp(`^(${Object.keys(remotes).join('|')})\/`);
}

function isRemoteImport(path, options) {
  return (
    t.isImport(path.node.callee) &&
    t.isStringLiteral(path.node.arguments[0]) &&
    Object.keys(options.remotes).length > 0 &&
    path.node.arguments[0].value.match(getRemotesRegExp(options.remotes))
  );
}

function getWrappedRemoteImport(importName) {
  const importArg = t.stringLiteral(importName);

  // require('mf:remote-module-registry')
  const requireCall = t.callExpression(t.identifier('require'), [
    t.stringLiteral('mf:remote-module-registry'),
  ]);

  // .loadAndGetRemote(importName)
  const loadAndGetRemoteCall = t.callExpression(
    t.memberExpression(requireCall, t.identifier('loadAndGetRemote')),
    [importArg]
  );

  return loadAndGetRemoteCall;
}

function moduleFederationRemotesBabelPlugin() {
  return {
    name: 'module-federation-remotes-babel-plugin',
    visitor: {
      CallExpression(path, state) {
        if (state.opts.blacklistedPaths.includes(state.filename)) {
          return;
        }

        if (isRemoteImport(path, state.opts)) {
          const wrappedImport = getWrappedRemoteImport(
            path.node.arguments[0].value
          );

          path.replaceWith(wrappedImport);
        }
      },
    },
  };
}

module.exports = moduleFederationRemotesBabelPlugin;
