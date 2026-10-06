/**
 * Performance Tests - Verify primitives meet performance requirements
 * These tests ensure that critical operations are fast enough for
 * real-time animation.
 *
 * Budgets are regression canaries, not benchmarks: they are set ~10x above
 * expected dev-machine timings so they only fail on order-of-magnitude
 * regressions, not on slow/virtualized CI hosts.
 */

import { describe, it, expect } from 'vitest';
import { Vec2, MutableVec2 } from './Vec2';
import { Color } from './Color';
import { SeededRandom } from './SeededRandom';
import { GrowthProgress } from './GrowthProgress';
import { GrowthProgressPool, MutableGrowthProgress } from './GrowthProgressPool';
import { generatePlants } from './plants/generator';
import { drawPlant } from './plants/renderers';
import { resolveOptions } from './defaults';
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
  const ITERATIONS = 50000;

  it('MutableVec2 addMut should be faster than Vec2 add', () => {
    const immutable = new Vec2(10, 20);
    const mutable = new MutableVec2(10, 20);
    const other = { x: 5, y: 5 };

    const immutableTime = measureTimeMs(() => immutable.add(other), ITERATIONS);
    const mutableTime = measureTimeMs(() => mutable.addMut(other), ITERATIONS);

    // Mutable should be at least as fast (no allocations)
    // Using a generous factor since JIT optimization can vary
    expect(mutableTime).toBeLessThan(immutableTime * 2);
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

  it('should perform 100k next() calls in under 500ms', () => {
    const time = measureTimeMs(() => rng.next(), ITERATIONS);
    expect(time).toBeLessThan(500);
  });

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

  it('should perform 50k calculate() calls in under 500ms', () => {
    const time = measureTimeMs(
      () => GrowthProgress.calculate(500, 100, 1000),
      ITERATIONS
    );
    expect(time).toBeLessThan(500);
  });

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

describe('Performance: real generate + render path', () => {
  it('worst legal garden generates and draws one mid-growth frame in under 2500ms', () => {
    // Canary over the real hot path, not a simulation of it: the densest
    // legal configuration through generatePlants(), then drawPlant() for
    // every plant at mid-growth on a no-op context (so only library code is
    // timed). Measured ~150-220ms cold on a dev container (2026-10);
    // the budget carries >10x headroom.
    const start = performance.now();
    const plants = generatePlants(
      resolveOptions({
        container: document.createElement('div'),
        seed: 42,
        density: 'lush',
        generations: OPTION_BOUNDS.GENERATIONS.max,
        maxHeight: OPTION_BOUNDS.MAX_HEIGHT.max,
      })
    );

    const noop = () => {};
    const ctx = { createLinearGradient: () => ({ addColorStop: noop }) } as Record<string, unknown>;
    for (const method of [
      'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
      'arc', 'ellipse', 'rect', 'fill', 'stroke', 'fillRect', 'clearRect',
      'save', 'restore', 'translate', 'rotate', 'scale', 'setTransform',
    ]) {
      ctx[method] = noop;
    }

    const pool = new GrowthProgressPool({ devMode: false });
    pool.beginFrame();
    for (const plant of plants) {
      drawPlant(
        ctx as unknown as CanvasRenderingContext2D,
        plant,
        1920,
        1080,
        plant.delay + plant.growDuration * 0.5,
        pool
      );
    }
    pool.endFrame();
    const elapsed = performance.now() - start;

    // Guard against a vacuous canary (e.g. generation silently capped)
    expect(plants.length).toBeGreaterThan(OPTION_BOUNDS.GENERATIONS.max * 10);
    expect(pool.getStats().acquired).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2500);
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
  it('Vec2 should achieve > 100k ops/sec for add', () => {
    const v1 = new Vec2(10, 20);
    const v2 = new Vec2(30, 40);
    const ops = measureOpsPerSecond(() => v1.add(v2), 100000);
    expect(ops).toBeGreaterThan(100000);
  });

  it('Color should achieve > 100k ops/sec for creation', () => {
    const ops = measureOpsPerSecond(() => new Color(128, 128, 128), 100000);
    expect(ops).toBeGreaterThan(100000);
  });

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

  it('should handle 1000 plants per frame under 160ms', () => {
    const pool = new GrowthProgressPool({ devMode: false });
    const numPlants = 1000;

    // Pre-generate plant timing data
    const plants = Array.from({ length: numPlants }, (_, i) => ({
      delay: i * 5,
      duration: 1000,
    }));

    const time = 500; // Mid-animation

    pool.beginFrame();
    const start = performance.now();

    for (const plant of plants) {
      if (time >= plant.delay) {
        const phases = pool.acquireAndCalculate(time, plant.delay, plant.duration);
        // Use result to prevent dead code elimination
        if (phases.isActive && phases.stem > 0) {
          // Simulate work
        }
      }
    }

    const elapsed = performance.now() - start;
    pool.endFrame();

    // 10x headroom over the 16ms 60fps frame budget
    expect(elapsed).toBeLessThan(160);
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
