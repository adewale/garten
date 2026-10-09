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
 * `npm run build && npm run test:visual -- --update-snapshots`.
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
  /**
   * Pixels with alpha > 0 above the ground band. The renderer paints the
   * bottom GROUND_HEIGHT rows on every frame (8 x 800 = 6,400 pixels), so
   * counts that include them are satisfied by an empty garden.
   */
  plantPainted: number;
  /** Rows of the ground band (ANIMATION.GROUND_HEIGHT, read from the bundle) */
  groundHeight: number;
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

    const groundHeight = (window as unknown as { Garten: { ANIMATION: { GROUND_HEIGHT: number } } })
      .Garten.ANIMATION.GROUND_HEIGHT;
    const groundTop = height - groundHeight;
    const painted = { top: 0, middle: 0, bottom: 0 };
    let plantPainted = 0;
    let hash = 0;
    for (let y = 0; y < height; y++) {
      const band = y < height / 3 ? 'top' : y < (2 * height) / 3 ? 'middle' : 'bottom';
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] > 0) {
          painted[band]++;
          if (y < groundTop) plantPainted++;
        }
        // FNV-ish rolling hash over all bytes
        hash = (Math.imul(hash, 31) + data[i] + data[i + 1] + data[i + 2] + data[i + 3]) >>> 0;
      }
    }

    return {
      width,
      height,
      painted,
      plantPainted,
      groundHeight,
      topLeft: [data[0], data[1], data[2], data[3]] as [number, number, number, number],
      hash,
    };
  });
}

/**
 * The RGBA bitmap (rows y0 to y1, default all), base64-encoded, for
 * byte-for-byte comparison
 */
async function readBitmap(page: Page, y0 = 0, y1?: number): Promise<string> {
  return page.evaluate(([from, to]) => {
    const canvas = document.querySelector('#garden canvas') as HTMLCanvasElement;
    const end = to ?? canvas.height;
    const data = canvas.getContext('2d')!.getImageData(0, from, canvas.width, end - from).data;
    let binary = '';
    for (let i = 0; i < data.length; i += 0x8000) {
      binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }, [y0, y1] as const);
}

/** Pixels with alpha > 0 in rows y0 to y1 */
async function paintedRows(page: Page, y0: number, y1: number): Promise<number> {
  return page.evaluate(
    ([from, to]) => {
      const canvas = document.querySelector('#garden canvas') as HTMLCanvasElement;
      const data = canvas.getContext('2d')!.getImageData(0, from, canvas.width, to - from).data;
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
      return painted;
    },
    [y0, y1] as const
  );
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
  // A completed default garden paints plants above the ground band...
  expect(stats.plantPainted).toBeGreaterThan(5000);
  // ...and (maxHeight 0.35) nothing in the top third
  expect(stats.painted.top).toBe(0);

  await expect(page.locator('#garden')).toHaveScreenshot('garden-complete-default.png');
});

