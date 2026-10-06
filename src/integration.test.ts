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
import { generatePlants, PLANT_CATEGORIES } from './plants/generator';
import { PlantType } from './types';
import type { PlantData } from './types';
import { applyPreset, applyTheme, createConfig, themes, presets } from './presets';
import { flowerPalettes } from './palettes';
import { hexToRgb as utilsHexToRgb } from './utils';
import { hexToRgb as colorHexToRgb } from './Color';
import { getCompletedGenerations, getGenerationEndTimes } from './plants/generator';
import { getPlantVariation } from './plants/variations';
import { PLANTS_PER_GENERATION } from './constants';
import { OPTION_BOUNDS } from './constants';
import { MAX_RNG_DRAWS_PER_PLANT } from './plants/generator';
import { PlantCategory } from './types';
import * as fc from 'fast-check';

// The documented option contract (README option tables), pinned here
// independently of OPTION_BOUNDS and defaultOptions so a wrong table in the
// code cannot pass by construction
const DOCUMENTED_RANGE = {
  duration: [1, 86400],
  generations: [1, 1000],
  maxHeight: [0.05, 1],
  speed: [0.01, 100],
  maxPixelRatio: [0.5, 4],
  targetFPS: [1, 120],
  opacity: [0, 1],
  fadeHeight: [0, 1],
  zIndex: [-9999, 9999],
} as const;
const DOCUMENTED_DEFAULT = {
  duration: 600,
  generations: 47,
  maxHeight: 0.35,
  speed: 1,
  maxPixelRatio: 2,
  targetFPS: 30,
  opacity: 1,
  fadeHeight: 0,
  zIndex: -1,
} as const;
const NUMERIC_KEYS = Object.keys(DOCUMENTED_RANGE) as Array<keyof typeof DOCUMENTED_RANGE>;
/** README: seeds are "wrapped modulo 1e9 into [0, 1e9)" */
const DOCUMENTED_SEED_RANGE = 1e9;
const DOCUMENTED_ACCENT_WEIGHT = 0.4;
const DOCUMENTED_DENSITIES = ['sparse', 'normal', 'dense', 'lush'] as const;
const DOCUMENTED_PALETTES = ['natural', 'warm', 'cool', 'grayscale', 'vibrant', 'monotone'] as const;
const DOCUMENTED_CURVES = ['linear', 'ease-out', 'ease-in', 'ease-in-out'] as const;

/** Mute console.warn (unconnected containers, unknown option values) per test */
function muteWarnings(): void {
  let spy: ReturnType<typeof vi.spyOn> | undefined;
  beforeEach(() => {
    spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => spy?.mockRestore());
}

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
    expect(growth.hasLeaves).toBe(true);

    const leafPosition = stemBase.subtract(new Vec2(0, stemLength * growth.stem * 0.6));
    const leafOffset = Vec2.fromPolar(-Math.PI / 4, 15 * growth.leaf);
    const leafTip = leafPosition.add(leafOffset);

    expect(leafTip.x).toBeGreaterThan(stemBase.x);
    expect(leafTip.y).toBeLessThan(stemBase.y);
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

    // As the flower grows, its color moves steadily from bud to bloom
    const blooming = [0.6, 0.7, 0.8, 0.9, 1].map((t) => GrowthProgress.fromProgress(t));
    expect(blooming.every((g) => g.hasFlower)).toBe(true);
    const reds = blooming.map((g) => budColor.mix(flowerColor, g.flower).r);
    for (let i = 1; i < reds.length; i++) expect(reds[i]).toBeGreaterThanOrEqual(reds[i - 1]);
    expect(reds[0]).toBeGreaterThanOrEqual(budColor.r);
    expect(reds[reds.length - 1]).toBe(flowerColor.r);
  });

  it('should fade in leaves with alpha during growth', () => {
    const leafColor = new Color(100, 180, 100);

    const leafy = [0.4, 0.6, 0.8, 1].map((t) => GrowthProgress.fromProgress(t));
    expect(leafy.every((g) => g.hasLeaves)).toBe(true);
    for (const growth of leafy) {
      const fadedLeaf = leafColor.withAlpha(Math.min(1, growth.leaf * 1.5));
      expect(fadedLeaf.a).toBeLessThanOrEqual(1);
      expect(fadedLeaf.a).toBeGreaterThan(0);
    }
    expect(GrowthProgress.fromProgress(1).leaf).toBe(1);
  });
});

describe('Integration: generatePlants determinism', () => {
  // "The same options produce an identical garden" is a property over every
  // config: see 'Property: generated gardens over the full config domain'
  const base = { seed: 12345, generations: 12, density: 'dense' as const, maxHeight: 0.8 };

  it('a different seed produces a different garden', () => {
    const a = generatePlants(resolveOptions({ container: document.createElement('div'), ...base }));
    const b = generatePlants(
      resolveOptions({ container: document.createElement('div'), ...base, seed: 12346 })
    );
    expect(b.map((p) => p.type)).not.toEqual(a.map((p) => p.type));
  });
});

