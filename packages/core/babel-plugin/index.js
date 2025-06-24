// reuse `@babel/types` from `metro`
const metroPath = require.resolve('metro');
const babelTypesPath = require.resolve('@babel/types', { paths: [metroPath] });
const t = require(babelTypesPath);

function getRemotesRegExp(remotes) {
  return new RegExp(`^(${Object.keys(remotes).join('|')})\/`);
}

function getSharedRegExp(shared) {
  return new RegExp(`^(${Object.keys(shared).join('|')})$`);
}

function isRemoteImport(path, options) {
  return (
    t.isImport(path.node.callee) &&
    t.isStringLiteral(path.node.arguments[0]) &&
    Object.keys(options.remotes).length > 0 &&
    path.node.arguments[0].value.match(getRemotesRegExp(options.remotes))
  );
}

function isSharedImport(path, options) {
  return (
    t.isImport(path.node.callee) &&
    t.isStringLiteral(path.node.arguments[0]) &&
    Object.keys(options.shared).length > 0 &&
    path.node.arguments[0].value.match(getSharedRegExp(options.shared))
  );
}

function createWrappedImport(importName, methodName) {
  const importArg = t.stringLiteral(importName);

  // require('mf:remote-module-registry')
  const requireCall = t.callExpression(t.identifier('require'), [
    t.stringLiteral('mf:remote-module-registry'),
  ]);

  // .loadAndGetRemote(importName) or .loadAndGetShared(importName)
  const loadAndGetCall = t.callExpression(
    t.memberExpression(requireCall, t.identifier(methodName)),
    [importArg]
  );

  return loadAndGetCall;
}

function getWrappedRemoteImport(importName) {
  return createWrappedImport(importName, 'loadAndGetRemote');
}

function getWrappedSharedImport(importName) {
  return createWrappedImport(importName, 'loadAndGetShared');
}

function moduleFederationMetroBabelPlugin() {
  return {
    name: 'module-federation-metro-babel-plugin',
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
        } else if (isSharedImport(path, state.opts)) {
          const wrappedImport = getWrappedSharedImport(
            path.node.arguments[0].value
          );
          path.replaceWith(wrappedImport);
        }
      },
    },
  };
}

module.exports = moduleFederationMetroBabelPlugin;
