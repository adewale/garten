import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  retries: 0,
  use: {
    // Fixed viewport + DPR so canvas backing stores are deterministic
    viewport: { width: 1000, height: 800 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      // No text/fonts are rendered; the only variance is anti-aliasing
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },
  projects: [
    // Real-pixel rendering tests against the built IIFE bundle
    { name: 'visual', testDir: './tests/visual' },
    // Contract tests: verify the strict vitest canvas mock's hand-encoded
    // semantics against a real browser canvas
    { name: 'contract', testDir: './tests/contract' },
  ],
});
