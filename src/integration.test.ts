/**
 * Integration Tests - Tests primitives working together
 * Verifies that Vec2, Color, SeededRandom, GrowthProgress, and EventEmitter
 * work correctly in combination as they would in actual garden rendering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Vec2, MutableVec2 } from './Vec2';
import { Color } from './Color';
import { SeededRandom } from './SeededRandom';
import { GrowthProgress } from './GrowthProgress';
import { SimpleEventEmitter } from './EventEmitter';
import { GrowthProgressPool } from './GrowthProgressPool';
import { resolveOptions } from './defaults';
import { buildFlowerColors, buildFoliageColors } from './palettes';
import { generatePlants } from './plants/generator';
import { applyPreset, createConfig } from './presets';

describe('Integration: SeededRandom + Vec2', () => {
  it('should generate deterministic random positions', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    const positions1: Vec2[] = [];
    const positions2: Vec2[] = [];

    for (let i = 0; i < 10; i++) {
      positions1.push(new Vec2(rng1.range(0, 100), rng1.range(0, 100)));
      positions2.push(new Vec2(rng2.range(0, 100), rng2.range(0, 100)));
    }

    for (let i = 0; i < 10; i++) {
      expect(positions1[i].equals(positions2[i])).toBe(true);
    }
  });

  it('should generate points using Vec2 operations with random angles', () => {
    const rng = new SeededRandom(42);
    const center = new Vec2(50, 50);

    const points: Vec2[] = [];
    for (let i = 0; i < 5; i++) {
      const angle = rng.angle();
      const radius = rng.range(10, 30);
      const offset = Vec2.fromPolar(angle, radius);
      points.push(center.add(offset));
    }

    // All points should be within expected radius from center
    for (const point of points) {
      const distance = point.distanceTo(center);
      expect(distance).toBeGreaterThanOrEqual(10);
      expect(distance).toBeLessThanOrEqual(30);
    }
  });

  it('should use SeededRandom pointInCircle with Vec2', () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 10; i++) {
      const point = rng.pointInCircle();
      const vec = Vec2.from(point);
      expect(vec.length()).toBeLessThanOrEqual(1);
    }
  });
});

describe('Integration: SeededRandom + Color', () => {
  it('should generate deterministic random colors', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    const colors1: Color[] = [];
    const colors2: Color[] = [];

    for (let i = 0; i < 5; i++) {
      colors1.push(new Color(rng1.int(0, 255), rng1.int(0, 255), rng1.int(0, 255)));
      colors2.push(new Color(rng2.int(0, 255), rng2.int(0, 255), rng2.int(0, 255)));
    }

    for (let i = 0; i < 5; i++) {
      expect(colors1[i].equals(colors2[i])).toBe(true);
    }
  });

  it('should generate random HSL colors', () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 10; i++) {
      const color = Color.fromHSL(
        rng.range(0, 360),
        rng.range(50, 100),
        rng.range(40, 60)
      );
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(255);
    }
  });

  it('should pick random colors from palette', () => {
    const rng = new SeededRandom(42);
    const palette = [
      new Color(255, 0, 0),
      new Color(0, 255, 0),
      new Color(0, 0, 255),
    ];

    const picked = rng.pick(palette);
    expect(palette.some(c => c.equals(picked))).toBe(true);
  });
});

describe('Integration: GrowthProgress + Vec2', () => {
  it('should calculate stem endpoint based on growth', () => {
    const baseY = 100;
    const stemHeight = 50;

    for (let t = 0; t <= 1; t += 0.2) {
      const growth = GrowthProgress.fromProgress(t);
      const stemTop = new Vec2(0, baseY - stemHeight * growth.stem);

      // Stem grows upward (negative Y in canvas coordinates)
      expect(stemTop.y).toBeLessThanOrEqual(baseY);
      expect(stemTop.y).toBeGreaterThanOrEqual(baseY - stemHeight);
    }
  });

  it('should animate leaf positions with growth phases', () => {
    const stemBase = new Vec2(50, 100);
    const stemLength = 40;

    const growth = GrowthProgress.fromProgress(0.7);

    if (growth.hasLeaves) {
      const leafPosition = stemBase.subtract(new Vec2(0, stemLength * growth.stem * 0.6));
      const leafOffset = Vec2.fromPolar(-Math.PI / 4, 15 * growth.leaf);
      const leafTip = leafPosition.add(leafOffset);

      expect(leafTip.x).toBeGreaterThan(stemBase.x);
      expect(leafTip.y).toBeLessThan(stemBase.y);
    }
  });

  it('should interpolate positions during growth animation', () => {
    const startPos = new Vec2(0, 100);
    const endPos = new Vec2(0, 50);

    for (let t = 0; t <= 1; t += 0.25) {
      const growth = GrowthProgress.fromProgress(t);
      const currentPos = startPos.lerp(endPos, growth.stem);

      expect(currentPos.y).toBeLessThanOrEqual(startPos.y);
      expect(currentPos.y).toBeGreaterThanOrEqual(endPos.y);
    }
  });
});

describe('Integration: GrowthProgress + Color', () => {
  it('should transition colors during bloom', () => {
    const budColor = new Color(100, 150, 100); // Green bud
    const flowerColor = new Color(255, 100, 150); // Pink flower

    for (let t = 0; t <= 1; t += 0.2) {
      const growth = GrowthProgress.fromProgress(t);

      if (growth.hasFlower) {
        const currentColor = budColor.mix(flowerColor, growth.flower);
        // As flower grows, color shifts toward pink
        expect(currentColor.r).toBeGreaterThanOrEqual(budColor.r);
      }
    }
  });

  it('should fade in leaves with alpha during growth', () => {
    const leafColor = new Color(100, 180, 100);

    for (let t = 0; t <= 1; t += 0.2) {
      const growth = GrowthProgress.fromProgress(t);

      if (growth.hasLeaves) {
        const fadedLeaf = leafColor.withAlpha(Math.min(1, growth.leaf * 1.5));
        expect(fadedLeaf.a).toBeLessThanOrEqual(1);
        expect(fadedLeaf.a).toBeGreaterThan(0);
      }
    }
  });
});

describe('Integration: Full plant simulation', () => {
  interface PlantData {
    id: number;
    position: Vec2;
    delay: number;
    duration: number;
    stemHeight: number;
    flowerColor: Color;
  }

  it('should simulate deterministic garden generation', () => {
    const rng1 = new SeededRandom(12345);
    const rng2 = new SeededRandom(12345);

    // Generate 10 plants with each RNG
    const plants1: PlantData[] = [];
    const plants2: PlantData[] = [];

    for (let i = 0; i < 10; i++) {
      plants1.push({
        id: i,
        position: new Vec2(rng1.range(0, 200), rng1.range(0, 100)),
        delay: rng1.range(0, 500),
        duration: rng1.range(1000, 2000),
        stemHeight: rng1.range(30, 60),
        flowerColor: Color.fromHSL(rng1.range(0, 360), rng1.range(70, 100), rng1.range(50, 70)),
      });
    }

    for (let i = 0; i < 10; i++) {
      plants2.push({
        id: i,
        position: new Vec2(rng2.range(0, 200), rng2.range(0, 100)),
        delay: rng2.range(0, 500),
        duration: rng2.range(1000, 2000),
        stemHeight: rng2.range(30, 60),
        flowerColor: Color.fromHSL(rng2.range(0, 360), rng2.range(70, 100), rng2.range(50, 70)),
      });
    }

    // Verify determinism - all properties should match
    for (let i = 0; i < 10; i++) {
      expect(plants1[i].position.equals(plants2[i].position)).toBe(true);
      expect(plants1[i].delay).toBe(plants2[i].delay);
      expect(plants1[i].duration).toBe(plants2[i].duration);
      expect(plants1[i].stemHeight).toBe(plants2[i].stemHeight);
      expect(plants1[i].flowerColor.equals(plants2[i].flowerColor)).toBe(true);
    }
  });

  it('should render plants at different animation times', () => {
    const plant: PlantData = {
      id: 0,
      position: new Vec2(100, 150),
      delay: 100,
      duration: 1000,
      stemHeight: 50,
      flowerColor: new Color(255, 100, 150),
    };

    // Test at various animation times
    const animationTimes = [0, 100, 350, 600, 1100, 2000];

    for (const time of animationTimes) {
      const growth = GrowthProgress.calculate(time, plant.delay, plant.duration);

      if (growth.isActive) {
        const stemTop = plant.position.subtract(new Vec2(0, plant.stemHeight * growth.stem));
        expect(stemTop.y).toBeLessThanOrEqual(plant.position.y);
      }
    }
  });
});

describe('Integration: EventEmitter + Growth lifecycle', () => {
  type GrowthEvents = {
    [key: string]: unknown;
    start: { plantId: number; time: number };
    leafAppear: { plantId: number; time: number };
    flowerAppear: { plantId: number; time: number };
    complete: { plantId: number; time: number };
  };

  it('should emit growth events at correct times', () => {
    const emitter = new SimpleEventEmitter<GrowthEvents>();
    const events: string[] = [];

    emitter.on('start', ({ plantId }) => events.push(`start:${plantId}`));
    emitter.on('leafAppear', ({ plantId }) => events.push(`leaf:${plantId}`));
    emitter.on('flowerAppear', ({ plantId }) => events.push(`flower:${plantId}`));
    emitter.on('complete', ({ plantId }) => events.push(`complete:${plantId}`));

    const plantId = 1;
    const delay = 100;
    const duration = 1000;

    let hasStarted = false;
    let hasLeaves = false;
    let hasFlower = false;
    let isComplete = false;

    // Simulate animation loop
    for (let time = 0; time <= 1200; time += 100) {
      const growth = GrowthProgress.calculate(time, delay, duration);

      if (growth.isActive && !hasStarted) {
        emitter.emit('start', { plantId, time });
        hasStarted = true;
      }

      if (growth.hasLeaves && !hasLeaves) {
        emitter.emit('leafAppear', { plantId, time });
        hasLeaves = true;
      }

      if (growth.hasFlower && !hasFlower) {
        emitter.emit('flowerAppear', { plantId, time });
        hasFlower = true;
      }

      if (growth.isComplete && !isComplete) {
        emitter.emit('complete', { plantId, time });
        isComplete = true;
      }
    }

    expect(events).toContain('start:1');
    expect(events).toContain('leaf:1');
    expect(events).toContain('flower:1');
    expect(events).toContain('complete:1');

    // Events should be in order
    expect(events.indexOf('start:1')).toBeLessThan(events.indexOf('leaf:1'));
    expect(events.indexOf('leaf:1')).toBeLessThan(events.indexOf('flower:1'));
    expect(events.indexOf('flower:1')).toBeLessThan(events.indexOf('complete:1'));
  });

  it('should support once listeners for completion', () => {
    const emitter = new SimpleEventEmitter<GrowthEvents>();
    const completeFn = vi.fn();

    emitter.once('complete', completeFn);

    emitter.emit('complete', { plantId: 1, time: 1000 });
    emitter.emit('complete', { plantId: 2, time: 2000 });

    expect(completeFn).toHaveBeenCalledTimes(1);
    expect(completeFn).toHaveBeenCalledWith({ plantId: 1, time: 1000 });
  });
});

describe('Integration: MutableVec2 for hot paths', () => {
  it('should accumulate positions without allocations', () => {
    const rng = new SeededRandom(42);
    const accumulator = new MutableVec2(0, 0);

    // Simulate averaging multiple random points
    const count = 100;
    for (let i = 0; i < count; i++) {
      const point = rng.pointInCircle();
      accumulator.addMut(point);
    }

    // Average should be near center (0, 0) for uniform distribution
    const avg = new Vec2(accumulator.x / count, accumulator.y / count);
    expect(Math.abs(avg.x)).toBeLessThan(0.2);
    expect(Math.abs(avg.y)).toBeLessThan(0.2);
  });

  it('should convert to immutable Vec2 for storage', () => {
    const mutable = new MutableVec2(10, 20);
    mutable.addMut({ x: 5, y: 5 });

    const immutable = mutable.toVec2();
    expect(immutable).toBeInstanceOf(Vec2);
    expect(immutable.x).toBe(15);
    expect(immutable.y).toBe(25);
  });
});

describe('Integration: Color manipulation chains', () => {
  it('should chain color operations for plant variation', () => {
    const rng = new SeededRandom(42);
    const baseColor = new Color(100, 180, 100); // Green

    // Simulate creating leaf color variations
    const variations: Color[] = [];
    for (let i = 0; i < 5; i++) {
      const variation = baseColor
        .lighten(rng.range(0, 0.2))
        .rotateHue(rng.range(-10, 10))
        .saturate(rng.range(-0.1, 0.1));
      variations.push(variation);
    }

    // All variations should be greenish
    for (const v of variations) {
      expect(v.g).toBeGreaterThan(v.r);
      expect(v.g).toBeGreaterThan(v.b);
    }
  });

  it('should create gradient stops for petal rendering', () => {
    const petalColor = new Color(255, 150, 180);

    const stops = [
      { offset: 0, color: petalColor.lighten(0.3) },
      { offset: 0.5, color: petalColor },
      { offset: 1, color: petalColor.darken(0.2) },
    ];

    // Gradient should go from light to dark
    expect(stops[0].color.luminance()).toBeGreaterThan(stops[1].color.luminance());
    expect(stops[1].color.luminance()).toBeGreaterThan(stops[2].color.luminance());
  });
});

// ==================== CONSTRAINT TESTS ====================
// These tests verify invariants and relationships that must hold
// across the system to ensure correctness.

describe('Constraint: Growth phase ordering', () => {
  it('stem should always be >= flower at any progress', () => {
    // Stem starts immediately and grows faster, flower starts at 50%
    for (let p = 0; p <= 1; p += 0.05) {
      const growth = GrowthProgress.fromProgress(p);
      expect(growth.stem).toBeGreaterThanOrEqual(growth.flower);
    }
  });

  it('stem should reach 1 before flower reaches 1', () => {
    // Stem completes at progress ~0.67, flower at progress 1.0
    const atStemComplete = GrowthProgress.fromProgress(0.67);
    expect(atStemComplete.stem).toBe(1);
    expect(atStemComplete.flower).toBeLessThan(1);
  });

  it('leaf should start before flower', () => {
    // Leaf starts at 30%, flower at 50%
    const atLeafStart = GrowthProgress.fromProgress(0.31);
    const atFlowerStart = GrowthProgress.fromProgress(0.51);

    expect(atLeafStart.hasLeaves).toBe(true);
    expect(atLeafStart.hasFlower).toBe(false);
    expect(atFlowerStart.hasFlower).toBe(true);
  });

  it('progress should be monotonically increasing with time', () => {
    const delay = 100;
    const duration = 1000;
    let previousProgress = -1;

    for (let time = 0; time <= 1200; time += 50) {
      const growth = GrowthProgress.calculate(time, delay, duration);
      expect(growth.progress).toBeGreaterThanOrEqual(previousProgress);
      previousProgress = growth.progress;
    }
  });

  it('all phases should be clamped to [0, 1]', () => {
    // Test edge cases including negative and very large progress
    const testCases = [-0.5, 0, 0.5, 1, 1.5, 2];

    for (const p of testCases) {
      const growth = GrowthProgress.fromProgress(p);
      expect(growth.progress).toBeGreaterThanOrEqual(0);
      expect(growth.progress).toBeLessThanOrEqual(1);
      expect(growth.stem).toBeGreaterThanOrEqual(0);
      expect(growth.stem).toBeLessThanOrEqual(1);
      expect(growth.leaf).toBeGreaterThanOrEqual(0);
      expect(growth.leaf).toBeLessThanOrEqual(1);
      expect(growth.flower).toBeGreaterThanOrEqual(0);
      expect(growth.flower).toBeLessThanOrEqual(1);
    }
  });
});

describe('Constraint: Determinism', () => {
  it('SeededRandom should produce identical sequences with same seed', () => {
    const runs = 3;
    const sequences: number[][] = [];

    for (let run = 0; run < runs; run++) {
      const rng = new SeededRandom(42);
      const seq: number[] = [];
      for (let i = 0; i < 100; i++) {
        seq.push(rng.next());
      }
      sequences.push(seq);
    }

    // All runs should produce identical sequences
    for (let run = 1; run < runs; run++) {
      for (let i = 0; i < 100; i++) {
        expect(sequences[run][i]).toBe(sequences[0][i]);
      }
    }
  });

  it('forked RNG should produce independent sequence from parent', () => {
    const rng = new SeededRandom(42);

    // Get some values before forking (advancing the RNG state)
    rng.next();
    rng.next();

    // Fork (note: fork() consumes one value from parent to derive child seed)
    const forked = rng.fork();

    // Get values from both
    const parentAfter = [rng.next(), rng.next()];
    const forkedValues = [forked.next(), forked.next()];

    // Parent and forked should produce different sequences
    expect(parentAfter).not.toEqual(forkedValues);

    // Using the forked RNG should not affect the parent's future values
    forked.next();
    forked.next();
    forked.next();

    // Parent continues its own sequence unaffected by forked usage
    const parentContinued = [rng.next(), rng.next()];

    // Verify parent sequence is deterministic (create fresh RNG)
    const rngFresh = new SeededRandom(42);
    rngFresh.next(); rngFresh.next(); // match parentBefore
    rngFresh.fork();                   // match fork call
    rngFresh.next(); rngFresh.next(); // match parentAfter
    const freshContinued = [rngFresh.next(), rngFresh.next()];

    expect(parentContinued).toEqual(freshContinued);
  });

  it('same seed should produce same color from HSL', () => {
    for (let seed = 0; seed < 10; seed++) {
      const rng1 = new SeededRandom(seed);
      const rng2 = new SeededRandom(seed);

      const color1 = Color.fromHSL(rng1.range(0, 360), rng1.range(50, 100), rng1.range(40, 60));
      const color2 = Color.fromHSL(rng2.range(0, 360), rng2.range(50, 100), rng2.range(40, 60));

      expect(color1.equals(color2)).toBe(true);
    }
  });
});

describe('Constraint: Color validity', () => {
  it('RGB values should always be clamped to 0-255', () => {
    // Test edge cases
    const edgeCases = [
      new Color(-10, 128, 128),
      new Color(300, 128, 128),
      new Color(128, -50, 128),
      new Color(128, 128, 500),
    ];

    for (const color of edgeCases) {
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(255);
      expect(color.g).toBeGreaterThanOrEqual(0);
      expect(color.g).toBeLessThanOrEqual(255);
      expect(color.b).toBeGreaterThanOrEqual(0);
      expect(color.b).toBeLessThanOrEqual(255);
    }
  });

  it('alpha should always be clamped to 0-1', () => {
    const edgeCases = [
      new Color(128, 128, 128, -0.5),
      new Color(128, 128, 128, 1.5),
      new Color(128, 128, 128, 0),
      new Color(128, 128, 128, 1),
    ];

    for (const color of edgeCases) {
      expect(color.a).toBeGreaterThanOrEqual(0);
      expect(color.a).toBeLessThanOrEqual(1);
    }
  });

  it('hex conversion should be reversible', () => {
    const testColors = [
      new Color(0, 0, 0),
      new Color(255, 255, 255),
      new Color(128, 64, 192),
      new Color(255, 0, 128),
    ];

    for (const original of testColors) {
      const hex = original.toHex();
      const restored = Color.fromHex(hex);
      expect(restored).not.toBeNull();
      expect(restored!.r).toBe(original.r);
      expect(restored!.g).toBe(original.g);
      expect(restored!.b).toBe(original.b);
    }
  });

  it('lighten should increase luminance or stay same', () => {
    const colors = [
      new Color(100, 100, 100),
      new Color(200, 50, 50),
      new Color(50, 150, 50),
    ];

    for (const color of colors) {
      const lightened = color.lighten(0.2);
      expect(lightened.luminance()).toBeGreaterThanOrEqual(color.luminance() - 0.001);
    }
  });

  it('darken should decrease luminance or stay same', () => {
    const colors = [
      new Color(100, 100, 100),
      new Color(200, 50, 50),
      new Color(50, 150, 50),
    ];

    for (const color of colors) {
      const darkened = color.darken(0.2);
      expect(darkened.luminance()).toBeLessThanOrEqual(color.luminance() + 0.001);
    }
  });
});

describe('Constraint: Vec2 immutability', () => {
  it('operations should return new instances', () => {
    const v1 = new Vec2(10, 20);
    const v2 = new Vec2(5, 5);

    const added = v1.add(v2);
    const subtracted = v1.subtract(v2);
    const multiplied = v1.multiply(2);
    const normalized = v1.normalize();
    const rotated = v1.rotate(Math.PI);

    // Original should be unchanged
    expect(v1.x).toBe(10);
    expect(v1.y).toBe(20);

    // Results should be different instances
    expect(added).not.toBe(v1);
    expect(subtracted).not.toBe(v1);
    expect(multiplied).not.toBe(v1);
    expect(normalized).not.toBe(v1);
    expect(rotated).not.toBe(v1);
  });

  it('MutableVec2 should mutate in place', () => {
    const mv = new MutableVec2(10, 20);
    const original = mv;

    mv.addMut({ x: 5, y: 5 });

    // Should be same instance
    expect(mv).toBe(original);
    expect(mv.x).toBe(15);
    expect(mv.y).toBe(25);
  });
});

describe('Constraint: GrowthProgress immutability', () => {
  it('fromProgress should return consistent results', () => {
    const progress = 0.75;
    const g1 = GrowthProgress.fromProgress(progress);
    const g2 = GrowthProgress.fromProgress(progress);

    expect(g1.progress).toBe(g2.progress);
    expect(g1.stem).toBe(g2.stem);
    expect(g1.leaf).toBe(g2.leaf);
    expect(g1.flower).toBe(g2.flower);
  });

  it('eased should not modify original', () => {
    const growth = GrowthProgress.fromProgress(0.5);
    const originalProgress = growth.progress;

    growth.eased('ease-out');
    growth.easedStem('ease-in');
    growth.easedFlower('ease-in-out');

    // Original values unchanged
    expect(growth.progress).toBe(originalProgress);
  });
});

// ==================== GROWTHPROGRESSPOOL INTEGRATION ====================

describe('Constraint: GrowthProgressPool frame lifecycle', () => {
  it('should produce identical results to immutable GrowthProgress', () => {
    const pool = new GrowthProgressPool({ devMode: true });

    // Test various progress values
    const testCases = [
      { time: 0.5, delay: 0, duration: 1.0 },
      { time: 1.0, delay: 0.5, duration: 1.0 },
      { time: 2.0, delay: 0.3, duration: 2.0 },
      { time: 0.8, delay: 0.2, duration: 0.8 },
    ];

    pool.beginFrame();

    for (const { time, delay, duration } of testCases) {
      const immutable = GrowthProgress.calculate(time, delay, duration);
      const mutable = pool.acquireAndCalculate(time, delay, duration);

      expect(mutable.progress).toBeCloseTo(immutable.progress, 10);
      expect(mutable.stem).toBeCloseTo(immutable.stem, 10);
      expect(mutable.leaf).toBeCloseTo(immutable.leaf, 10);
      expect(mutable.flower).toBeCloseTo(immutable.flower, 10);
    }

    pool.endFrame();
  });

  it('should maintain phase ordering invariants (stem >= flower)', () => {
    const pool = new GrowthProgressPool({ devMode: true });
    const testProgressValues = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

    pool.beginFrame();

    for (const progress of testProgressValues) {
      const time = progress * 1000;
      const phases = pool.acquireAndCalculate(time, 0, 1000);

      // Stem should always be >= flower (stem grows first)
      expect(phases.stem).toBeGreaterThanOrEqual(phases.flower);

      // All phases should be clamped to [0, 1]
      expect(phases.progress).toBeGreaterThanOrEqual(0);
      expect(phases.progress).toBeLessThanOrEqual(1);
      expect(phases.stem).toBeGreaterThanOrEqual(0);
      expect(phases.stem).toBeLessThanOrEqual(1);
      expect(phases.leaf).toBeGreaterThanOrEqual(0);
      expect(phases.leaf).toBeLessThanOrEqual(1);
      expect(phases.flower).toBeGreaterThanOrEqual(0);
      expect(phases.flower).toBeLessThanOrEqual(1);
    }

    pool.endFrame();
  });

  it('should allow multiple frames without issues', () => {
    const pool = new GrowthProgressPool({ devMode: true });

    for (let frame = 0; frame < 100; frame++) {
      pool.beginFrame();

      // Acquire several objects each frame
      for (let i = 0; i < 50; i++) {
        const phases = pool.acquireAndCalculate(frame * 16.67, i * 100, 1000);
        expect(phases).toBeDefined();
      }

      pool.endFrame();
    }

    const stats = pool.getStats();
    expect(stats.acquired).toBe(5000);
    expect(stats.released).toBe(5000);
    expect(stats.peakUsage).toBe(50);
  });

  it('should correctly release all objects between frames', () => {
    const pool = new GrowthProgressPool({ devMode: true });

    pool.beginFrame();
    const obj1 = pool.acquire();
    obj1.progress = 0.5;
    pool.endFrame();

    pool.beginFrame();
    const obj2 = pool.acquire();
    // Object should be reset
    expect(obj2.progress).toBe(0);
    pool.endFrame();

    // Same object should have been reused
    expect(obj1).toBe(obj2);
  });
});

describe('Constraint: Pool + Render integration', () => {
  it('should handle plant rendering simulation', () => {
    const pool = new GrowthProgressPool({ devMode: true });

    // Simulate rendering 500 plants over multiple frames
    const numPlants = 500;
    const plants = Array.from({ length: numPlants }, (_, i) => ({
      delay: i * 10,
      duration: 1000,
    }));

    for (let frame = 0; frame < 60; frame++) {
      const time = frame * 16.67;

      pool.beginFrame();

      for (const plant of plants) {
        // Only check plants that have started (time > delay, not >=)
        // When time == delay, progress is 0, which means isActive is false
        if (time > plant.delay) {
          const phases = pool.acquireAndCalculate(time, plant.delay, plant.duration);
          expect(phases.isActive).toBe(true);
        }
      }

      pool.endFrame();
    }

    const stats = pool.getStats();
    expect(stats.growthEvents).toBe(0); // Should not need to grow from 1024
  });
});

// ==================== CONTROL INTERACTION TESTS ====================
// These tests verify that setOptions() correctly preserves state and
// that the same configuration produces identical results regardless
// of the order in which options are set.

describe('Constraint: setOptions preserves existing options', () => {

  it('should preserve all options when changing one property', () => {
    // Create base config
    const baseConfig = {
      container: document.createElement('div'),
      duration: 300,
      generations: 100,
      maxHeight: 0.8,
      density: 'lush' as const,
      seed: 12345,
      timingCurve: 'ease-out' as const,
      colors: {
        accent: '#FF0000',
        palette: 'warm' as const,
        accentWeight: 0.7,
      },
    };

    const resolved = resolveOptions(baseConfig);

    // Verify all properties are preserved
    expect(resolved.duration).toBe(300);
    expect(resolved.generations).toBe(100);
    expect(resolved.maxHeight).toBe(0.8);
    expect(resolved.density).toBe('lush');
    expect(resolved.seed).toBe(12345);
    expect(resolved.timingCurve).toBe('ease-out');
    expect(resolved.colors.accent).toBe('#FF0000');
    expect(resolved.colors.palette).toBe('warm');
    expect(resolved.colors.accentWeight).toBe(0.7);
  });

  it('should preserve color sub-properties when changing only palette', () => {
    const config = {
      container: document.createElement('div'),
      colors: {
        accent: '#004280',  // Blue
        palette: 'monotone' as const,
        accentWeight: 1,
      },
    };

    const resolved = resolveOptions(config);

    expect(resolved.colors.accent).toBe('#004280');
    expect(resolved.colors.palette).toBe('monotone');
    expect(resolved.colors.accentWeight).toBe(1);
  });

  it('should use default seed when not provided', () => {
    const config1 = resolveOptions({ container: document.createElement('div') });
    const config2 = resolveOptions({ container: document.createElement('div') });

    // Both should have seeds (random but present)
    expect(config1.seed).toBeDefined();
    expect(config2.seed).toBeDefined();
    expect(typeof config1.seed).toBe('number');
    expect(typeof config2.seed).toBe('number');
  });

  it('should preserve explicit seed across resolutions', () => {
    const config = {
      container: document.createElement('div'),
      seed: 42,
    };

    const resolved = resolveOptions(config);
    expect(resolved.seed).toBe(42);
  });
});

describe('Constraint: Order-independent configuration', () => {

  it('should produce same colors regardless of property order', () => {
    // Order 1: accent then palette
    const options1 = {
      accent: '#004280',
      palette: 'monotone' as const,
      accentWeight: 1,
      flowerColors: [],
      foliageColors: [],
    };

    // Order 2: palette then accent (same final state)
    const options2 = {
      palette: 'monotone' as const,
      accent: '#004280',
      accentWeight: 1,
      flowerColors: [],
      foliageColors: [],
    };

    const flowers1 = buildFlowerColors(options1);
    const flowers2 = buildFlowerColors(options2);

    expect(flowers1).toEqual(flowers2);
  });

  it('monotone palette should derive all colors from accent', () => {
    const blueAccent = {
      accent: '#004280',
      palette: 'monotone' as const,
      accentWeight: 1,
      flowerColors: [],
      foliageColors: [],
    };

    const flowers = buildFlowerColors(blueAccent);

    // All colors should be derived from blue (contain 004280 in some form)
    // The accent color should be in the array
    expect(flowers).toContain('#004280');
    expect(flowers.length).toBe(7); // monotone generates 7 colors
  });

  it('monotone foliage should derive from accent', () => {
    const blueAccent = {
      accent: '#004280',
      palette: 'monotone' as const,
      accentWeight: 1,
      flowerColors: [],
      foliageColors: [],
    };

    const foliage = buildFoliageColors(blueAccent);

    // Should have leaves and stems
    expect(foliage.leaves.length).toBe(5);
    expect(foliage.stems.length).toBe(4);

    // All should be valid hex colors
    for (const color of foliage.leaves) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    for (const color of foliage.stems) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('grayscale should ignore accent entirely', () => {
    const redAccent = {
      accent: '#FF0000',
      palette: 'grayscale' as const,
      accentWeight: 1,
      flowerColors: [],
      foliageColors: [],
    };

    const blueAccent = {
      accent: '#0000FF',
      palette: 'grayscale' as const,
      accentWeight: 1,
      flowerColors: [],
      foliageColors: [],
    };

    const flowers1 = buildFlowerColors(redAccent);
    const flowers2 = buildFlowerColors(blueAccent);

    // Should be identical regardless of accent
    expect(flowers1).toEqual(flowers2);

    // Should not contain the accent colors
    expect(flowers1).not.toContain('#FF0000');
    expect(flowers1).not.toContain('#0000FF');
  });
});

describe('Constraint: Unique seed per resolveOptions call', () => {
  it('should generate different seeds for each call without explicit seed', () => {
    const container = document.createElement('div');

    const seeds = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const resolved = resolveOptions({ container });
      seeds.add(resolved.seed);
    }

    // All 10 calls should produce different seeds (extremely unlikely to collide)
    expect(seeds.size).toBe(10);
  });

  it('should preserve explicit seed', () => {
    const container = document.createElement('div');
    const resolved = resolveOptions({ container, seed: 12345 });
    expect(resolved.seed).toBe(12345);
  });
});

describe('Constraint: Deep merge in preset functions', () => {

  it('applyPreset should preserve user colors when preset has colors', () => {
    const result = applyPreset('default', {
      colors: { accent: '#FF0000' }
    });

    // User's accent should be preserved
    expect(result.colors?.accent).toBe('#FF0000');
  });

  it('applyPreset should merge preset colors with user colors', () => {
    // Create a mock preset with colors
    const mockPreset = {
      name: 'Test',
      options: {
        duration: 100,
        colors: { palette: 'warm' as const, accent: '#000000' }
      }
    };

    const result = applyPreset(mockPreset, {
      colors: { accent: '#FF0000' }  // Override just accent
    });

    // User's accent should override preset's
    expect(result.colors?.accent).toBe('#FF0000');
    // Preset's palette should be preserved
    expect(result.colors?.palette).toBe('warm');
  });

  it('createConfig should deep merge all layers', () => {
    // createConfig combines preset + theme + options
    const result = createConfig('default', 'natural', {
      colors: { accentWeight: 0.9 }
    });

    // User's accentWeight should be preserved
    expect(result.colors?.accentWeight).toBe(0.9);
    // Should still have other color properties from theme
    expect(result.colors?.palette).toBeDefined();
  });
});

describe('Constraint: Plant timing edge cases', () => {
  it('growDuration should never be zero', () => {
    const container = document.createElement('div');

    // Use extreme settings that might produce zero growDuration
    const resolved = resolveOptions({
      container,
      seed: 42,
      generations: 100,  // Many generations = short per-generation duration
      duration: 10,      // Short total duration
    });

    const plants = generatePlants(resolved);

    for (const plant of plants) {
      expect(plant.growDuration).toBeGreaterThan(0);
      expect(plant.growDuration).toBeGreaterThanOrEqual(0.001);
    }
  });

  it('plant should always complete within duration', () => {
    const container = document.createElement('div');

    const resolved = resolveOptions({
      container,
      seed: 42,
      generations: 47,
      duration: 120,
    });

    const plants = generatePlants(resolved);

    for (const plant of plants) {
      const completionTime = plant.delay + plant.growDuration;
      expect(completionTime).toBeLessThanOrEqual(resolved.duration + 0.001);
    }
  });
});

describe('Constraint: Options that trigger regeneration', () => {

  it('changing categories should produce different plants', () => {
    const container = document.createElement('div');

    const allCategories = resolveOptions({
      container,
      seed: 42,
      generations: 10,
      density: 'normal',
    });

    const grassOnly = resolveOptions({
      container,
      seed: 42,
      generations: 10,
      density: 'normal',
      categories: ['grass'],
    });

    const plants1 = generatePlants(allCategories);
    const plants2 = generatePlants(grassOnly);

    // Grass-only should have fewer plant types
    const types1 = new Set(plants1.map((p: { type: string }) => p.type));
    const types2 = new Set(plants2.map((p: { type: string }) => p.type));

    expect(types1.size).toBeGreaterThan(types2.size);

    // Grass-only should only contain grass types
    for (const plant of plants2) {
      expect(plant.type.toLowerCase()).toContain('grass');
    }
  });

  it('changing timingCurve should affect plant delays', () => {
    const container = document.createElement('div');

    const linear = resolveOptions({
      container,
      seed: 42,
      generations: 10,
      timingCurve: 'linear',
    });

    const easeOut = resolveOptions({
      container,
      seed: 42,
      generations: 10,
      timingCurve: 'ease-out',
    });

    const plants1 = generatePlants(linear);
    const plants2 = generatePlants(easeOut);

    // Plants should exist in both
    expect(plants1.length).toBeGreaterThan(0);
    expect(plants2.length).toBeGreaterThan(0);

    // Delays should be distributed differently
    const avgDelay1 = plants1.reduce((sum: number, p: { delay: number }) => sum + p.delay, 0) / plants1.length;
    const avgDelay2 = plants2.reduce((sum: number, p: { delay: number }) => sum + p.delay, 0) / plants2.length;

    // With ease-out, early generations complete faster, so average delay should be lower
    expect(avgDelay2).not.toBe(avgDelay1);
  });

  it('changing duration should scale plant timings', () => {
    const container = document.createElement('div');

    const short = resolveOptions({
      container,
      seed: 42,
      generations: 10,
      duration: 60,
    });

    const long = resolveOptions({
      container,
      seed: 42,
      generations: 10,
      duration: 120,
    });

    const plants1 = generatePlants(short);
    const plants2 = generatePlants(long);

    // Maximum delay in long duration should be roughly 2x short duration
    const maxDelay1 = Math.max(...plants1.map((p: { delay: number }) => p.delay));
    const maxDelay2 = Math.max(...plants2.map((p: { delay: number }) => p.delay));

    // Allow some tolerance for randomization
    expect(maxDelay2 / maxDelay1).toBeGreaterThan(1.5);
    expect(maxDelay2 / maxDelay1).toBeLessThan(2.5);
  });
});

// ==================== ENVIRONMENT TESTS ====================

import { Environment } from './Environment';

// Mock matchMedia for test environment
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

describe('Constraint: Environment cache behavior', () => {
  beforeEach(() => {
    // Clear cache before each test
    Environment.clearCache();
    // Mock matchMedia
    vi.stubGlobal('matchMedia', mockMatchMedia);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should cache detection results for performance', () => {
    const env1 = Environment.detect();
    const env2 = Environment.detect();

    // Should return the same cached object
    expect(env1).toBe(env2);
  });

  it('getPixelRatio should return fresh values (not cached)', () => {
    // First call to cache the environment
    Environment.detect();

    // getPixelRatio should get fresh values, not cached
    const ratio1 = Environment.getPixelRatio(3);
    const ratio2 = Environment.getPixelRatio(3);

    // Both should be valid numbers
    expect(typeof ratio1).toBe('number');
    expect(typeof ratio2).toBe('number');
    expect(ratio1).toBeGreaterThan(0);
    expect(ratio2).toBeGreaterThan(0);
  });

  it('getPixelRatio should respect max parameter', () => {
    const ratio = Environment.getPixelRatio(1);
    expect(ratio).toBeLessThanOrEqual(1);

    const ratio2 = Environment.getPixelRatio(0.5);
    expect(ratio2).toBeLessThanOrEqual(0.5);
  });

  it('getPixelRatio should return updated value when devicePixelRatio changes', () => {
    const originalDPR = window.devicePixelRatio;
    try {
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true, writable: true });
      const ratio1 = Environment.getPixelRatio(3);

      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true, writable: true });
      const ratio2 = Environment.getPixelRatio(3);

      expect(ratio1).toBe(1);
      expect(ratio2).toBe(2);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: originalDPR, configurable: true, writable: true });
    }
  });

  it('onResize should invalidate cache', () => {
    // Initial detection
    const env1 = Environment.detect();

    // Set up resize listener (this will invalidate cache on resize)
    let resizeCallCount = 0;
    const cleanup = Environment.onResize(() => {
      resizeCallCount++;
    });

    try {
      // Simulate resize event
      window.dispatchEvent(new Event('resize'));

      // Cache should be invalidated after resize
      const env2 = Environment.detect();

      // Should be a new object (cache was cleared)
      expect(env1).not.toBe(env2);
      expect(resizeCallCount).toBe(1);
    } finally {
      cleanup();
    }
  });

  it('clearCache should allow fresh detection', () => {
    const env1 = Environment.detect();
    Environment.clearCache();
    const env2 = Environment.detect();

    // After clearing cache, should get a new object
    expect(env1).not.toBe(env2);
  });

  it('should detect basic capabilities', () => {
    const env = Environment.detect();

    // Basic checks - these should always be available in test environment
    expect(typeof env.isBrowser).toBe('boolean');
    expect(typeof env.hasCanvas).toBe('boolean');
    expect(typeof env.hasRAF).toBe('boolean');
    expect(typeof env.pixelRatio).toBe('number');
    expect(typeof env.isMobile).toBe('boolean');
    expect(typeof env.prefersReducedMotion).toBe('boolean');
  });

  it('onReducedMotionChange should return cleanup function', () => {
    // Trigger detection first
    Environment.detect();

    // Set up listener
    const cleanup = Environment.onReducedMotionChange(() => {
      // Can't easily trigger media query change in tests
    });

    try {
      // Verify the cleanup function works
      expect(typeof cleanup).toBe('function');
    } finally {
      cleanup();
    }
  });

  it('multiple resize listeners should work correctly', () => {
    let count1 = 0;
    let count2 = 0;

    const cleanup1 = Environment.onResize(() => { count1++; });
    const cleanup2 = Environment.onResize(() => { count2++; });

    try {
      window.dispatchEvent(new Event('resize'));

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    } finally {
      cleanup1();
      cleanup2();
    }
  });

  it('cleanup should remove listener', () => {
    let count = 0;
    const cleanup = Environment.onResize(() => { count++; });

    window.dispatchEvent(new Event('resize'));
    expect(count).toBe(1);

    cleanup();

    window.dispatchEvent(new Event('resize'));
    // Count should still be 1 after cleanup
    expect(count).toBe(1);
  });
});

describe('Constraint: Environment utility methods', () => {
  beforeEach(() => {
    Environment.clearCache();
    vi.stubGlobal('matchMedia', mockMatchMedia);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isSupported should check required capabilities', () => {
    const supported = Environment.isSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('getRecommendedSettings should return valid settings', () => {
    const settings = Environment.getRecommendedSettings();

    expect(typeof settings.maxPixelRatio).toBe('number');
    expect(typeof settings.targetFPS).toBe('number');
    expect(['sparse', 'normal', 'dense']).toContain(settings.density);

    expect(settings.maxPixelRatio).toBeGreaterThan(0);
    expect(settings.targetFPS).toBeGreaterThan(0);
  });

  it('isPageVisible should return boolean', () => {
    const visible = Environment.isPageVisible();
    expect(typeof visible).toBe('boolean');
  });

  it('prefersReducedMotion should return boolean', () => {
    const reduced = Environment.prefersReducedMotion();
    expect(typeof reduced).toBe('boolean');
  });

  it('prefersDarkMode should return boolean', () => {
    const dark = Environment.prefersDarkMode();
    expect(typeof dark).toBe('boolean');
  });
});
