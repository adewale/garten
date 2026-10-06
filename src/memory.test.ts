/**
 * Regression tests for the allocation-free code paths (memory optimizations):
 * shared result objects and the growth-progress pool's bookkeeping.
 * These assert reuse and accounting, not heap measurements. drawStem's
 * geometry is covered in plants/renderers.test.ts; RNG determinism in
 * SeededRandom.test.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { drawStem } from './plants/renderers';
import { GrowthProgressPool, MutableGrowthProgress } from './GrowthProgressPool';
import { Color } from './Color';

// ==================== drawStem SHARED RESULT ====================

describe('drawStem shared result object (no per-call allocation)', () => {
  const ctx = {
    beginPath: () => {},
    moveTo: () => {},
    bezierCurveTo: () => {},
    stroke: () => {},
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
  } as unknown as CanvasRenderingContext2D;

  const stemCall = fc.record({
    x: fc.double({ min: -1e4, max: 1e4, noNaN: true }),
    y: fc.double({ min: -1e4, max: 1e4, noNaN: true }),
    height: fc.double({ min: 0, max: 1e4, noNaN: true }),
    lean: fc.double({ min: -1, max: 1, noNaN: true }),
    growth: fc.double({ min: 0, max: 2, minExcluded: true, noNaN: true }),
  });

  it('returns one reused instance that holds the latest call’s tip', () => {
    fc.assert(
      fc.property(fc.array(stemCall, { minLength: 2, maxLength: 20 }), (calls) => {
        const c0 = calls[0];
        const first = drawStem(ctx, c0.x, c0.y, c0.height, 2, '#333', c0.lean, c0.growth);
        for (const c of calls) {
          const result = drawStem(ctx, c.x, c.y, c.height, 2, '#333', c.lean, c.growth);
          // Reused, not reallocated: the caller must copy values before the next call
          expect(result).toBe(first);
          const h = c.height * Math.min(1, c.growth);
          expect({ ...result! }).toEqual({ x: c.x + c.lean * h, y: c.y - h });
        }
      }),
      { numRuns: 500 }
    );
  });
});

// ==================== Color HEX CACHE ====================

describe('Color.toHex cache (no recomputation on repeat calls)', () => {
  it('serves repeat toHex() calls from the cache without rebuilding the string', () => {
    const channel = fc.integer({ min: 0, max: 255 });
    fc.assert(
      fc.property(channel, channel, channel, (r, g, b) => {
        const expected = '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
        const c = new Color(r, g, b);
        expect(c.toHex()).toBe(expected);

        // Building a hex string pads each channel; a cache hit must not
        const padStart = vi.spyOn(String.prototype, 'padStart');
        try {
          expect(c.toHex()).toBe(expected);
          expect(c.toHex()).toBe(expected);
          expect(padStart).not.toHaveBeenCalled();

          // The alpha form is not cached, which proves the spy can observe a rebuild
          expect(c.toHex(true)).toBe(`${expected}ff`);
          expect(padStart).toHaveBeenCalled();
        } finally {
          padStart.mockRestore();
        }
      }),
      { numRuns: 200 }
    );
  });
});

// ==================== GrowthProgressPool BOOKKEEPING (MODEL-BASED) ====================

/** The pool keeps a rolling window of this many frames (DEFAULT_FRAME_HISTORY_SIZE) */
const FRAME_HISTORY_SIZE = 60;

/** One step against the pool: a frame acquiring `n` objects, or a reset() */
type Step = { kind: 'frame'; acquires: number } | { kind: 'reset' };

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 20,
    arbitrary: fc.integer({ min: 0, max: 80 }).map((acquires) => ({ kind: 'frame' as const, acquires })),
  },
  { weight: 1, arbitrary: fc.constant({ kind: 'reset' as const }) }
);
// Enough steps to wrap the 60-frame history ring several times
const stepsArb = fc.array(stepArb, { minLength: 1, maxLength: 200, size: 'max' });
const initialSizeArb = fc.integer({ min: 1, max: 64 });

describe('Property: GrowthProgressPool bookkeeping matches a reference model', () => {
  it('stats, frame history and reset agree with the model', () => {
    fc.assert(
      fc.property(initialSizeArb, stepsArb, (initialSize, steps) => {
        const pool = new GrowthProgressPool({ initialSize, devMode: false, strictMode: false });
        // Reference model: plain counters and the full list of frames
        let frameNumber = 0;
        let acquired = 0;
        let peak = 0;
        let frames: Array<{ frameNumber: number; usage: number }> = [];

        // Compared before every reset and at the end of the run
        const expectModel = () => {
          const { acquired: a, released, peakUsage } = pool.getStats();
          expect({ acquired: a, released, peakUsage }).toEqual({
            acquired,
            released: acquired,
            peakUsage: peak,
          });
          expect(
            pool.getFrameHistory().map(({ frameNumber, usage }) => ({ frameNumber, usage }))
          ).toEqual(frames.slice(-FRAME_HISTORY_SIZE));
        };

        for (const step of steps) {
          if (step.kind === 'reset') {
            expectModel();
            pool.reset();
            frameNumber = 0;
            acquired = 0;
            peak = 0;
            frames = [];
            expect(pool.getStats().poolSize).toBe(initialSize);
            expect(pool.getStats().growthEvents).toBe(0);
          } else {
            pool.beginFrame();
            for (let i = 0; i < step.acquires; i++) pool.acquire();
            pool.endFrame();
            frameNumber++;
            acquired += step.acquires;
            peak = Math.max(peak, step.acquires);
            frames.push({ frameNumber, usage: step.acquires });
          }
        }
        expectModel();
      }),
      { numRuns: 300 }
    );
  });

  it('recycled objects compute exactly what a fresh object computes', () => {
    // A pooled object is reused across frames, growth and reset(); no state
    // from an earlier use may leak into a later calculation
    const timing = fc.record({
      time: fc.double({ min: -100, max: 1000, noNaN: true }),
      delay: fc.double({ min: 0, max: 500, noNaN: true }),
      duration: fc.double({ min: 0.1, max: 500, noNaN: true }),
    });
    const frame = fc.oneof(
      { weight: 10, arbitrary: fc.array(timing, { maxLength: 40, size: 'max' }) },
      { weight: 1, arbitrary: fc.constant('reset' as const) }
    );
    const framesArb = fc.array(frame, { minLength: 1, maxLength: 30, size: 'max' });
    fc.assert(
      fc.property(initialSizeArb, framesArb, (initialSize, frames) => {
        const pool = new GrowthProgressPool({ initialSize, devMode: false, strictMode: false });
        for (const f of frames) {
          if (f === 'reset') {
            pool.reset();
            continue;
          }
          pool.beginFrame();
          const pooled = f.map(({ time, delay, duration }) => ({
            ...pool.acquireAndCalculate(time, delay, duration),
          }));
          pool.endFrame();
          const fresh = f.map(({ time, delay, duration }) => ({
            ...new MutableGrowthProgress().calculateMut(time, delay, duration),
          }));
          expect(pooled).toEqual(fresh);
        }
      }),
      { numRuns: 200 }
    );
  });
});
