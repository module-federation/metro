try {
  const path = require('path');
  require('ts-node').register({
    project: path.resolve(__dirname, '../tsconfig.json'),
    transpileOnly: true,
  });
} catch {}

module.exports = require('../src/commands/index');
