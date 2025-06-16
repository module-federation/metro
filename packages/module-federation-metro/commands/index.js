try {
  const path = require('node:path');
  require('ts-node').register({
    project: path.resolve(__dirname, '../tsconfig.json'),
    transpileOnly: true,
    compilerOptions: {
      module: 'commonjs',
      moduleResolution: 'node',
    },
  });
} catch {}

module.exports = require('../src/commands/index');
