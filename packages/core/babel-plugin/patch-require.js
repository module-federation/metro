// reuse `@babel/types` from `metro`
const metroPath = require.resolve('metro');
const babelTypesPath = require.resolve('@babel/types', { paths: [metroPath] });
const t = require(babelTypesPath);

function metroPatchRequireBabelPlugin() {
  return {
    name: 'metro-patch-require',
    visitor: {
      Program: {
        enter(_, state) {
          // Track per-file transformation status
          state.hasTransformed = {
            $RefreshReg$: false,
            $RefreshSig$: false,
          };
        },
      },
      MemberExpression(path) {
        const { object, property, computed } = path.node;
        const GLOBAL_NAMES_TO_PATCH = [
          '__r',
          '__c',
          '__registerSegment',
          '__accept',
        ];

        // Patch global names
        if (
          t.isIdentifier(object, { name: 'global' }) &&
          t.isIdentifier(property) &&
          !computed &&
          GLOBAL_NAMES_TO_PATCH.includes(property.name)
        ) {
          path.replaceWith(
            t.memberExpression(
              t.identifier('global'),
              t.templateLiteral(
                [
                  t.templateElement({ raw: '', cooked: '' }),
                  t.templateElement(
                    { raw: property.name, cooked: property.name },
                    true
                  ),
                ],
                [t.identifier('__METRO_GLOBAL_PREFIX__')]
              ),
              true
            )
          );
        }
      },
      AssignmentExpression(path, state) {
        const { node } = path;

        if (
          t.isMemberExpression(node.left) &&
          t.isIdentifier(node.left.object, { name: 'global' }) &&
          t.isIdentifier(node.left.property) &&
          ['$RefreshReg$', '$RefreshSig$'].includes(node.left.property.name)
        ) {
          const propName = node.left.property.name;

          if (state.hasTransformed[propName]) {
            return; // Already transformed this one
          }

          const globalProp = t.memberExpression(
            t.identifier('global'),
            t.identifier(node.left.property.name)
          );

          path.replaceWith(
            t.assignmentExpression(
              '=',
              globalProp,
              t.logicalExpression('??', globalProp, node.right)
            )
          );
          state.hasTransformed[propName] = true;
        }
      },
      CallExpression(path) {
        const { callee, arguments: args } = path.node;
        const isRegisterExports = t.isIdentifier(callee, {
          name: 'registerExportsForReactRefresh',
        });
        const isRefreshRuntimeRegister =
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: 'RefreshRuntime' }) &&
          t.isIdentifier(callee.property, { name: 'register' });

        if (!isRegisterExports && !isRefreshRuntimeRegister) return;

        const lastArgIndex = args.length - 1;
        const lastArg = args[lastArgIndex];

        args[lastArgIndex] = t.binaryExpression(
          '+',
          t.identifier('__METRO_GLOBAL_PREFIX__'),
          t.binaryExpression('+', t.stringLiteral(' '), lastArg)
        );
      },
      ReturnStatement(path) {
        // Check if parent function is named `requireRefresh`
        const funcPath = path.findParent(
          (p) =>
            (p.isFunctionDeclaration() || p.isFunctionExpression()) &&
            p.node.id?.name === 'requireRefresh'
        );

        if (!funcPath) return;

        const newReturn = t.logicalExpression(
          '||',
          t.memberExpression(
            t.identifier('global'),
            t.binaryExpression(
              '+',
              t.memberExpression(
                t.identifier('global'),
                t.identifier('__METRO_GLOBAL_PREFIX__')
              ),
              t.stringLiteral('__ReactRefresh')
            ),
            true
          ),
          t.memberExpression(
            t.identifier('metroRequire'),
            t.identifier('Refresh')
          )
        );

        path.get('argument').replaceWith(newReturn);
      },
    },
  };
}

module.exports = metroPatchRequireBabelPlugin;
