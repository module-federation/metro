const t = require("@babel/types");

function getRemotesRegExp(remotes) {
  return new RegExp(`^(${Object.keys(remotes).join("|")})\/`);
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
  const requireCall = t.callExpression(t.identifier("require"), [
    t.stringLiteral("mf:remote-module-registry"),
  ]);

  // .loadRemoteToRegistry('mini/button')
  const loadCall = t.callExpression(
    t.memberExpression(requireCall, t.identifier("loadRemoteToRegistry")),
    [importArg]
  );

  // import('mini/button')
  const importCall = t.callExpression(t.import(), [importArg]);
  importCall.__wasTransformed = true;

  // .then(() => import('mini/button'))
  const thenCall = t.callExpression(
    t.memberExpression(loadCall, t.identifier("then")),
    [t.arrowFunctionExpression([], importCall)]
  );

  return thenCall;
}

function moduleFederationRemotesBabelPlugin() {
  return {
    name: "module-federation-remotes-babel-plugin",
    visitor: {
      CallExpression(path, state) {
        if (path.node.__wasTransformed) {
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