test('mid-growth garden renders fewer pixels than the completed garden', async ({ page }) => {
  await makeGarden(page, {}, 100);
  const complete = await readStats(page);

  await makeGarden(page, {}, 30);
  const mid = await readStats(page);

  expect(mid.plantPainted).toBeGreaterThan(0);
  expect(mid.plantPainted).toBeLessThan(complete.plantPainted);

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

test('ground band only before any plant starts', async ({ page }) => {
  // The vacuity baseline for every plant-pixel count: at t = 0 no plant
  // has started, so nothing is painted above the ground band
  await makeGarden(page, {}, 0);
  const stats = await readStats(page);
  expect(stats.plantPainted).toBe(0);
  expect(stats.painted).toEqual({ top: 0, middle: 0, bottom: stats.width * stats.groundHeight });
});

test('same seed produces a byte-identical bitmap in two independent pages', async ({
  browser,
}) => {
  // Separate browser contexts: nothing (module state, canvas, caches) is shared
  const render = async (): Promise<string> => {
    const context = await browser.newContext({
      viewport: { width: 1000, height: 800 },
      deviceScaleFactor: 1,
    });
    try {
      const page = await context.newPage();
      await makeGarden(page, { density: 'dense' }, 77);
      return await readBitmap(page);
    } finally {
      await context.close();
    }
  };
  const [first, second] = await Promise.all([render(), render()]);

  expect(first.length).toBe(800 * 600 * 4 * (4 / 3));
  expect(second === first).toBe(true);
});

test('resize while idle repaints exactly the frame a fresh garden of the new size draws', async ({
  page,
}) => {
  // Reference: the same garden created in a 640px-wide container
  await page.goto(FIXTURE);
  await page.evaluate(() => {
    (document.querySelector('#garden') as HTMLElement).style.width = '640px';
    (window as unknown as { makeGarden(o: object, s?: number): boolean }).makeGarden({}, 100);
  });
  const fresh = await readBitmap(page);

  await makeGarden(page, {}, 100);
  const before = await readStats(page);
  expect(before.width).toBe(800);

  // H-4 at the pixel level: canvas.width assignment wipes the bitmap; the
  // renderer must repaint after the debounced ResizeObserver callback
  await page.evaluate(() => {
    (document.querySelector('#garden') as HTMLElement).style.width = '640px';
  });
  // Wait for the debounced resize itself (it resizes and repaints in one
  // task), rather than sleeping for a guessed debounce + headroom
  await page.waitForFunction(
    () => (document.querySelector('#garden canvas') as HTMLCanvasElement | null)?.width === 640
  );

  const after = await readStats(page);
  expect(after.width).toBe(640);
  expect(after.plantPainted).toBeGreaterThan(0);
  expect((await readBitmap(page)) === fresh).toBe(true);
});

// Fade probes share one garden; the line and zone are in canvas rows
const FADE_GARDEN = { maxHeight: 0.6, density: 'dense' };
const FADE_LINE = Math.round(600 * (1 - 0.6)); // the maxHeight line
const FADE_ZONE_END = FADE_LINE + Math.round(600 * 0.2); // fadeHeight 0.2

test('fade blends plant tops into fadeColor', async ({ page }) => {
  // Cyan appears in no natural-palette plant, so exact-cyan pixels can only
  // come from the fade
  await makeGarden(page, { ...FADE_GARDEN, fadeHeight: 0.2, fadeColor: 'cyan' }, 100);
  const nearLine = await page.evaluate(
    ([y0, y1]) => {
      const canvas = document.querySelector('#garden canvas') as HTMLCanvasElement;
      const data = canvas.getContext('2d')!.getImageData(0, y0, canvas.width, y1 - y0).data;
      let painted = 0;
      let cyan = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        painted++;
        if (data[i] < 40 && data[i + 1] > 215 && data[i + 2] > 215) cyan++;
      }
      return { painted, cyan };
    },
    [FADE_LINE, FADE_LINE + Math.round(600 * 0.02)] as const
  );

  // Just under the maxHeight line the fade is near full strength
  expect(nearLine.painted).toBeGreaterThan(50);
  expect(nearLine.cyan / nearLine.painted).toBeGreaterThan(0.8);
});

test('fade changes nothing below its zone and keeps the background transparent', async ({
  page,
}) => {
  await makeGarden(page, { ...FADE_GARDEN, fadeHeight: 0 }, 100);
  const plainBelow = await readBitmap(page, FADE_ZONE_END);
  const plain = await readStats(page);

  await makeGarden(page, { ...FADE_GARDEN, fadeHeight: 0.2, fadeColor: 'cyan' }, 100);
  const faded = await readStats(page);

  // source-atop only tints drawn pixels: the painted set is unchanged
  expect(faded.painted).toEqual(plain.painted);
  // The fade paints only down to the end of its zone
  expect((await readBitmap(page, FADE_ZONE_END)) === plainBelow).toBe(true);
});

test('an invalid fadeColor leaves the frame identical to no fade', async ({ page }) => {
  // Reject direction: strings a browser rejects, including hex without '#'
  // (once accepted as #aabbcc) and malformed hex lengths
  await makeGarden(page, { ...FADE_GARDEN, fadeHeight: 0 }, 100);
  const plain = await readBitmap(page);

  for (const fadeColor of ['not-a-color', 'abc', '#12345', '#ggg', 'rgb(300', '']) {
    await makeGarden(page, { ...FADE_GARDEN, fadeHeight: 0.2, fadeColor }, 100);
    expect((await readBitmap(page)) === plain, `fadeColor ${JSON.stringify(fadeColor)}`).toBe(true);
  }
});

test("'transparent' fadeColor erases plants above the line and changes nothing below the zone", async ({
  page,
}) => {
  await makeGarden(page, { ...FADE_GARDEN, fadeHeight: 0 }, 100);
  const plainBelow = await readBitmap(page, FADE_ZONE_END);
  // Plant parts poke above the line, so there is something to erase
  expect(await paintedRows(page, 0, FADE_LINE)).toBeGreaterThan(0);

  await makeGarden(page, { ...FADE_GARDEN, fadeHeight: 0.2, fadeColor: 'transparent' }, 100);

  // Above the line the gradient's first stop (full strength) erases everything
  expect(await paintedRows(page, 0, FADE_LINE)).toBe(0);
  expect((await readBitmap(page, FADE_ZONE_END)) === plainBelow).toBe(true);
});
