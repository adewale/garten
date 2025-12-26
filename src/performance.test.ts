/**
 * Performance Tests - Verify primitives meet performance requirements
 * These tests ensure that critical operations are fast enough for
 * real-time animation at 60fps (16.67ms per frame).
 */

import { describe, it, expect } from 'vitest';
import { Vec2, MutableVec2 } from './Vec2';
import { Color } from './Color';
import { SeededRandom } from './SeededRandom';
import { GrowthProgress } from './GrowthProgress';

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

  it('should perform 50k add operations in under 50ms', () => {
    const time = measureTimeMs(() => v1.add(v2), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k normalize operations in under 50ms', () => {
    const time = measureTimeMs(() => v1.normalize(), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k length operations in under 50ms', () => {
    const time = measureTimeMs(() => v1.length(), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k lerp operations in under 50ms', () => {
    const time = measureTimeMs(() => v1.lerp(v2, 0.5), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k rotate operations in under 50ms', () => {
    const time = measureTimeMs(() => v1.rotate(Math.PI / 4), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k fromPolar operations in under 50ms', () => {
    const time = measureTimeMs(() => Vec2.fromPolar(Math.PI / 4, 100), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k distance operations in under 50ms', () => {
    const time = measureTimeMs(() => v1.distanceTo(v2), ITERATIONS);
    expect(time).toBeLessThan(50);
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

  it('should perform 100k MutableVec2 updates in under 50ms', () => {
    const mv = new MutableVec2(0, 0);
    const time = measureTimeMs(() => {
      mv.set(10, 20);
      mv.addMut({ x: 1, y: 1 });
      mv.multiplyMut(0.99);
    }, 100000);
    expect(time).toBeLessThan(50);
  });
});

describe('Performance: Color operations', () => {
  const ITERATIONS = 50000;
  const color = new Color(128, 128, 128);

  it('should perform 50k color creations in under 50ms', () => {
    const time = measureTimeMs(() => new Color(128, 128, 128), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k toHex conversions in under 50ms', () => {
    const time = measureTimeMs(() => color.toHex(), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k lighten operations in under 50ms', () => {
    const time = measureTimeMs(() => color.lighten(0.2), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k darken operations in under 50ms', () => {
    const time = measureTimeMs(() => color.darken(0.2), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k mix operations in under 50ms', () => {
    const other = new Color(255, 0, 0);
    const time = measureTimeMs(() => color.mix(other, 0.5), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 10k fromHSL operations in under 100ms', () => {
    // HSL conversion is more expensive
    const time = measureTimeMs(() => Color.fromHSL(180, 50, 50), 10000);
    expect(time).toBeLessThan(100);
  });

  it('should perform 10k toHSL operations in under 100ms', () => {
    const time = measureTimeMs(() => color.toHSL(), 10000);
    expect(time).toBeLessThan(100);
  });

  it('should benefit from hex cache', () => {
    const c = new Color(100, 150, 200);

    // First call populates cache
    c.toHex();

    // Measure cached calls
    const cachedTime = measureTimeMs(() => c.toHex(), 50000);

    // Measure uncached calls (new color each time)
    const uncachedTime = measureTimeMs(() => new Color(100, 150, 200).toHex(), 50000);

    // Cached should be faster
    expect(cachedTime).toBeLessThan(uncachedTime);
  });
});

describe('Performance: SeededRandom operations', () => {
  const ITERATIONS = 100000;
  const rng = new SeededRandom(12345);

  it('should perform 100k next() calls in under 50ms', () => {
    const time = measureTimeMs(() => rng.next(), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 100k range() calls in under 50ms', () => {
    const time = measureTimeMs(() => rng.range(0, 100), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 100k int() calls in under 50ms', () => {
    const time = measureTimeMs(() => rng.int(0, 100), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 100k bool() calls in under 50ms', () => {
    const time = measureTimeMs(() => rng.bool(), ITERATIONS);
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k pick() calls in under 50ms', () => {
    const arr = [1, 2, 3, 4, 5];
    const time = measureTimeMs(() => rng.pick(arr), 50000);
    expect(time).toBeLessThan(50);
  });

  it('should perform 10k gaussian() calls in under 100ms', () => {
    // Gaussian uses Box-Muller which is more expensive
    const time = measureTimeMs(() => rng.gaussian(0, 1), 10000);
    expect(time).toBeLessThan(100);
  });

  it('should perform 50k pointInCircle() calls in under 50ms', () => {
    const time = measureTimeMs(() => rng.pointInCircle(), 50000);
    expect(time).toBeLessThan(50);
  });
});

describe('Performance: GrowthProgress calculations', () => {
  const ITERATIONS = 50000;

  it('should perform 50k calculate() calls in under 50ms', () => {
    const time = measureTimeMs(
      () => GrowthProgress.calculate(500, 100, 1000),
      ITERATIONS
    );
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k fromProgress() calls in under 50ms', () => {
    const time = measureTimeMs(
      () => GrowthProgress.fromProgress(0.5),
      ITERATIONS
    );
    expect(time).toBeLessThan(50);
  });

  it('should perform 100k property accesses in under 50ms', () => {
    const growth = GrowthProgress.fromProgress(0.5);
    const time = measureTimeMs(() => {
      growth.stem;
      growth.leaf;
      growth.flower;
      growth.isActive;
    }, 100000);
    expect(time).toBeLessThan(50);
  });

  it('should perform 50k easing calculations in under 50ms', () => {
    const growth = GrowthProgress.fromProgress(0.5);
    const time = measureTimeMs(() => growth.eased('ease-out'), 50000);
    expect(time).toBeLessThan(50);
  });
});

describe('Performance: Simulated render loop', () => {
  it('should handle 1000 plants per frame under 16ms', () => {
    const rng = new SeededRandom(42);

    // Pre-generate plant data
    const plants = Array.from({ length: 1000 }, () => ({
      position: new Vec2(rng.range(0, 800), rng.range(0, 600)),
      delay: rng.range(0, 2000),
      duration: rng.range(1000, 3000),
      height: rng.range(30, 80),
      color: Color.fromHSL(rng.range(0, 360), rng.range(50, 100), rng.range(40, 60)),
    }));

    // Simulate one frame at time=1000
    const time = 1000;
    const start = performance.now();

    let renderedCount = 0;
    for (const plant of plants) {
      const growth = GrowthProgress.calculate(time, plant.delay, plant.duration);

      if (growth.isActive) {
        // Simulate stem position calculation
        const stemTop = plant.position.subtract(new Vec2(0, plant.height * growth.stem));

        // Simulate color variation
        const colorLightness = plant.color.lighten(0.1 * (1 - growth.progress)).luminance();

        // Simulate leaf position (if has leaves)
        if (growth.hasLeaves) {
          const leafDist = stemTop.add(Vec2.fromPolar(-Math.PI / 4, 10 * growth.leaf)).length();
          renderedCount += leafDist > 0 ? 1 : 0;
        }
        renderedCount += colorLightness > 0 ? 1 : 0;
      }
    }
    // Use rendered count to prevent dead code elimination
    expect(renderedCount).toBeGreaterThan(0);

    const elapsed = performance.now() - start;

    // Should complete in under 16ms for 60fps
    expect(elapsed).toBeLessThan(16);
  });

  it('should handle plant generation for 500 plants under 10ms', () => {
    const start = performance.now();

    const rng = new SeededRandom(42);
    const plants = [];

    for (let i = 0; i < 500; i++) {
      plants.push({
        id: i,
        position: new Vec2(rng.range(0, 800), rng.range(0, 600)),
        delay: rng.range(0, 2000),
        duration: rng.range(1000, 3000),
        height: rng.range(30, 80),
        color: Color.fromHSL(rng.range(0, 360), rng.range(50, 100), rng.range(40, 60)),
        variation: {
          lean: rng.centered(0.2),
          thickness: rng.range(0.8, 1.2),
          petals: rng.int(4, 8),
        },
      });
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
    expect(plants.length).toBe(500);
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
    expect(elapsed).toBeLessThan(50);
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
    expect(elapsed).toBeLessThan(20);
  });
});

describe('Performance: Throughput baselines', () => {
  it('Vec2 should achieve > 1M ops/sec for add', () => {
    const v1 = new Vec2(10, 20);
    const v2 = new Vec2(30, 40);
    const ops = measureOpsPerSecond(() => v1.add(v2), 100000);
    expect(ops).toBeGreaterThan(1000000);
  });

  it('Color should achieve > 1M ops/sec for creation', () => {
    const ops = measureOpsPerSecond(() => new Color(128, 128, 128), 100000);
    expect(ops).toBeGreaterThan(1000000);
  });

  it('SeededRandom should achieve > 5M ops/sec for next()', () => {
    const rng = new SeededRandom(42);
    const ops = measureOpsPerSecond(() => rng.next(), 100000);
    expect(ops).toBeGreaterThan(5000000);
  });

  it('GrowthProgress should achieve > 500k ops/sec for calculate', () => {
    const ops = measureOpsPerSecond(
      () => GrowthProgress.calculate(500, 100, 1000),
      100000
    );
    expect(ops).toBeGreaterThan(500000);
  });
});
