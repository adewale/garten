/**
 * Regression tests for the allocation-free code paths (memory optimizations):
 * shared result objects and the growth-progress pool's bookkeeping.
 * These assert reuse and accounting, not heap measurements. drawStem's
 * geometry is covered in plants/renderers.test.ts; RNG determinism in
 * SeededRandom.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawStem } from './plants/renderers';
import { GrowthProgressPool } from './GrowthProgressPool';
import { Color } from './Color';

// ==================== drawStem SHARED RESULT ====================

describe('drawStem shared result object (no per-call allocation)', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      lineCap: 'butt',
    } as unknown as CanvasRenderingContext2D;
  });

  it('returns the same instance on every call, with correct values when consumed immediately', () => {
    const r1 = drawStem(ctx, 50, 200, 80, 2, '#333', 0.2, 1);
    expect(r1).not.toBeNull();
    // r1: endX = 50 + 0.2*80 = 66, endY = 200 - 80 = 120
    const r1x = r1!.x, r1y = r1!.y;
    expect(r1x).toBeCloseTo(66, 1);
    expect(r1y).toBeCloseTo(120, 1);

    const r2 = drawStem(ctx, 150, 200, 60, 2, '#333', -0.1, 1);
    // Reused, not reallocated: the caller must copy values before the next call
    expect(r2).toBe(r1);
    // r2: endX = 150 + (-0.1)*60 = 144, endY = 200 - 60 = 140
    expect(r2!.x).toBeCloseTo(144, 1);
    expect(r2!.y).toBeCloseTo(140, 1);
  });
});

// ==================== Color HEX CACHE ====================

describe('Color.toHex cache (no recomputation on repeat calls)', () => {
  it('serves repeat toHex() calls from the cache without rebuilding the string', () => {
    const c = new Color(100, 150, 200);
    expect(c.toHex()).toBe('#6496c8');

    // Building a hex string pads each channel; a cache hit must not
    const padStart = vi.spyOn(String.prototype, 'padStart');
    try {
      expect(c.toHex()).toBe('#6496c8');
      expect(c.toHex()).toBe('#6496c8');
      expect(padStart).not.toHaveBeenCalled();

      // The alpha form is not cached, which proves the spy can observe a rebuild
      expect(c.toHex(true)).toBe('#6496c8ff');
      expect(padStart).toHaveBeenCalled();
    } finally {
      padStart.mockRestore();
    }
  });
});

// ==================== GrowthProgressPool FRAME HISTORY TESTS ====================

describe('GrowthProgressPool frame-history bookkeeping', () => {
  let pool: GrowthProgressPool;

  beforeEach(() => {
    pool = new GrowthProgressPool({ initialSize: 10, devMode: false, strictMode: false });
  });

  it('tracks frame history up to max size', () => {
    // Run 100 frames
    for (let i = 0; i < 100; i++) {
      pool.beginFrame();
      pool.acquire();
      pool.endFrame();
    }
    const history = pool.getFrameHistory();
    // Default max is 60
    expect(history.length).toBeLessThanOrEqual(60);
    expect(history.length).toBeGreaterThan(0);
  });

  it('frame history has correct usage counts', () => {
    pool.beginFrame();
    pool.acquire();
    pool.acquire();
    pool.acquire();
    pool.endFrame();

    const history = pool.getFrameHistory();
    expect(history[history.length - 1].usage).toBe(3);
  });

  it('frame history has ascending frame numbers', () => {
    for (let i = 0; i < 10; i++) {
      pool.beginFrame();
      pool.acquire();
      pool.endFrame();
    }
    const history = pool.getFrameHistory();
    for (let i = 1; i < history.length; i++) {
      expect(history[i].frameNumber).toBeGreaterThan(history[i - 1].frameNumber);
    }
  });

  it('stats reflect actual usage', () => {
    pool.beginFrame();
    pool.acquire();
    pool.acquire();
    pool.endFrame();

    const stats = pool.getStats();
    expect(stats.acquired).toBe(2);
    expect(stats.released).toBe(2);
    expect(stats.peakUsage).toBe(2);
  });
});

// ==================== GrowthProgressPool LIFECYCLE TESTS ====================

describe('GrowthProgressPool reset', () => {
  it('reset brings pool back to initial state', () => {
    const pool = new GrowthProgressPool({ initialSize: 10, devMode: false });

    // Use the pool for a while
    for (let i = 0; i < 20; i++) {
      pool.beginFrame();
      for (let j = 0; j < 5; j++) pool.acquire();
      pool.endFrame();
    }

    pool.reset();
    const stats = pool.getStats();
    expect(stats.acquired).toBe(0);
    expect(stats.released).toBe(0);
    expect(stats.peakUsage).toBe(0);
    expect(stats.growthEvents).toBe(0);
    expect(stats.poolSize).toBe(10);
  });

  it('pool works correctly after reset', () => {
    const pool = new GrowthProgressPool({ initialSize: 10, devMode: false });

    pool.beginFrame();
    const obj = pool.acquireAndCalculate(5, 0, 10);
    expect(obj.progress).toBeGreaterThan(0);
    pool.endFrame();

    pool.reset();

    // Should work fine after reset
    pool.beginFrame();
    const obj2 = pool.acquireAndCalculate(5, 0, 10);
    expect(obj2.progress).toBeGreaterThan(0);
    pool.endFrame();
  });
});

// ==================== POOLED CALCULATION CONSISTENCY ====================

describe('Pooled growth calculation matches the formula', () => {
  it('growth phases from pool match manual calculation', () => {
    const pool = new GrowthProgressPool({ initialSize: 10, devMode: false });

    pool.beginFrame();
    const fromPool = pool.acquireAndCalculate(5, 2, 6);
    // Manual: progress = (5 - 2) / 6 = 0.5
    expect(fromPool.progress).toBeCloseTo(0.5, 5);
    expect(fromPool.stem).toBeGreaterThan(0);
    expect(fromPool.flower).toBe(0); // flower starts at 0.5 progress, so (0.5 - 0.5)*2 = 0
    pool.endFrame();
  });
});
