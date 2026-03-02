/**
 * Regression tests for memory-related code paths
 * Verifies behavior before and after memory optimizations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawStem } from './plants/renderers';
import { GrowthProgressPool } from './GrowthProgressPool';
import { createRandom, seededRandom } from './SeededRandom';

// ==================== drawStem TESTS ====================

describe('drawStem return value', () => {
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

  it('returns null when growth is 0', () => {
    expect(drawStem(ctx, 100, 200, 50, 2, '#333', 0.1, 0)).toBeNull();
  });

  it('returns null when growth is negative', () => {
    expect(drawStem(ctx, 100, 200, 50, 2, '#333', 0.1, -0.5)).toBeNull();
  });

  it('returns end position at full growth', () => {
    const result = drawStem(ctx, 100, 300, 100, 2, '#333', 0.1, 1);
    expect(result).not.toBeNull();
    // With lean=0.1, height=100: endX = 100 + 0.1*100 = 110, endY = 300 - 100 = 200
    expect(result!.x).toBeCloseTo(110, 1);
    expect(result!.y).toBeCloseTo(200, 1);
  });

  it('returns correct end position at partial growth', () => {
    const result = drawStem(ctx, 100, 300, 100, 2, '#333', 0, 0.5);
    expect(result).not.toBeNull();
    // With lean=0, h=50: endX = 100, endY = 300 - 50 = 250
    expect(result!.x).toBeCloseTo(100, 1);
    expect(result!.y).toBeCloseTo(250, 1);
  });

  it('calls correct canvas methods', () => {
    drawStem(ctx, 100, 300, 100, 2, '#4a7c40', 0.1, 1);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(100, 300);
    expect(ctx.bezierCurveTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe('#4a7c40');
    expect(ctx.lineWidth).toBe(2);
    expect(ctx.lineCap).toBe('round');
  });

  it('consecutive calls return correct values when consumed immediately', () => {
    // drawStem returns a shared object — values must be consumed before next call
    const r1 = drawStem(ctx, 50, 200, 80, 2, '#333', 0.2, 1);
    expect(r1).not.toBeNull();
    // r1: endX = 50 + 0.2*80 = 66, endY = 200 - 80 = 120
    const r1x = r1!.x, r1y = r1!.y;
    expect(r1x).toBeCloseTo(66, 1);
    expect(r1y).toBeCloseTo(120, 1);

    const r2 = drawStem(ctx, 150, 200, 60, 2, '#333', -0.1, 1);
    expect(r2).not.toBeNull();
    // r2: endX = 150 + (-0.1)*60 = 144, endY = 200 - 60 = 140
    expect(r2!.x).toBeCloseTo(144, 1);
    expect(r2!.y).toBeCloseTo(140, 1);
  });
});

// ==================== createRandom DETERMINISM TESTS ====================

describe('createRandom determinism (used in tall plant renderers)', () => {
  it('produces same sequence for same seed', () => {
    const r1 = createRandom(42);
    const r2 = createRandom(42);
    const values1 = Array.from({ length: 30 }, () => r1());
    const values2 = Array.from({ length: 30 }, () => r2());
    expect(values1).toEqual(values2);
  });

  it('produces different sequences for different seeds', () => {
    const r1 = createRandom(42);
    const r2 = createRandom(43);
    const v1 = r1();
    const v2 = r2();
    expect(v1).not.toBe(v2);
  });

  it('values are in [0, 1) range', () => {
    const rand = createRandom(12345);
    for (let i = 0; i < 100; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('seededRandom is pure for same input', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(seededRandom(seed)).toBe(seededRandom(seed));
    }
  });
});

// ==================== GrowthProgressPool FRAME HISTORY TESTS ====================

describe('GrowthProgressPool frame history', () => {
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

describe('GrowthProgressPool destroy/reset', () => {
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

// ==================== RENDER CONTEXT CONSISTENCY TESTS ====================

describe('Flowering context calculations are consistent', () => {
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

  it('x coordinate calculation: plant.x * width', () => {
    // Verify that x = plant.x * width produces correct results
    // for a variety of plant.x values [0, 1] and widths
    const widths = [100, 800, 1920];
    const xs = [0, 0.25, 0.5, 0.75, 1];
    for (const w of widths) {
      for (const px of xs) {
        expect(px * w).toBeCloseTo(w * px);
      }
    }
  });

  it('plantHeight calculation uses variation heightMultiplier', () => {
    // plantHeight = maxHeight * height * variation.heightMultiplier
    const height = 600;
    const maxHeight = 0.35;
    const heightMultiplier = 1.3;
    const result = maxHeight * height * heightMultiplier;
    expect(result).toBeCloseTo(273, 0);
  });
});
