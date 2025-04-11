try {
  const path = require("path");
  require("ts-node").register({
    project: path.resolve(__dirname, "tsconfig.json"),
  });
} catch {}

module.exports = require("./src/index");
