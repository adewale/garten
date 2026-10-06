/**
 * Performance Tests - Verify primitives meet performance requirements
 * These tests ensure that critical operations are fast enough for
 * real-time animation.
 *
 * Budgets are regression canaries, not benchmarks: they are set ~10x above
 * expected dev-machine timings so they only fail on order-of-magnitude
 * regressions, not on slow/virtualized CI hosts.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Vec2, MutableVec2 } from './Vec2';
import { Color } from './Color';
import { SeededRandom } from './SeededRandom';
import { GrowthProgress } from './GrowthProgress';
import { GrowthProgressPool, MutableGrowthProgress } from './GrowthProgressPool';
import { generatePlants } from './plants/generator';
import { resolveOptions, plantsPerGeneration } from './defaults';
import { Garten } from './Garden';
import { OPTION_BOUNDS } from './constants';

// Helper to measure operations per second
function measureOpsPerSecond(fn: () => void, iterations: number = 10000): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const elapsed = performance.now() - start;
  return (iterations / elapsed) * 1000;
}

// Helper to measure time for N operations in milliseconds
function measureTimeMs(fn: () => void, iterations: number = 10000): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  return performance.now() - start;
}

describe('Performance: Vec2 operations', () => {
  const ITERATIONS = 50000;
  const v1 = new Vec2(10, 20);
  const v2 = new Vec2(30, 40);

  it('should perform 50k add operations in under 500ms', () => {
    const time = measureTimeMs(() => v1.add(v2), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 50k normalize operations in under 500ms', () => {
    const time = measureTimeMs(() => v1.normalize(), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 50k length operations in under 500ms', () => {
    const time = measureTimeMs(() => v1.length(), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 50k lerp operations in under 500ms', () => {
    const time = measureTimeMs(() => v1.lerp(v2, 0.5), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 50k rotate operations in under 500ms', () => {
    const time = measureTimeMs(() => v1.rotate(Math.PI / 4), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 50k fromPolar operations in under 500ms', () => {
    const time = measureTimeMs(() => Vec2.fromPolar(Math.PI / 4, 100), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 50k distance operations in under 500ms', () => {
    const time = measureTimeMs(() => v1.distanceTo(v2), ITERATIONS);
    expect(time).toBeLessThan(500);
  });
});

describe('Performance: MutableVec2 vs Vec2', () => {
  // The point of MutableVec2 is avoiding allocation, which is deterministic
  // to check; a wall-clock ratio against Vec2.add was not
  it('MutableVec2 addMut updates in place instead of allocating', () => {
    const mutable = new MutableVec2(10, 20);
    const result = mutable.addMut({ x: 5, y: 5 });
    expect(result).toBe(mutable);
    expect([mutable.x, mutable.y]).toEqual([15, 25]);

    const immutable = new Vec2(10, 20);
    expect(immutable.add({ x: 5, y: 5 })).not.toBe(immutable);
  });

  it('should perform 100k MutableVec2 updates in under 500ms', () => {
    const mv = new MutableVec2(0, 0);
    const time = measureTimeMs(() => {
      mv.set(10, 20);
      mv.addMut({ x: 1, y: 1 });
      mv.multiplyMut(0.99);
    }, 100000);
    expect(time).toBeLessThan(500);
  });
});

describe('Performance: Color operations', () => {
  const ITERATIONS = 50000;
  const color = new Color(128, 128, 128);

  it('should perform 50k color creations in under 500ms', () => {
    const time = measureTimeMs(() => new Color(128, 128, 128), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 50k toHex conversions in under 500ms', () => {
    const time = measureTimeMs(() => color.toHex(), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 50k lighten operations in under 500ms', () => {
    const time = measureTimeMs(() => color.lighten(0.2), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 50k darken operations in under 500ms', () => {
    const time = measureTimeMs(() => color.darken(0.2), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 50k mix operations in under 500ms', () => {
    const other = new Color(255, 0, 0);
    const time = measureTimeMs(() => color.mix(other, 0.5), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 10k fromHSL operations in under 1000ms', () => {
    // HSL conversion is more expensive
    const time = measureTimeMs(() => Color.fromHSL(180, 50, 50), 10000);
    expect(time).toBeLessThan(1000);
  });

  it('should perform 10k toHSL operations in under 1000ms', () => {
    const time = measureTimeMs(() => color.toHSL(), 10000);
    expect(time).toBeLessThan(1000);
  });
});

describe('Performance: SeededRandom operations', () => {
  const ITERATIONS = 100000;
  const rng = new SeededRandom(12345);

  it('should perform 100k range() calls in under 500ms', () => {
    const time = measureTimeMs(() => rng.range(0, 100), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 100k int() calls in under 500ms', () => {
    const time = measureTimeMs(() => rng.int(0, 100), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 100k bool() calls in under 500ms', () => {
    const time = measureTimeMs(() => rng.bool(), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

  it('should perform 50k pick() calls in under 500ms', () => {
    const arr = [1, 2, 3, 4, 5];
    const time = measureTimeMs(() => rng.pick(arr), 50000);
    expect(time).toBeLessThan(500);
  });

  it('should perform 10k gaussian() calls in under 1000ms', () => {
    // Gaussian uses Box-Muller which is more expensive
    const time = measureTimeMs(() => rng.gaussian(0, 1), 10000);
    expect(time).toBeLessThan(1000);
  });

  it('should perform 50k pointInCircle() calls in under 500ms', () => {
    const time = measureTimeMs(() => rng.pointInCircle(), 50000);
    expect(time).toBeLessThan(500);
  });
});

describe('Performance: GrowthProgress calculations', () => {
  const ITERATIONS = 50000;

  it('should perform 50k fromProgress() calls in under 500ms', () => {
    const time = measureTimeMs(
      () => GrowthProgress.fromProgress(0.5),
      ITERATIONS
    );
    expect(time).toBeLessThan(500);
  });

  it('should perform 100k property accesses in under 500ms', () => {
    const growth = GrowthProgress.fromProgress(0.5);
    const time = measureTimeMs(() => {
      growth.stem;
      growth.leaf;
      growth.flower;
      growth.isActive;
    }, 100000);
    expect(time).toBeLessThan(500);
  });

  it('should perform 50k easing calculations in under 500ms', () => {
    const growth = GrowthProgress.fromProgress(0.5);
    const time = measureTimeMs(() => growth.eased('ease-out'), 50000);
    expect(time).toBeLessThan(500);
  });
});

describe('Scale probe: the largest legal garden through the real controller', () => {
  // Once, outside the generators (hegel scale.md): the densest legal
  // configuration (max generations, lush, maxHeight 1) through Garten itself
  // - generate, render a frame, resize, seek to the end, destroy - on a
  // canvas whose context only counts calls, so library code is what runs.
  // Per-plant quadratic work or pool exhaustion only shows up at this size.
  // The whole sequence runs once in beforeAll; each test checks one outcome.
  const options = {
    seed: 42,
    density: 'lush' as const,
    generations: OPTION_BOUNDS.GENERATIONS.max,
    maxHeight: OPTION_BOUNDS.MAX_HEIGHT.max,
    duration: 100,
    autoplay: false,
    respectReducedMotion: false,
  };
  const flushes: number[] = []; // fill/stroke count per rendered frame
  let nonFinite = 0;
  let expectedPlants = 0;
  let canvasWidthAfterResize = 0;
  let stateAtEnd = '';
  let canvasRemoved = false;
  let elapsedMs = 0;
  let warnings: string[] = [];

  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let frameFlushes = 0;
    const count = (...args: unknown[]) => {
      for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) nonFinite++;
    };
    const ctx: Record<string, unknown> = {
      createLinearGradient: () => ({ addColorStop: () => {} }),
      clearRect: () => {
        flushes.push(0);
        frameFlushes = flushes.length - 1;
      },
      fill: () => flushes[frameFlushes]++,
      stroke: () => flushes[frameFlushes]++,
    };
    for (const method of [
      'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
      'arc', 'ellipse', 'rect', 'fillRect', 'save', 'restore', 'translate', 'rotate',
      'scale', 'setTransform',
    ]) {
      ctx[method] = count;
    }
    // Dev-mode pools warn once they pass 16,384 objects, which the largest
    // legal garden (up to 30,000 concurrent plants) does by design
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation((() => ctx) as never);

    const container = document.createElement('div');
    document.body.appendChild(container);
    let width = 1920;
    vi.spyOn(container, 'getBoundingClientRect').mockImplementation(
      () => ({ width, height: 1080, top: 0, left: 0, right: width, bottom: 1080, x: 0, y: 0 }) as DOMRect
    );

    try {
      const start = performance.now();
      const garden = new Garten({ container, ...options });
      garden.seek(options.duration / 2); // one mid-growth frame
      width = 1280; // jsdom has no ResizeObserver: the debounced window fallback
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(1000);
      canvasWidthAfterResize = container.querySelector('canvas')!.width;
      garden.seek(options.duration); // every plant fully grown
      stateAtEnd = garden.getState();
      garden.destroy();
      canvasRemoved = container.querySelector('canvas') === null;
      elapsedMs = performance.now() - start;

      expectedPlants = generatePlants(resolveOptions({ container, ...options })).length;
    } finally {
      warnings = warn.mock.calls.map((args) => String(args[0]));
      warn.mockRestore();
      getContext.mockRestore();
      container.remove();
      vi.useRealTimers();
    }
  });

  it('generates within the documented per-generation bounds', () => {
    const [min, max] = plantsPerGeneration.lush;
    expect(expectedPlants).toBeGreaterThanOrEqual(OPTION_BOUNDS.GENERATIONS.max * min);
    expect(expectedPlants).toBeLessThanOrEqual(OPTION_BOUNDS.GENERATIONS.max * max);
  });

  it('renders the mid-growth frame, the resize repaint and the final frame', () => {
    expect(flushes).toHaveLength(3);
    // The resize repaints the same moment it showed before
    expect(flushes[1]).toBe(flushes[0]);
    // Fully grown, every plant draws at least once
    expect(flushes[2]).toBeGreaterThanOrEqual(expectedPlants);
  });

  it('warns about nothing but the expected dev-mode pool growth', () => {
    expect(warnings.filter((w) => !w.startsWith('GrowthProgressPool: Pool grew to'))).toEqual([]);
  });

  it('passes only finite numbers to the canvas', () => {
    expect(nonFinite).toBe(0);
  });

  it('resizes, completes at the end and removes its canvas on destroy', () => {
    expect([canvasWidthAfterResize, stateAtEnd, canvasRemoved]).toEqual([1280, 'complete', true]);
  });

  it('completes the whole sequence within a regression-canary budget', () => {
    // Measured ~480-600ms on a dev container (2026-10); 10x headroom
    expect(elapsedMs).toBeLessThan(6000);
  });
});

describe('Performance: Memory-conscious patterns', () => {
  it('should demonstrate Vec2.temp for zero-allocation hot paths', () => {
    // Simulate a hot loop that would normally allocate many Vec2s
    let sum = 0;

    const start = performance.now();
    for (let idx = 0; idx < 100000; idx++) {
      // Using temp returns reused instance (don't store it!)
      const temp = Vec2.temp(Math.sin(idx), Math.cos(idx));
      sum += temp.x + temp.y;
    }
    const elapsed = performance.now() - start;

    // Should be very fast with no GC pressure
    expect(elapsed).toBeLessThan(500);
    expect(sum).not.toBe(0);
  });

  it('should show MutableVec2 accumulation pattern', () => {
    const rng = new SeededRandom(42);
    const accumulator = new MutableVec2(0, 0);

    const start = performance.now();

    for (let i = 0; i < 10000; i++) {
      const point = rng.pointInCircle();
      accumulator.addMut(point);
    }

    const elapsed = performance.now() - start;

    // Single accumulator means no allocations in loop
    expect(elapsed).toBeLessThan(200);
  });
});

describe('Performance: Throughput baselines', () => {
  it('SeededRandom should achieve > 500k ops/sec for next()', () => {
    const rng = new SeededRandom(42);
    const ops = measureOpsPerSecond(() => rng.next(), 100000);
    expect(ops).toBeGreaterThan(500000);
  });

  it('GrowthProgress should achieve > 500k ops/sec for calculate', () => {
    const ops = measureOpsPerSecond(
      () => GrowthProgress.calculate(500, 100, 1000),
      100000
    );
    expect(ops).toBeGreaterThan(500000);
  });
});

// ==================== GROWTHPROGRESSPOOL PERFORMANCE ====================

describe('Performance: GrowthProgressPool', () => {
  it('should perform 50k acquireAndCalculate in under 500ms', () => {
    const pool = new GrowthProgressPool({ devMode: false, initialSize: 2048, maxSize: 65536 });
    const ITERATIONS = 50000;

    pool.beginFrame();
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      pool.acquireAndCalculate(i * 20, i * 10, 1000);
    }
    const elapsed = performance.now() - start;
    pool.endFrame();

    expect(elapsed).toBeLessThan(500);
  });

  it('should perform 10k beginFrame/endFrame cycles in under 500ms', () => {
    const pool = new GrowthProgressPool({ devMode: false });
    const ITERATIONS = 10000;

    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      pool.beginFrame();
      pool.endFrame();
    }
    const elapsed = performance.now() - start;

    // 10k frame cycles should complete in under 500ms
    expect(elapsed).toBeLessThan(500);
  });

  it('should not grow pool unnecessarily', () => {
    const pool = new GrowthProgressPool({ devMode: false, initialSize: 1024 });

    // Simulate 100 frames with 500 plants each
    for (let frame = 0; frame < 100; frame++) {
      pool.beginFrame();
      for (let i = 0; i < 500; i++) {
        pool.acquireAndCalculate(frame * 16.67, i * 10, 1000);
      }
      pool.endFrame();
    }

    const stats = pool.getStats();
    // With 500 plants and initial size 1024, should never need to grow
    expect(stats.growthEvents).toBe(0);
    expect(stats.poolSize).toBe(1024);
  });

  it('MutableGrowthProgress.calculateMut should achieve > 1M ops/sec', () => {
    const obj = new MutableGrowthProgress();
    const ops = measureOpsPerSecond(
      () => obj.calculateMut(500, 100, 1000),
      100000
    );
    // Measured 11-29M ops/sec on a dev container (2026-10); 10x headroom
    expect(ops).toBeGreaterThan(1000000);
  });

  it('pool.acquire should achieve > 500k ops/sec', () => {
    const pool = new GrowthProgressPool({ devMode: false, initialSize: 100000 });
    pool.beginFrame();
    const ops = measureOpsPerSecond(() => pool.acquire(), 100000);
    pool.endFrame();
    expect(ops).toBeGreaterThan(500000);
  });
});
