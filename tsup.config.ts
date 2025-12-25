import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM and CJS builds
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
    treeshake: true,
    splitting: false,
  },
  // IIFE build for CDN/script tag usage
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'Garten',
    outExtension: () => ({ js: '.global.js' }),
    minify: true,
    sourcemap: true,
  },
]);
