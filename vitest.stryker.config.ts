import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

// Suite used by Stryker (and the defect-reintroduction probes): the normal
// vitest suite minus the wall-clock performance canaries. Stryker instruments
// the mutated files, which slows them several-fold, so the ops/sec floors in
// src/performance.test.ts fail the initial dry run on anything but an idle
// machine. They are timing checks, not mutant-killing assertions; they still
// run in `npm run verify`.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, 'src/performance.test.ts'],
    },
  })
);
