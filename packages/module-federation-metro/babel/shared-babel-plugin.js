const t = require("@babel/types");

const projectRoot = process.cwd();
const manifest = require(`${projectRoot}/node_modules/.mf-metro/mf-manifest.json`);

const shared = manifest.shared;
const SHARED_REGEX = new RegExp(`^(${shared.map((s) => s.name).join("|")})\/`);

function isSharedImport(path) {
  return (
    t.isImport(path.node.callee) &&
    t.isStringLiteral(path.node.arguments[0]) &&
    shared.length > 0 &&
    path.node.arguments[0].value.match(SHARED_REGEX)
  );
}

function getWrappedSharedImport(importName) {
  const importArg = t.stringLiteral(importName);

  // require('mf:remote-module-registry')
  const requireCall = t.callExpression(t.identifier("require"), [
    t.stringLiteral("mf:remote-module-registry"),
  ]);

  // .loadSharedToRegistry('mini/button')
  const loadCall = t.callExpression(
    t.memberExpression(requireCall, t.identifier("loadSharedToRegistry")),
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

function moduleFederationSharedBabelPlugin() {
  return {
    name: "module-federation-shared-babel-plugin",
    visitor: {
      CallExpression(path) {
        if (path.node.__wasTransformed) {
          return;
        }

        if (isSharedImport(path)) {
          const wrappedImport = getWrappedSharedImport(
            path.node.arguments[0].value
          );

          path.replaceWith(wrappedImport);
        }
      },
    },
  };
}

module.exports = moduleFederationSharedBabelPlugin;
