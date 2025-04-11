try {
  require("ts-node").register({
    compilerOptions: {
      module: "commonjs",
    },
  });
} catch {}

require("./src/index");
