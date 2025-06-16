try {
  const path = require('node:path');
  require('ts-node').register({
    project: path.resolve(__dirname, 'tsconfig.json'),
    transpileOnly: true,
  });
} catch {}

module.exports = require('./src/index');
