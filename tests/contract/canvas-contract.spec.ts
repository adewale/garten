/**
 * Canvas contract tests.
 *
 * The vitest suite uses a strict canvas mock (src/plants/render-sweep.test.ts)
 * whose semantics were hand-encoded from the HTML spec. Each test here
 * verifies one of those encoded rules against a REAL browser canvas, so the
 * mock cannot drift from reality. Test names reference the mock rule they
 * validate.
 *
 * If one of these fails after a browser update, the platform changed —
 * update the mock (and possibly the renderers) to match.
 */

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('about:blank');
});

test('mock rule: beginPath() discards an unflushed path (the climber bug class)', async ({
  page,
}) => {
  const { discarded, control } = await page.evaluate(() => {
    const paint = (interrupt: boolean): number => {
      const canvas = document.createElement('canvas');
      canvas.width = 50;
      canvas.height = 50;
      const ctx = canvas.getContext('2d')!;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.moveTo(5, 25);
      ctx.lineTo(45, 25);
      if (interrupt) {
        ctx.beginPath(); // discards the line above
      }
      ctx.stroke();

      const data = ctx.getImageData(0, 0, 50, 50).data;
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) painted++;
      }
      return painted;
    };
    return { discarded: paint(true), control: paint(false) };
  });

  expect(control).toBeGreaterThan(100); // the line really paints...
  expect(discarded).toBe(0); // ...and beginPath really discards it
});

test('mock rule: negative arc/ellipse radii throw IndexSizeError', async ({ page }) => {
  const results = await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    const attempt = (fn: () => void): string => {
      try {
        fn();
        return 'no-throw';
      } catch (e) {
        return (e as DOMException).name;
      }
    };
    return {
      arc: attempt(() => ctx.arc(10, 10, -5, 0, Math.PI * 2)),
      ellipseX: attempt(() => ctx.ellipse(10, 10, -5, 5, 0, 0, Math.PI * 2)),
      ellipseY: attempt(() => ctx.ellipse(10, 10, 5, -5, 0, 0, Math.PI * 2)),
    };
  });

  expect(results.arc).toBe('IndexSizeError');
  expect(results.ellipseX).toBe('IndexSizeError');
  expect(results.ellipseY).toBe('IndexSizeError');
});

test('mock rule: non-finite coordinates are silently ignored (why the mock flags them)', async ({
  page,
}) => {
  const painted = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(5, 25);
    ctx.lineTo(NaN, 25); // spec: "If any arguments are infinite or NaN, return"
    ctx.lineTo(Infinity, 25);
    ctx.stroke();

    const data = ctx.getImageData(0, 0, 50, 50).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) count++;
    }
    return count;
  });

  // No error, no pixels: NaN bugs are invisible on a real canvas, which is
  // exactly why the strict mock turns them into violations instead
  expect(painted).toBe(0);
});

test('mock rule: save()/restore() restores fillStyle and globalAlpha', async ({ page }) => {
  const result = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ff0000';
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.fillStyle = '#0000ff';
    ctx.globalAlpha = 0.2;
    ctx.restore();

    ctx.fillRect(0, 0, 10, 10);
    const [r, g, b, a] = ctx.getImageData(5, 5, 1, 1).data;
    return { r, g, b, a, alphaProp: ctx.globalAlpha };
  });

  expect(result.alphaProp).toBe(1);
  expect([result.r, result.g, result.b, result.a]).toEqual([255, 0, 0, 255]);
});

test('mock rule: restore() without save() is a silent no-op', async ({ page }) => {
  const threw = await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    try {
      ctx.restore();
      ctx.restore();
      return false;
    } catch {
      return true;
    }
  });
  expect(threw).toBe(false);
});

test('renderer assumption: paths are baked in user space at construction (drawLeaf pattern)', async ({
  page,
}) => {
  // drawLeaf builds a path under translate/rotate, then restore()s before
  // fill(). This only renders correctly because path points are transformed
  // when the path commands run, not at fill time.
  const result = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d')!;

    ctx.save();
    ctx.translate(60, 60);
    ctx.beginPath();
    ctx.rect(0, 0, 20, 20);
    ctx.restore(); // transform reset BEFORE fill

    ctx.fillStyle = '#ff0000';
    ctx.fill();

    const at = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3];
    return { translated: at(70, 70), origin: at(5, 5) };
  });

  expect(result.translated).toBe(255); // painted at the translated position
  expect(result.origin).toBe(0); // not at the untransformed position
});

test('renderer assumption: assigning canvas.width wipes the bitmap (the resize bug root)', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 50, 50);

    const before = ctx.getImageData(25, 25, 1, 1).data[3];
    canvas.width = 50; // same value still wipes
    const after = ctx.getImageData(25, 25, 1, 1).data[3];
    return { before, after };
  });

  expect(result.before).toBe(255);
  expect(result.after).toBe(0);
});

test('renderer assumption: fillStyle accepts the palette and constant color formats', async ({
  page,
}) => {
  // Every color string the library feeds the canvas must parse: 6-digit hex
  // (palettes), 3-digit hex (user input), rgba() (ground color), and
  // 'transparent' (background sentinel handled before reaching fillStyle).
  const results = await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    const parses = (color: string): boolean => {
      ctx.fillStyle = '#123456';
      ctx.fillStyle = color;
      return ctx.fillStyle !== '#123456';
    };
    return {
      hex6: parses('#e85d75'),
      hex3: parses('#fff'),
      rgba: parses('rgba(139, 119, 101, 0.08)'),
    };
  });

  expect(results.hex6).toBe(true);
  expect(results.hex3).toBe(true);
  expect(results.rgba).toBe(true);
});
