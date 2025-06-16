import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    { format: 'esm', syntax: 'es2021', bundle: false, dts: { bundle: false } },
  ],
  source: {
    entry: {
      index: 'src/!(modules|runtime)',
    },
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    copy: [
      { from: './src/modules', to: 'modules' },
      { from: './src/runtime', to: 'runtime' },
    ],
  },
});
