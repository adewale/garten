import { defineConfig } from 'tsup';

// Lowest browser versions documented in README "Browser Support".
// esbuild transpiles newer syntax (??, ?., etc.) down to these targets,
// so the claim is enforced by the build rather than assumed.
const browserTargets = ['chrome64', 'firefox69', 'safari12', 'edge79'];

export default defineConfig([
  // ESM and CJS builds
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    target: browserTargets,
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
    target: browserTargets,
    globalName: 'Garten',
    outExtension: () => ({ js: '.global.js' }),
    minify: true,
    sourcemap: true,
  },
]);
