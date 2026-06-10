/**
 * Real-pixel rendering tests.
 *
 * These run the built IIFE bundle in real Chromium and assert on the actual
 * rasterized bitmap — the layer the vitest suite cannot see (its canvas is a
 * semantic mock). Two kinds of assertion:
 *
 *  - pixel probes: platform-independent facts about the bitmap (alpha of the
 *    background, painted-pixel counts per region, byte-level determinism)
 *  - golden screenshots: change detection for everything else
 *
 * Goldens are generated on Linux Chromium (CI platform); regenerate with
 * `npm run test:visual -- --update-snapshots`.
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Playwright runs with cwd at the project root
const FIXTURE = pathToFileURL(
  resolve(process.cwd(), 'tests/visual/fixtures/garden.html')
).href;

interface RegionStats {
  width: number;
  height: number;
  /** Pixels with alpha > 0, split into vertical thirds */
  painted: { top: number; middle: number; bottom: number };
  /** RGBA of the top-left pixel */
  topLeft: [number, number, number, number];
  /** Cheap order-dependent hash of the full bitmap */
  hash: number;
}

async function readStats(page: Page): Promise<RegionStats> {
  return page.evaluate(() => {
    const canvas = document.querySelector('#garden canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;

    const painted = { top: 0, middle: 0, bottom: 0 };
    let hash = 0;
    for (let y = 0; y < height; y++) {
      const band = y < height / 3 ? 'top' : y < (2 * height) / 3 ? 'middle' : 'bottom';
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] > 0) painted[band]++;
        // FNV-ish rolling hash over all bytes
        hash = (Math.imul(hash, 31) + data[i] + data[i + 1] + data[i + 2] + data[i + 3]) >>> 0;
      }
    }

    return {
      width,
      height,
      painted,
      topLeft: [data[0], data[1], data[2], data[3]] as [number, number, number, number],
      hash,
    };
  });
}

async function makeGarden(page: Page, options: object = {}, seekTo?: number): Promise<void> {
  await page.goto(FIXTURE);
  await page.evaluate(
    ([opts, seek]) =>
      (window as unknown as { makeGarden(o: object, s?: number): boolean }).makeGarden(
        opts as object,
        seek as number | undefined
      ),
    [options, seekTo] as const
  );
}

test('completed default garden: transparent background, plants in lower band', async ({
  page,
}) => {
  await makeGarden(page, {}, 100);
  const stats = await readStats(page);

  // H-3 at the pixel level: the default background must be transparent
  expect(stats.topLeft[3]).toBe(0);
  // A completed default garden paints a substantial lower band
  expect(stats.painted.bottom).toBeGreaterThan(5000);
  // ...and (maxHeight 0.35) nothing in the top third
  expect(stats.painted.top).toBe(0);

  await expect(page.locator('#garden')).toHaveScreenshot('garden-complete-default.png');
});

test('mid-growth garden renders fewer pixels than the completed garden', async ({ page }) => {
  await makeGarden(page, {}, 100);
  const complete = await readStats(page);

  await makeGarden(page, {}, 30);
  const mid = await readStats(page);

  const total = (s: RegionStats) => s.painted.top + s.painted.middle + s.painted.bottom;
  expect(total(mid)).toBeGreaterThan(0);
  expect(total(mid)).toBeLessThan(total(complete));

  await expect(page.locator('#garden')).toHaveScreenshot('garden-mid-growth.png');
});

test('background option paints an opaque background color', async ({ page }) => {
  await makeGarden(page, { background: '#112233' }, 10);
  const stats = await readStats(page);

  expect(stats.topLeft).toEqual([17, 34, 51, 255]);
});

test('tall garden on a dark page reaches the top band', async ({ page }) => {
  await makeGarden(
    page,
    { maxHeight: 1.0, density: 'dense', generations: 8 },
    100
  );
  await page.addStyleTag({ content: 'body { background: #0b1020; }' });
  const stats = await readStats(page);

  // The formerly-invisible region: tall plants (trees, climbers, conifers)
  // must actually rasterize pixels in the top third of the canvas
  expect(stats.painted.top).toBeGreaterThan(500);

  await expect(page.locator('#garden')).toHaveScreenshot('garden-tall-dark.png');
});

test('same seed produces a byte-identical bitmap across page loads', async ({ page }) => {
  await makeGarden(page, { density: 'dense' }, 77);
  const first = await readStats(page);

  await makeGarden(page, { density: 'dense' }, 77); // full reload + regenerate
  const second = await readStats(page);

  expect(second.hash).toBe(first.hash);
  expect(second.painted).toEqual(first.painted);
});

test('resize while idle re-renders the frame (real ResizeObserver)', async ({ page }) => {
  await makeGarden(page, {}, 100);
  const before = await readStats(page);
  expect(before.painted.bottom).toBeGreaterThan(5000);

  // H-4 at the pixel level: canvas.width assignment wipes the bitmap; the
  // renderer must repaint after the debounced ResizeObserver callback
  await page.evaluate(() => {
    (document.querySelector('#garden') as HTMLElement).style.width = '640px';
  });
  await page.waitForTimeout(400); // 100ms debounce + headroom

  const after = await readStats(page);
  expect(after.width).toBe(640);
  expect(after.painted.bottom).toBeGreaterThan(4000);
});