describe('Integration: growth phases occur in lifecycle order', () => {
  type GrowthEvents = {
    [key: string]: unknown;
    complete: { plantId: number; time: number };
  };

  it('a plant starts, then leafs, then flowers, then completes', () => {
    const delay = 100;
    const duration = 1000;
    const firstTime = (pred: (g: GrowthProgress) => boolean): number => {
      for (let time = 0; time <= 1200; time += 10) {
        if (pred(GrowthProgress.calculate(time, delay, duration))) return time;
      }
      return Infinity;
    };

    const start = firstTime((g) => g.isActive);
    const leaf = firstTime((g) => g.hasLeaves);
    const flower = firstTime((g) => g.hasFlower);
    const complete = firstTime((g) => g.isComplete);

    expect(start).toBeGreaterThan(delay - 1);
    expect(start).toBeLessThan(leaf);
    expect(leaf).toBeLessThan(flower);
    expect(flower).toBeLessThan(complete);
    expect(complete).toBeLessThanOrEqual(delay + duration);
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

// stem >= flower and the [0, 1] bounds on every phase are properties over all
// progress values in property.test.ts ('GrowthProgress properties')
describe('Constraint: Growth phase ordering', () => {
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

  it('progress never decreases as time advances, for any delay and duration', () => {
    const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
    fc.assert(
      fc.property(
        finite,
        finite,
        finite,
        // Plant grow durations are positive (at least the 100ms floor)
        fc.double({ min: Number.MIN_VALUE, noNaN: true, noDefaultInfinity: true }),
        (t1, t2, delay, duration) => {
          const [early, late] = t1 <= t2 ? [t1, t2] : [t2, t1];
          const before = GrowthProgress.calculate(early, delay, duration).progress;
          const after = GrowthProgress.calculate(late, delay, duration).progress;
          expect(after).toBeGreaterThanOrEqual(before);
        }
      ),
      { numRuns: 2000 }
    );
  });
});

describe('Constraint: Determinism', () => {
  // Same seed, same sequence: a property over all seeds in property.test.ts
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

// Color clamping, the hex round-trip and lighten/darken monotonicity are
// properties over all colors in property.test.ts ('Color properties')

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
  it('agrees exactly with immutable GrowthProgress on every input', () => {
    // Siblings computing the same phases must agree bit for bit, hostile
    // inputs (NaN, infinities, zero or negative durations) included
    const pool = new GrowthProgressPool({ devMode: true });
    const fields = [
      'progress', 'stem', 'leaf', 'flower', 'foliage', 'plume',
      'isActive', 'isComplete', 'hasLeaves', 'hasFlower',
    ] as const;
    fc.assert(
      fc.property(fc.double(), fc.double(), fc.double(), (time, delay, duration) => {
        pool.beginFrame();
        try {
          const immutable = GrowthProgress.calculate(time, delay, duration);
          const mutable = pool.acquireAndCalculate(time, delay, duration);
          for (const field of fields) {
            expect(mutable[field], field).toBe(immutable[field]);
          }
        } finally {
          pool.endFrame();
        }
      }),
      { numRuns: 2000 }
    );
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

// ==================== CONFIGURATION PASSTHROUGH ====================
// resolveOptions() must pass explicit options through unchanged, and the
// same configuration must resolve identically regardless of property order.
// (setOptions() itself is exercised end-to-end in Garden.test.ts.)

describe('Constraint: resolveOptions passes explicit options through', () => {

  it('keeps every explicitly set option', () => {
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

  // Seeds (explicit, missing, wrapped) are properties in
  // 'Property: resolveOptions follows the documented option contract'
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

// ==================== GENERATED-GARDEN PROPERTIES ====================
// Contracts of generatePlants that hold for EVERY configuration, with each
// knob drawn from its full documented domain. Only `generations` is bounded
// for speed, at materialization: usually 1-40, with one draw in ten from the
// whole 1-1000 range.

// The option is case-insensitive and ignores unknown names (with a warning)
const categoryNameArb = fc.oneof(
  { arbitrary: fc.mixedCase(fc.constantFrom(...PLANT_CATEGORIES)), weight: 4 },
  { arbitrary: fc.string(), weight: 1 }
);
const categoriesArb = fc.option(fc.array(categoryNameArb, { maxLength: 6 }), { nil: undefined });
// The four names, the documented exponent range 0.1-10, and any other finite
// number (documented as clamped into that range)
const timingCurveArb = fc.oneof(
  fc.constantFrom(...DOCUMENTED_CURVES),
  fc.double({ min: 0.1, max: 10, noNaN: true }),
  fc.double({ noNaN: true, noDefaultInfinity: true })
);
const gardenConfigArb = fc.record({
  // Any finite seed: resolveOptions wraps it into [0, 1e9)
  seed: fc.oneof(fc.integer({ min: -2e9, max: 2e9 }), fc.double({ noNaN: true, noDefaultInfinity: true })),
  density: fc.constantFrom(...DOCUMENTED_DENSITIES),
  generations: fc.oneof(
    { arbitrary: fc.integer({ min: 1, max: 40 }), weight: 9 },
    { arbitrary: fc.integer({ min: 1, max: 1000 }), weight: 1 }
  ),
  duration: fc.double({ min: 1, max: 86400, noNaN: true }),
  maxHeight: fc.double({ min: 0.05, max: 1, noNaN: true }),
  timingCurve: timingCurveArb,
  categories: categoriesArb,
  colors: fc.record({
    palette: fc.constantFrom(...DOCUMENTED_PALETTES),
    accentWeight: fc.double({ min: 0, max: 1, noNaN: true }),
  }),
});
type GardenConfig = typeof gardenConfigArb extends fc.Arbitrary<infer T> ? T : never;

function growGarden(config: GardenConfig) {
  const resolved = resolveOptions({ container: document.createElement('div'), ...config });
  return { resolved, plants: generatePlants(resolved) };
}

/** Every plant field except the timing ones */
function withoutTimings(plants: PlantData[]) {
  return plants.map(({ delay: _delay, growDuration: _growDuration, ...rest }) => rest);
}

// Category name -> PlantCategory, derived from the enum's own member names
// ('TallFlower' -> 'tall-flower'), independently of the generator's table
const CATEGORY_BY_NAME = new Map(
  Object.keys(PlantCategory)
    .filter((key) => Number.isNaN(Number(key)))
    .map((key) => [
      key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
      PlantCategory[key as keyof typeof PlantCategory],
    ])
);

const GARDEN_RUNS = { numRuns: 200 };
/** For properties that grow two gardens per run */
const GARDEN_PAIR_RUNS = { numRuns: 100 };

/**
 * The first plant breaking a per-plant rule, or undefined. Gardens hold up
 * to 30,000 plants, so each run makes one assertion, not one per plant.
 */
const firstViolation = <T,>(items: readonly T[], ok: (item: T, i: number) => boolean) =>
  items.find((item, i) => !ok(item, i));

/** Fast exact comparison of two gardens; falls back to toEqual for the diff */
function expectSameGardens(actual: readonly object[], expected: readonly object[]): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) expect(actual).toEqual(expected);
}

describe('Property: generated gardens over the full config domain', () => {
  muteWarnings();

  it('the same options produce an identical garden', () => {
    fc.assert(
      fc.property(gardenConfigArb, (config) => {
        const a = growGarden(config).plants;
        const b = growGarden(config).plants;
        expect(b).toHaveLength(a.length);
        expectSameGardens(b, a);
      }),
      GARDEN_PAIR_RUNS
    );
  });

  it('every plant draws within maxHeight', () => {
    // Renderers draw maxHeight x the type's heightMultiplier
    const drawn = (p: PlantData) => p.maxHeight * getPlantVariation(p.type).heightMultiplier;
    fc.assert(
      fc.property(gardenConfigArb, (config) => {
        const { resolved, plants } = growGarden(config);
        const tallest = firstViolation(plants, (p) => drawn(p) <= resolved.maxHeight);
        expect(tallest && `${tallest.type} draws ${drawn(tallest)} > ${resolved.maxHeight}`).toBeUndefined();
      }),
      {
        ...GARDEN_RUNS,
        // Production finding (1-ulp overshoot): bamboo-tall draws 0.7244963369963375
        examples: [
          [
            {
              seed: 0,
              density: 'dense',
              generations: 1,
              duration: 1,
              maxHeight: 0.7244963369963374,
              timingCurve: 0,
              categories: undefined,
              colors: { palette: 'natural', accentWeight: 0 },
            },
          ],
        ],
      }
    );
  });

  it('every generation holds a plant count within its density range', () => {
    fc.assert(
      fc.property(gardenConfigArb, (config) => {
        const { resolved, plants } = growGarden(config);
        const [min, max] = PLANTS_PER_GENERATION[resolved.density];
        const perGeneration = new Array<number>(resolved.generations).fill(0);
        const stray = firstViolation(
          plants,
          (p) => Number.isInteger(p.generation) && p.generation >= 0 && p.generation < resolved.generations
        );
        expect(stray?.generation).toBeUndefined();
        for (const p of plants) perGeneration[p.generation]++;
        const g = perGeneration.findIndex((count) => count < min || count > max);
        expect(g < 0 ? undefined : `generation ${g}: ${perGeneration[g]} plants`).toBeUndefined();
      }),
      GARDEN_RUNS
    );
  });

  it('generation g ends when every plant up to g has grown, capped at the duration', () => {
    fc.assert(
      fc.property(gardenConfigArb, (config) => {
        const { resolved, plants } = growGarden(config);
        const { generations, duration } = resolved;
        // From the definition: the latest end among all plants of generations
        // <= g (bucketed by generation, then accumulated), capped at the duration
        const latestOf = new Array<number>(generations).fill(0);
        for (const p of plants) latestOf[p.generation] = Math.max(latestOf[p.generation], p.delay + p.growDuration);
        const expected = latestOf.map((_, g) => Math.min(duration, Math.max(...latestOf.slice(0, g + 1))));
        expect(getGenerationEndTimes(plants, generations, duration)).toEqual(expected);
      }),
      GARDEN_RUNS
    );
  });

  it('growDuration never falls below the floor of 100ms or 1% of the duration', () => {
    fc.assert(
      fc.property(gardenConfigArb, (config) => {
        const { resolved, plants } = growGarden(config);
        const floor = Math.max(0.1, resolved.duration * 0.01);
        expect(firstViolation(plants, (p) => p.growDuration >= floor)?.growDuration).toBeUndefined();
      }),
      GARDEN_RUNS
    );
  });

  it('every plant starts and finishes within the duration', () => {
    fc.assert(
      fc.property(gardenConfigArb, (config) => {
        const { resolved, plants } = growGarden(config);
        const { duration } = resolved;
        const late = firstViolation(
          plants,
          (p) => p.delay >= 0 && p.delay < duration && p.delay + p.growDuration <= duration
        );
        expect(late && `delay ${late.delay} + ${late.growDuration} vs ${duration}`).toBeUndefined();
      }),
      {
        ...GARDEN_RUNS,
        // Production finding (1-ulp overshoot): ends at 476.6014207964744
        examples: [
          [
            {
              seed: 0,
              density: 'sparse',
              generations: 1,
              duration: 476.6014207964743,
              maxHeight: 0.05,
              timingCurve: 0,
              categories: undefined,
              colors: { palette: 'natural', accentWeight: 0 },
            },
          ],
        ],
      }
    );
  });

  it('plants are sorted tallest-first, so shorter plants draw in front', () => {
    fc.assert(
      fc.property(gardenConfigArb, (config) => {
        const { plants } = growGarden(config);
        const i = plants.findIndex((p, k) => k > 0 && p.maxHeight > plants[k - 1].maxHeight);
        expect(i < 0 ? undefined : `plant ${i} is taller than plant ${i - 1}`).toBeUndefined();
      }),
      GARDEN_RUNS
    );
  });

  it('no two plants share a random stream', () => {
    // Each plant draws up to MAX_RNG_DRAWS_PER_PLANT values from consecutive
    // seeds, so per-plant seeds must be at least that far apart
    fc.assert(
      fc.property(gardenConfigArb, (config) => {
        const seeds = growGarden(config)
          .plants.map((p) => p.seed)
          .sort((a, b) => a - b);
        const i = seeds.findIndex((seed, k) => k > 0 && seed - seeds[k - 1] < MAX_RNG_DRAWS_PER_PLANT);
        expect(i < 0 ? undefined : `seeds ${seeds[i - 1]} and ${seeds[i]}`).toBeUndefined();
      }),
      GARDEN_RUNS
    );
  });

  it('the category reference covers exactly the public category names', () => {
    expect([...CATEGORY_BY_NAME.keys()].sort()).toEqual([...PLANT_CATEGORIES].sort());
  });

  it('a category filter grows only the categories it names', () => {
    fc.assert(
      fc.property(gardenConfigArb, (config) => {
        const selected = new Set(
          (config.categories ?? [])
            .map((name) => CATEGORY_BY_NAME.get(name.toLowerCase()))
            .filter((c): c is PlantCategory => c !== undefined)
        );
        // No known name selected means no filter: there is nothing to check
        if (selected.size === 0) return;
        const { plants } = growGarden(config);
        const stray = firstViolation(plants, (p) => p.category !== undefined && selected.has(p.category));
        expect(stray && `${stray.type} (category ${stray.category})`).toBeUndefined();
      }),
      GARDEN_RUNS
    );
  });

  it('the timing curve changes plant timings and nothing else', () => {
    fc.assert(
      fc.property(gardenConfigArb, timingCurveArb, (config, otherCurve) => {
        const a = growGarden(config).plants;
        const b = growGarden({ ...config, timingCurve: otherCurve }).plants;
        expectSameGardens(withoutTimings(b), withoutTimings(a));
      }),
      GARDEN_PAIR_RUNS
    );
  });

  it('scaling the duration scales plant timings and changes nothing else', () => {
    // Above 10s the 1% term of the grow-duration floor dominates its 100ms
    // term, so every timing is proportional to the duration. The timings are
    // short chains of rounded multiplications and additions of values up to
    // the duration, so they scale to within a few ulps of the duration
    // (1e-12 relative is ~4500 ulps of headroom), not exactly.
    const scaledDuration = fc.double({ min: 10, max: 86400, noNaN: true });
    fc.assert(
      fc.property(gardenConfigArb, scaledDuration, scaledDuration, (config, d1, d2) => {
        const a = growGarden({ ...config, duration: d1 }).plants;
        const b = growGarden({ ...config, duration: d2 }).plants;
        expectSameGardens(withoutTimings(b), withoutTimings(a));
        const k = d2 / d1;
        const tolerance = 1e-12 * d2;
        const off = firstViolation(
          b,
          (p, i) =>
            Math.abs(p.delay - a[i].delay * k) <= tolerance &&
            Math.abs(p.growDuration - a[i].growDuration * k) <= tolerance
        );
        expect(off && `plant ${off.id}: ${off.delay}/${off.growDuration}`).toBeUndefined();
      }),
      GARDEN_PAIR_RUNS
    );
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

  it('detects the jsdom environment as a browser', () => {
    const env = Environment.detect();
    expect(env.isBrowser).toBe(true);
    expect(env.pixelRatio).toBe(window.devicePixelRatio || 1);
    expect(env.prefersReducedMotion).toBe(false); // matchMedia mock: no match
  });

  it('onReducedMotionChange forwards changes, invalidates the cache, and unsubscribes', () => {
    let registered: ((e: { matches: boolean }) => void) | null = null;
    const removeEventListener = vi.fn();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_: string, h: (e: { matches: boolean }) => void) => {
        registered = h;
      },
      removeEventListener,
    }));

    const cached = Environment.detect();
    const seen: boolean[] = [];
    const cleanup = Environment.onReducedMotionChange((reduced) => seen.push(reduced));

    registered!({ matches: true });
    expect(seen).toEqual([true]);
    expect(Environment.detect()).not.toBe(cached); // cache invalidated

    cleanup();
    expect(removeEventListener).toHaveBeenCalledWith('change', registered);
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

  it('isSupported is the conjunction of browser, canvas and rAF support', () => {
    const env = Environment.detect();
    expect(Environment.isSupported()).toBe(env.isBrowser && env.hasCanvas && env.hasRAF);
  });

  it('getRecommendedSettings should return valid settings', () => {
    const settings = Environment.getRecommendedSettings();

    expect(typeof settings.maxPixelRatio).toBe('number');
    expect(typeof settings.targetFPS).toBe('number');
    expect(['sparse', 'normal', 'dense']).toContain(settings.density);

    expect(settings.maxPixelRatio).toBeGreaterThan(0);
    expect(settings.targetFPS).toBeGreaterThan(0);
  });

  it('isPageVisible follows document.hidden', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get');
    hidden.mockReturnValue(true);
    expect(Environment.isPageVisible()).toBe(false);
    hidden.mockReturnValue(false);
    expect(Environment.isPageVisible()).toBe(true);
    hidden.mockRestore();
  });

  it('media preferences follow their media queries, queried fresh each time', () => {
    let matching = '';
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes(matching) && matching !== '',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(Environment.prefersReducedMotion()).toBe(false);
    expect(Environment.prefersDarkMode()).toBe(false);
    matching = 'prefers-reduced-motion';
    expect(Environment.prefersReducedMotion()).toBe(true);
    expect(Environment.prefersDarkMode()).toBe(false);
    matching = 'prefers-color-scheme: dark';
    expect(Environment.prefersDarkMode()).toBe(true);
    expect(Environment.prefersReducedMotion()).toBe(false);
  });
});

describe('Constraint: Category validation warnings', () => {
  it('should warn on invalid category name in dev mode', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // parseCategoryFilter is called within generatePlants, not resolveOptions
      const resolved = resolveOptions({
        container: document.createElement('div'),
        seed: 7,
        categories: ['invalid-category-name', 'rose'],
      });

      // Call generatePlants which triggers the validation
      generatePlants(resolved);

      // Should have warned about the invalid category
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown category')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('invalid-category-name')
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('should accept valid category names without warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const resolved = resolveOptions({
        container: document.createElement('div'),
        seed: 7,
        categories: ['rose', 'tulip', 'daisy', 'grass'],
      });

      // Call generatePlants which triggers the validation
      generatePlants(resolved);

      // Should not have warned for valid categories
      const categoryWarnings = warnSpy.mock.calls.filter(
        (call) => call[0]?.includes?.('Unknown category')
      );
      expect(categoryWarnings.length).toBe(0);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

// ==================== CONFIGURATION CONSTRUCTIBILITY ====================
// Every shipped theme/preset must produce options that survive the full
// resolve -> generate pipeline. Guards against undefined-clobbering merges.

describe('Constraint: every built-in theme and preset is constructible', () => {
  it('generates plants for every theme', () => {
    for (const name of Object.keys(themes)) {
      const container = document.createElement('div');
      const themed = applyTheme(name, { container, seed: 42, generations: 5 });
      const resolved = resolveOptions(themed as never);
      const plants = generatePlants(resolved);
      expect(plants.length, `theme "${name}"`).toBeGreaterThan(0);
    }
  });

  it('generates plants for every preset', () => {
    for (const name of Object.keys(presets)) {
      const container = document.createElement('div');
      const preset = applyPreset(name, { container, seed: 42 });
      const resolved = resolveOptions(preset as never);
      const plants = generatePlants(resolved);
      expect(plants.length, `preset "${name}"`).toBeGreaterThan(0);
    }
  });

  it('generates plants for every preset x theme combination', () => {
    for (const presetName of Object.keys(presets)) {
      for (const themeName of Object.keys(themes)) {
        const container = document.createElement('div');
        const combined = createConfig(presetName, themeName, { container, seed: 42 });
        const resolved = resolveOptions(combined as never);
        const plants = generatePlants(resolved);
        expect(plants.length, `${presetName} + ${themeName}`).toBeGreaterThan(0);
      }
    }
  });

  it('treats explicit undefined color fields like absent fields', () => {
    const resolved = resolveOptions({
      container: document.createElement('div'),
      seed: 42,
      colors: {
        accent: undefined,
        flowerColors: undefined,
        foliageColors: undefined,
        palette: undefined,
        accentWeight: undefined,
      },
    });

    expect(resolved.colors.flowerColors).toEqual([]);
    expect(resolved.colors.foliageColors).toEqual([]);
    expect(typeof resolved.colors.accent).toBe('string');
    expect(() => generatePlants(resolved)).not.toThrow();
  });

  it('createTheme output without optional fields is constructible', () => {
    const minimal = applyTheme(
      { name: 'Minimal', palette: 'cool' },
      { container: document.createElement('div'), seed: 7 }
    );
    const resolved = resolveOptions(minimal as never);
    expect(() => generatePlants(resolved)).not.toThrow();
  });
});

// ==================== SEED UNIQUENESS ====================

describe('Constraint: plant seeds are unique within a garden', () => {
  // Per-plant seed uniqueness (no shared random stream) is a property over all
  // configs in 'Property: generated gardens over the full config domain'.
  // This pins the observable symptom of the old stride bug.
  it('does not place visually identical plants at the same x position', () => {
    const resolved = resolveOptions({
      container: document.createElement('div'),
      seed: 42,
      generations: 10,
      duration: 60,
      density: 'lush',
    });
    const plants = generatePlants(resolved);
    const signatures = new Set(plants.map((p) => `${p.x}:${p.type}:${p.flowerColor}`));
    expect(signatures.size).toBe(plants.length);
  });
});

describe('Exhaustive: every plant type can be grown through its category', () => {
  // A PlantType missing from the generator's category registry is never
  // generated, and the renderer silently treats it as a SimpleFlower; the
  // enum-driven render sweep and the doc counts cannot see that. Grow a large
  // garden per public category name and check what actually comes out.
  const cache = new Map<string, ReturnType<typeof generatePlants>>();
  const grow = (name: string) => {
    if (!cache.has(name)) {
      cache.set(
        name,
        generatePlants(
          resolveOptions({
            container: document.createElement('div'),
            seed: 7,
            generations: 40,
            density: 'lush',
            maxHeight: 1,
            categories: [name],
          })
        )
      );
    }
    return cache.get(name)!;
  };
  const grownBy = () => new Map(PLANT_CATEGORIES.map((name) => [name, grow(name)] as const));

  it.each([...PLANT_CATEGORIES])('category "%s" grows only plants of one category', (name) => {
    const plants = grow(name);
    expect(plants.length).toBeGreaterThan(0);
    expect(new Set(plants.map((p) => p.category)).size).toBe(1);
  });

  // Names must select the category they name, not merely some category.
  // Most category names are also the name of their base plant type; the rest
  // get one botanical representative each.
  const representative: Record<string, string> = {
    herb: PlantType.Lavender,
    specialty: PlantType.Sunflower,
    'tall-flower': PlantType.Hollyhock,
    'giant-grass': PlantType.Bamboo,
    climber: PlantType.Vine,
    'small-tree': PlantType.SaplingOak,
    tropical: PlantType.PalmSmall,
    conifer: PlantType.Pine,
  };
  const typeValues = new Set<string>(Object.values(PlantType));
  it.each([...PLANT_CATEGORIES])('category "%s" grows the plant it is named for', (name) => {
    const expected = typeValues.has(name) ? name : representative[name];
    expect(expected, `no representative plant type for "${name}"`).toBeDefined();
    expect(grow(name).map((p) => p.type)).toContain(expected);
  });

  it('distinct category names grow disjoint sets of plant types', () => {
    const owner = new Map<string, string>();
    for (const [name, plants] of grownBy()) {
      for (const { type } of plants) {
        const previous = owner.get(type);
        expect(previous === undefined || previous === name, `${type}: ${previous} and ${name}`).toBe(
          true
        );
        owner.set(type, name);
      }
    }
  });

  it('every PlantType is grown by some category filter', () => {
    const grown = new Set([...grownBy().values()].flatMap((plants) => plants.map((p) => p.type)));
    const neverGrown = Object.values(PlantType).filter((type) => !grown.has(type));
    expect(neverGrown).toEqual([]);
  });
});

// ==================== PALETTE REACHABILITY ====================

describe('Constraint: every palette color is reachable', () => {
  it('includes all base palette colors at moderate accent weights', () => {
    for (const palette of ['natural', 'warm', 'cool', 'vibrant'] as const) {
      for (const accentWeight of [0, 0.2, 0.4, 0.6]) {
        const colors = buildFlowerColors({
          accent: '#F6821F',
          palette,
          flowerColors: [],
          foliageColors: [],
          accentWeight,
        });
        for (const base of flowerPalettes[palette]) {
          expect(colors, `${palette} @ ${accentWeight} missing ${base}`).toContain(base);
        }
      }
    }
  });

  it('keeps the accent proportion close to accentWeight', () => {
    const accent = '#F6821F';
    for (const accentWeight of [0.2, 0.4, 0.6]) {
      const colors = buildFlowerColors({
        accent,
        palette: 'natural',
        flowerColors: [],
        foliageColors: [],
        accentWeight,
      });
      const baseSet = new Set(flowerPalettes.natural);
      const accentCount = colors.filter((c) => !baseSet.has(c)).length;
      expect(Math.abs(accentCount / colors.length - accentWeight)).toBeLessThan(0.15);
    }
  });
});

// ==================== COLOR UTILITY PARITY ====================

describe('Constraint: hex parsing behaves identically across entry points', () => {
  it('utils.hexToRgb and Color.hexToRgb agree on 3/6/8-digit and invalid input', () => {
    const cases = ['#fff', '#ffffff', '#F6821F', '#11223344', 'fff', '#xyz', '', '#12'];
    for (const hex of cases) {
      expect(utilsHexToRgb(hex), `input "${hex}"`).toEqual(colorHexToRgb(hex));
    }
  });

  it('parses 3-digit hex', () => {
    expect(utilsHexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });
});

// ==================== EXHAUSTIVE CONFIG LATTICE ====================
// densities x palettes x maxHeights is a small bounded space — test all of
// it rather than sampling. (Climbers hid a rendering bug for several
// releases because no default config ever reached maxHeight >= 0.5.)

describe('Exhaustive: config lattice is constructible end-to-end', () => {
  const densities = ['sparse', 'normal', 'dense', 'lush'] as const;
  const palettes = ['natural', 'warm', 'cool', 'grayscale', 'vibrant', 'monotone'] as const;
  const maxHeights = [0.05, 0.35, 0.7, 1.0] as const;

  it('every density x palette combination generates plants', () => {
    for (const density of densities) {
      for (const palette of palettes) {
        const resolved = resolveOptions({
          container: document.createElement('div'),
          seed: 42,
          generations: 5,
          density,
          colors: { palette },
        });
        const plants = generatePlants(resolved);
        expect(plants.length, `${density} x ${palette}`).toBeGreaterThan(0);
      }
    }
  });

  it('every density x maxHeight combination generates plants', () => {
    for (const density of densities) {
      for (const maxHeight of maxHeights) {
        const resolved = resolveOptions({
          container: document.createElement('div'),
          seed: 42,
          generations: 5,
          density,
          maxHeight,
        });
        const plants = generatePlants(resolved);
        expect(plants.length, `${density} x maxHeight ${maxHeight}`).toBeGreaterThan(0);
      }
    }
  });
});

// ==================== OPTION CONTRACT PROPERTIES ====================
// resolveOptions is the trust boundary for all user input. For ANY shape of
// partial options, each option must resolve exactly as documented: a valid
// value passes through (numbers clamped into range), anything else falls back
// to the documented default. One property per option contract; each draws
// the whole fuzzy options object, so no option can leak into another.

/** Clamp written as the documented range check, not as min/max calls */
const clampTo = (v: number, [lo, hi]: readonly [number, number]) => (v < lo ? lo : v > hi ? hi : v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Every double (NaN, infinities and -0 included), plus dense draws in and around the range */
const fuzzyNumberNear = ([lo, hi]: readonly [number, number]) =>
  fc.oneof(
    fc.double(),
    fc.integer(),
    fc.double({ min: lo, max: hi, noNaN: true }),
    fc.double({ min: lo - (hi - lo), max: hi + (hi - lo), noNaN: true }),
    fc.constantFrom(NaN, Infinity, -Infinity, lo, hi),
    fc.constantFrom(undefined, null, true, '5', '')
  );
type FuzzyOptions = Record<string, unknown>;
const fuzzyColorsArb = fc.record(
  {
    accent: fc.oneof(fc.constantFrom('#F6821F', '#fff'), fc.string(), fc.constant(undefined)),
    palette: fc.oneof(fc.constantFrom(...DOCUMENTED_PALETTES), fc.string(), fc.anything()),
    flowerColors: fc.oneof(fc.array(fc.constantFrom('#ff0000', '#00ff00')), fc.anything()),
    foliageColors: fc.oneof(fc.array(fc.constantFrom('#112233', '#445566')), fc.anything()),
    accentWeight: fuzzyNumberNear([0, 1]),
  },
  { requiredKeys: [] }
);
const fuzzyOptionsArb: fc.Arbitrary<FuzzyOptions> = fc.record(
  {
    ...Object.fromEntries(NUMERIC_KEYS.map((key) => [key, fuzzyNumberNear(DOCUMENTED_RANGE[key])])),
    seed: fc.oneof(fuzzyNumberNear([0, DOCUMENTED_SEED_RANGE]), fc.maxSafeInteger()),
    density: fc.oneof(fc.constantFrom(...DOCUMENTED_DENSITIES), fc.string(), fc.anything()),
    timingCurve: fc.oneof(fc.constantFrom(...DOCUMENTED_CURVES), fc.double(), fc.string(), fc.anything()),
    categories: fc.oneof(
      fc.array(fc.mixedCase(fc.constantFrom(...PLANT_CATEGORIES))),
      fc.array(fc.string()),
      fc.array(fc.anything()),
      fc.anything()
    ),
    colors: fc.oneof(fuzzyColorsArb, fc.anything()),
  },
  { requiredKeys: [] }
);
const resolveFuzzy = (options: FuzzyOptions) =>
  resolveOptions({ container: document.createElement('div'), ...options } as never);
/** The colors object as resolveOptions sees it (non-objects are ignored) */
const fuzzyColorsOf = (options: FuzzyOptions): Record<string, unknown> =>
  typeof options.colors === 'object' && options.colors !== null
    ? (options.colors as Record<string, unknown>)
    : {};

/** Exact `v mod 1e9` in [0, 1e9): BigInt for the integer part, then one rounding */
function wrapSeedReference(v: number): number {
  const range = BigInt(DOCUMENTED_SEED_RANGE);
  const whole = Math.trunc(v);
  const fraction = v - whole; // exact
  let wrapped = Number(((BigInt(whole) % range) + range) % range);
  if (fraction < 0 && wrapped === 0) wrapped = DOCUMENTED_SEED_RANGE;
  const result = wrapped + fraction; // the one rounding step
  // A true value within half an ulp below 1e9 rounds to the range end, which wraps to 0
  return result === DOCUMENTED_SEED_RANGE ? 0 : result;
}

const OPTION_RUNS = { numRuns: 1000 };

describe('Property: resolveOptions follows the documented option contract', () => {
  muteWarnings();

  it.each(NUMERIC_KEYS)('%s: finite numbers clamp into range, anything else is the default', (key) => {
    const range = DOCUMENTED_RANGE[key];
    const [lo, hi] = range;
    fc.assert(
      fc.property(fuzzyOptionsArb, (options) => {
        const v = options[key];
        const expected = isFiniteNumber(v) ? clampTo(v, range) : DOCUMENTED_DEFAULT[key];
        const actual = resolveFuzzy(options)[key];
        // === rather than toBe: -0 and 0 are the same option value
        expect(actual === expected, `${key}: ${String(v)} -> ${actual}, expected ${expected}`).toBe(true);
      }),
      {
        ...OPTION_RUNS,
        // Regressions: non-finite values once resolved to 0 or leaked through
        examples: [NaN, Infinity, -Infinity, lo, hi, lo - 1000, hi + 1000].map((v): [FuzzyOptions] => [{ [key]: v }]),
      }
    );
  });

  it('colors.accentWeight: finite numbers clamp into [0, 1], anything else is 0.4', () => {
    fc.assert(
      fc.property(fuzzyOptionsArb, (options) => {
        const v = fuzzyColorsOf(options).accentWeight;
        const expected = isFiniteNumber(v) ? clampTo(v, [0, 1]) : DOCUMENTED_ACCENT_WEIGHT;
        const actual = resolveFuzzy(options).colors.accentWeight;
        expect(actual === expected, `${String(v)} -> ${actual}, expected ${expected}`).toBe(true);
      }),
      {
        ...OPTION_RUNS,
        // Regressions: out-of-range weights were once passed through unclamped
        examples: [[{ colors: { accentWeight: 5 } }], [{ colors: { accentWeight: -1 } }], [{ colors: { accentWeight: NaN } }]],
      }
    );
  });

  it('a finite seed wraps to exactly seed mod 1e9', () => {
    const finiteSeed = fc.oneof(
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.integer({ min: -3 * DOCUMENTED_SEED_RANGE, max: 3 * DOCUMENTED_SEED_RANGE }),
      fc.maxSafeInteger()
    );
    fc.assert(
      fc.property(finiteSeed, (seed) => {
        const actual = resolveFuzzy({ seed }).seed;
        expect(actual).toBeGreaterThanOrEqual(0);
        expect(actual).toBeLessThan(DOCUMENTED_SEED_RANGE);
        expect(actual).toBe(wrapSeedReference(seed));
      }),
      {
        ...OPTION_RUNS,
        examples: [
          [-1],
          [-5],
          [-6],
          [0],
          [DOCUMENTED_SEED_RANGE + 5],
          // Production finding: in-range fractional seeds are changed
          // (0.3 -> 0.2999999523162842, 5e-324 -> 0)
          [0.3],
          [5e-324],
        ],
      }
    );
  });

  it('seeds that differ by a multiple of 1e9 give the same seed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -3 * DOCUMENTED_SEED_RANGE, max: 3 * DOCUMENTED_SEED_RANGE }),
        fc.integer({ min: -1000, max: 1000 }),
        (seed, k) => {
          expect(resolveFuzzy({ seed: seed + k * DOCUMENTED_SEED_RANGE }).seed).toBe(
            resolveFuzzy({ seed }).seed
          );
        }
      ),
      // Regression: the README's own example, -1 and 999999999
      { ...OPTION_RUNS, examples: [[-1, 1]] }
    );
  });

  it('a missing, non-finite or non-numeric seed becomes a random seed in [0, 1e9)', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constantFrom(undefined, null, NaN, Infinity, -Infinity, true, '42'), fc.string(), fc.anything()),
        (seed) => {
          fc.pre(!isFiniteNumber(seed));
          const actual = resolveFuzzy({ seed }).seed;
          expect(Number.isFinite(actual)).toBe(true);
          expect(actual).toBeGreaterThanOrEqual(0);
          expect(actual).toBeLessThan(DOCUMENTED_SEED_RANGE);
        }
      ),
      OPTION_RUNS
    );
  });

  it('density: a documented name passes through, anything else is normal', () => {
    fc.assert(
      fc.property(fuzzyOptionsArb, (options) => {
        const v = options.density;
        const expected = (DOCUMENTED_DENSITIES as readonly unknown[]).includes(v) ? v : 'normal';
        expect(resolveFuzzy(options).density).toBe(expected);
      }),
      { ...OPTION_RUNS, examples: [[{ density: 'enormous' }], [{ density: 'Lush' }]] }
    );
  });

  it('colors.palette: a documented name passes through, anything else is natural', () => {
    fc.assert(
      fc.property(fuzzyOptionsArb, (options) => {
        const v = fuzzyColorsOf(options).palette;
        const expected = (DOCUMENTED_PALETTES as readonly unknown[]).includes(v) ? v : 'natural';
        expect(resolveFuzzy(options).colors.palette).toBe(expected);
      }),
      { ...OPTION_RUNS, examples: [[{ colors: { palette: 'rainbow' } }]] }
    );
  });

  it('timingCurve: a documented name or finite number passes through, anything else is linear', () => {
    fc.assert(
      fc.property(fuzzyOptionsArb, (options) => {
        const v = options.timingCurve;
        const valid = (DOCUMENTED_CURVES as readonly unknown[]).includes(v) || isFiniteNumber(v);
        expect(resolveFuzzy(options).timingCurve).toBe(valid ? v : 'linear');
      }),
      {
        ...OPTION_RUNS,
        examples: [
          [{ timingCurve: NaN }],
          [{ timingCurve: Infinity }],
          // Production finding: unknown strings pass through unresolved
          [{ timingCurve: '' }],
          [{ timingCurve: 'bogus' }],
        ],
      }
    );
  });

  it('categories: an array of names passes through, anything else is null (no filter)', () => {
    // Only arrays of strings have a documented resolved value; arrays holding
    // other values are covered by the totality property below
    fc.assert(
      fc.property(fuzzyOptionsArb, (options) => {
        const v = options.categories;
        const resolved = resolveFuzzy(options).categories;
        if (Array.isArray(v)) {
          if (v.every((name) => typeof name === 'string')) expect(resolved).toEqual(v);
        } else {
          expect(resolved).toBeNull();
        }
      }),
      { ...OPTION_RUNS, examples: [[{ categories: 'rose' }], [{ categories: null }]] }
    );
  });

  it('custom color lists: the string entries of an array pass through, anything else is empty', () => {
    fc.assert(
      fc.property(fuzzyOptionsArb, (options) => {
        const colors = fuzzyColorsOf(options);
        const resolved = resolveFuzzy(options).colors;
        for (const key of ['flowerColors', 'foliageColors'] as const) {
          const v = colors[key];
          const expected = Array.isArray(v) ? v.filter((c: unknown) => typeof c === 'string') : [];
          expect(resolved[key], key).toEqual(expected);
        }
      }),
      // Regression: a non-string entry crashed palette building (hex.replace)
      { ...OPTION_RUNS, examples: [[{ colors: { foliageColors: [{}] } }]] }
    );
  });

  it('never throws, and the resolved configuration always generates plants', () => {
    fc.assert(
      fc.property(fuzzyOptionsArb, (options) => {
        const plants = generatePlants(resolveFuzzy(options));
        expect(plants.length).toBeGreaterThan(0);
      }),
      // Production finding: a non-string category name throws a TypeError
      { numRuns: 300, examples: [[{ categories: [0] }]] }
    );
  });

  it('is idempotent: resolving a resolved configuration changes nothing', () => {
    fc.assert(
      fc.property(fuzzyOptionsArb, (options) => {
        const once = resolveFuzzy(options);
        expect(resolveOptions(once as never)).toEqual(once);
      }),
      // Production finding: a wrapped fractional seed wraps again to a new value
      { ...OPTION_RUNS, examples: [[{ seed: -0.000001966953277587891 }]] }
    );
  });
});

// ==================== CONFIG MERGE HARDENING ====================

describe('Constraint: partial-config merges ignore explicit undefined', () => {
  it('GrowthProgress with undefined config fields matches the default config', () => {
    const withUndefined = GrowthProgress.fromProgress(0.6, {
      leafStart: undefined,
      flowerStart: undefined,
    });
    const plain = GrowthProgress.fromProgress(0.6);

    expect(Number.isFinite(withUndefined.leaf)).toBe(true);
    expect(Number.isFinite(withUndefined.flower)).toBe(true);
    expect(withUndefined.equals(plain)).toBe(true);
  });

  it('GrowthProgressPool sanitizes non-finite numeric config', () => {
    const pool = new GrowthProgressPool({
      devMode: true,
      initialSize: NaN,
      growthFactor: Infinity,
      maxSize: NaN,
    });
    pool.beginFrame();
    expect(() => {
      for (let i = 0; i < 10; i++) pool.acquireAndCalculate(1, 0, 1);
    }).not.toThrow();
    pool.endFrame();
    expect(pool.getStats().poolSize).toBeGreaterThan(0);
  });
});

// ==================== GENERATION BOUNDARY MATH ====================

describe('Constraint: generation boundaries come from the plants themselves', () => {
  // The end times of real gardens, for every config, are a property in
  // 'Property: generated gardens over the full config domain'
  it('a later generation never completes before an earlier one', () => {
    // Generation 0 has a slow plant that outlasts all of generation 1
    const plants = [
      { generation: 0, delay: 0, growDuration: 9 },
      { generation: 1, delay: 2, growDuration: 3 },
      { generation: 2, delay: 6, growDuration: 4 },
    ] as PlantData[];
    expect(getGenerationEndTimes(plants, 3, 10)).toEqual([9, 9, 10]);
    // Overshoot from floating-point error is clamped to the duration
    expect(getGenerationEndTimes(plants, 3, 9.5)).toEqual([9, 9, 9.5]);
  });

  it('counts exactly the generations whose end time has passed', () => {
    // Every time (negative, zero, NaN, infinite) against any ascending end
    // times: nothing has completed at or before time 0, or at no time (NaN)
    const endsArb = fc
      .array(fc.double({ min: 0, noNaN: true }), { maxLength: 50 })
      .map((raw) => [...raw].sort((x, y) => x - y));
    fc.assert(
      fc.property(fc.double(), endsArb, (time, ends) => {
        const expected = Number.isNaN(time) || time <= 0 ? 0 : ends.filter((e) => e <= time).length;
        expect(getCompletedGenerations(time, ends)).toBe(expected);
      }),
      {
        numRuns: 2000,
        examples: [
          // Boundaries and a shared end time
          ...[0, 0.999, 1, 2.5, 9.99, 10, 250].map((t) => [t, [1, 2.5, 2.5, 7, 10]] as [number, number[]]),
          [NaN, [1, 2]],
          [-5, [1, 2]],
          [5, []],
          // Production finding: an infinite time counts no generations as complete
          [Infinity, [0]],
        ],
      }
    );
  });

  it('no generations means no end times', () => {
    expect(getGenerationEndTimes([], 0, 10)).toEqual([]);
  });
});

// ==================== DEFAULT VALUES ====================
// Mutation testing showed nothing pinned the actual default values — a
// mutant flipping `loop: false` to `true` survived the entire suite.
// These are the documented defaults from the README options tables.

describe('Constraint: resolved defaults match the documented values', () => {
  it('every option resolves to its documented default', () => {
    const resolved = resolveOptions({ container: document.createElement('div') });

    for (const key of NUMERIC_KEYS) expect(resolved[key], key).toBe(DOCUMENTED_DEFAULT[key]);
    expect(resolved.density).toBe('normal');
    expect(resolved.categories).toBeNull();
    expect(resolved.loop).toBe(false);
    expect(resolved.autoplay).toBe(true);
    expect(resolved.respectReducedMotion).toBe(true);
    expect(resolved.timingCurve).toBe('linear');
    expect(resolved.background).toBe('transparent');
    expect(resolved.fadeColor).toBe('#ffffff');
    expect(resolved.colors.accent).toBe('#F6821F');
    expect(resolved.colors.palette).toBe('natural');
    expect(resolved.colors.flowerColors).toEqual([]);
    expect(resolved.colors.foliageColors).toEqual([]);
    expect(resolved.colors.accentWeight).toBe(DOCUMENTED_ACCENT_WEIGHT);
  });
});

// ==================== BOUNDS TABLE ====================
// The code's bounds table must match the documented ranges. How each option
// resolves against those ranges (both bounds, just outside, non-finite) is
// 'Property: resolveOptions follows the documented option contract'.

describe('Exhaustive: the bounds table matches the documented ranges', () => {
  const cases = [
    ['duration', OPTION_BOUNDS.DURATION],
    ['generations', OPTION_BOUNDS.GENERATIONS],
    ['maxHeight', OPTION_BOUNDS.MAX_HEIGHT],
    ['speed', OPTION_BOUNDS.SPEED],
    ['maxPixelRatio', OPTION_BOUNDS.MAX_PIXEL_RATIO],
    ['targetFPS', OPTION_BOUNDS.TARGET_FPS],
    ['opacity', OPTION_BOUNDS.OPACITY],
    ['fadeHeight', OPTION_BOUNDS.FADE_HEIGHT],
    ['zIndex', OPTION_BOUNDS.Z_INDEX],
  ] as const;

  it.each(cases)('%s bounds match the documented range', (key, { min, max }) => {
    expect([min, max]).toEqual(DOCUMENTED_RANGE[key]);
  });

  it('the seed range matches the documented one', () => {
    expect([OPTION_BOUNDS.SEED.min, OPTION_BOUNDS.SEED.max]).toEqual([0, DOCUMENTED_SEED_RANGE]);
  });
});

// ==================== PLANT COUNTS AND HEIGHTS ====================

describe('Constraint: plants per generation span the density range', () => {
  // That every count stays inside the range is a property over all configs
  // ('Property: generated gardens over the full config domain'). That both
  // ends are actually reached is an existence claim, which a for-all
  // property cannot state, so it stays a fixed witness: 200 generations
  // from five seeds.
  it.each(DOCUMENTED_DENSITIES)('%s reaches both ends of its range', (density) => {
    const [min, max] = PLANTS_PER_GENERATION[density];
    const counts = new Map<number, number>();
    for (const seed of [1, 2, 3, 4, 5]) {
      const plants = generatePlants(
        resolveOptions({ container: document.createElement('div'), seed, density, generations: 40 })
      );
      const perGen = new Array(40).fill(0);
      for (const p of plants) perGen[p.generation]++;
      for (const n of perGen) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const seen = [...counts.keys()];
    expect(Math.min(...seen)).toBe(min);
    expect(Math.max(...seen)).toBe(max); // the top of the range is reachable
  });
});

describe('Constraint: a seed pins the same garden on every engine', () => {
  // Golden fingerprint of generatePlants for seed 42. Changing it means
  // every user's seeded garden changes: note it in the CHANGELOG.
  it('seed 42 produces the pinned garden', () => {
    const plants = generatePlants(
      resolveOptions({ container: document.createElement('div'), seed: 42, generations: 8 })
    );
    const fingerprint = plants
      .slice(0, 6)
      .map((p) => `${p.type}@${p.x.toFixed(6)}h${p.maxHeight.toFixed(6)}d${p.delay.toFixed(4)}`);
    expect({ count: plants.length, fingerprint }).toMatchInlineSnapshot(`
      {
        "count": 78,
        "fingerprint": [
          "hollyhock-double@0.422956h0.318182d104.0925",
          "foxglove@0.960092h0.302167d383.8195",
          "delphinium-tall@0.696601h0.250000d389.2531",
          "lily-tiger@0.233765h0.230039d174.5788",
          "rose-wild@0.817112h0.225169d548.3664",
          "hydrangea@0.363776h0.224185d454.5219",
        ],
      }
    `);
  });
});
