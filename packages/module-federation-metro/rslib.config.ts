import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    { format: 'cjs', syntax: 'es2021', bundle: false, dts: { bundle: false } },
    { format: 'esm', syntax: 'es2021', bundle: false },
  ],
  source: {
    tsconfigPath: './tsconfig.build.json',
  },
});
