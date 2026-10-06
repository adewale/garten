/**
 * Property-based tests using fast-check
 * Verify mathematical invariants across random inputs
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Color } from './Color';
import { Vec2 } from './Vec2';
import { GrowthProgress } from './GrowthProgress';
import { SeededRandom, seededRandom, createRandom } from './SeededRandom';
import { applyTimingCurve, lerp, clamp } from './utils';
import { getPlantVariation } from './plants/variations';
import { PlantType } from './types';

// ==================== ARBITRARIES ====================

const rgb = fc.integer({ min: 0, max: 255 });
const colorArb = fc.tuple(rgb, rgb, rgb).map(([r, g, b]) => new Color(r, g, b));
const unitFloat = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });
const positiveFloat = fc.double({ min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true });
const finiteFloat = fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true });
// Non-zero vec with minimum magnitude to avoid degenerate float precision
const nonZeroVec = fc.tuple(finiteFloat, finiteFloat)
  .filter(([x, y]) => Math.sqrt(x * x + y * y) > 1e-10)
  .map(([x, y]) => new Vec2(x, y));
const vec2Arb = fc.tuple(finiteFloat, finiteFloat).map(([x, y]) => new Vec2(x, y));
const seedArb = fc.integer({ min: 0, max: 1_000_000 });

// ==================== COLOR TESTS ====================

describe('Color properties', () => {
  it('hex roundtrip preserves color', () => {
    fc.assert(fc.property(colorArb, (color) => {
      const rt = Color.fromHex(color.toHex());
      expect(rt).not.toBeNull();
      expect(rt!.equals(color)).toBe(true);
    }));
  });

  it('lighten produces higher or equal luminance', () => {
    fc.assert(fc.property(colorArb, unitFloat, (color, amount) => {
      const lighter = color.lighten(amount);
      expect(lighter.luminance()).toBeGreaterThanOrEqual(color.luminance() - 1e-10);
    }));
  });

  it('darken produces lower or equal luminance', () => {
    fc.assert(fc.property(colorArb, unitFloat, (color, amount) => {
      const darker = color.darken(amount);
      expect(darker.luminance()).toBeLessThanOrEqual(color.luminance() + 1e-10);
    }));
  });

  it('complement is an involution', () => {
    fc.assert(fc.property(colorArb, (color) => {
      expect(color.complement().complement().equals(color)).toBe(true);
    }));
  });

  it('mix at t=0 returns first color, t=1 returns second', () => {
    fc.assert(fc.property(colorArb, colorArb, (a, b) => {
      expect(a.mix(b, 0).equals(a)).toBe(true);
      expect(a.mix(b, 1).equals(b)).toBe(true);
    }));
  });

  it('mix produces valid RGB values', () => {
    fc.assert(fc.property(colorArb, colorArb, unitFloat, (a, b, t) => {
      const mixed = a.mix(b, t);
      expect(mixed.r).toBeGreaterThanOrEqual(0);
      expect(mixed.r).toBeLessThanOrEqual(255);
      expect(mixed.g).toBeGreaterThanOrEqual(0);
      expect(mixed.g).toBeLessThanOrEqual(255);
      expect(mixed.b).toBeGreaterThanOrEqual(0);
      expect(mixed.b).toBeLessThanOrEqual(255);
    }));
  });

  it('contrast ratio is symmetric', () => {
    fc.assert(fc.property(colorArb, colorArb, (a, b) => {
      expect(Math.abs(a.contrastWith(b) - b.contrastWith(a))).toBeLessThan(1e-10);
    }));
  });

  it('contrast ratio is between 1 and 21', () => {
    fc.assert(fc.property(colorArb, colorArb, (a, b) => {
      const ratio = a.contrastWith(b);
      expect(ratio).toBeGreaterThanOrEqual(1);
      expect(ratio).toBeLessThanOrEqual(21);
    }));
  });

  it('isLight and isDark are complementary', () => {
    fc.assert(fc.property(colorArb, (color) => {
      expect(color.isLight() !== color.isDark()).toBe(true);
    }));
  });

  it('constructor clamps values', () => {
    fc.assert(fc.property(
      fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }),
      (r, g, b, a) => {
        const c = new Color(r, g, b, a);
        expect(c.r).toBeGreaterThanOrEqual(0);
        expect(c.r).toBeLessThanOrEqual(255);
        expect(c.g).toBeGreaterThanOrEqual(0);
        expect(c.g).toBeLessThanOrEqual(255);
        expect(c.b).toBeGreaterThanOrEqual(0);
        expect(c.b).toBeLessThanOrEqual(255);
        expect(c.a).toBeGreaterThanOrEqual(0);
        expect(c.a).toBeLessThanOrEqual(1);
      }
    ));
  });
});

// ==================== VEC2 TESTS ====================

describe('Vec2 properties', () => {
  it('add is commutative', () => {
    fc.assert(fc.property(vec2Arb, vec2Arb, (a, b) => {
      const r1 = a.add(b);
      const r2 = b.add(a);
      expect(r1.approximatelyEquals(r2, 1e-8)).toBe(true);
    }));
  });

  it('normalize produces unit length for non-zero vectors', () => {
    fc.assert(fc.property(nonZeroVec, (v) => {
      const n = v.normalize();
      expect(Math.abs(n.length() - 1)).toBeLessThan(1e-8);
    }));
  });

  it('rotation preserves length', () => {
    fc.assert(fc.property(
      vec2Arb,
      fc.double({ min: -Math.PI * 2, max: Math.PI * 2, noNaN: true, noDefaultInfinity: true }),
      (v, angle) => {
        const rotated = v.rotate(angle);
        expect(Math.abs(rotated.length() - v.length())).toBeLessThan(1e-6);
      }
    ));
  });

  it('negate is an involution', () => {
    fc.assert(fc.property(vec2Arb, (v) => {
      expect(v.negate().negate().approximatelyEquals(v, 1e-10)).toBe(true);
    }));
  });

  it('dot product is commutative', () => {
    fc.assert(fc.property(vec2Arb, vec2Arb, (a, b) => {
      expect(Math.abs(a.dot(b) - b.dot(a))).toBeLessThan(1e-6);
    }));
  });

  it('perpendicular is orthogonal', () => {
    fc.assert(fc.property(nonZeroVec, (v) => {
      expect(Math.abs(v.dot(v.perpendicular()))).toBeLessThan(1e-6);
    }));
  });

  it('lerp at endpoints returns originals', () => {
    fc.assert(fc.property(vec2Arb, vec2Arb, (a, b) => {
      expect(a.lerp(b, 0).approximatelyEquals(a, 1e-6)).toBe(true);
      expect(a.lerp(b, 1).approximatelyEquals(b, 1e-6)).toBe(true);
    }));
  });

  it('distance is non-negative and symmetric', () => {
    fc.assert(fc.property(vec2Arb, vec2Arb, (a, b) => {
      expect(a.distanceTo(b)).toBeGreaterThanOrEqual(0);
      expect(Math.abs(a.distanceTo(b) - b.distanceTo(a))).toBeLessThan(1e-10);
    }));
  });

  it('setLength produces correct length for non-zero vectors', () => {
    fc.assert(fc.property(nonZeroVec, positiveFloat, (v, len) => {
      const result = v.setLength(len);
      expect(Math.abs(result.length() - len) / (len + 1e-15)).toBeLessThan(1e-6);
    }));
  });

  it('fromPolar/angle roundtrip', () => {
    fc.assert(fc.property(nonZeroVec, (v) => {
      const reconstructed = Vec2.fromPolar(v.angle(), v.length());
      expect(reconstructed.approximatelyEquals(v, 1e-6)).toBe(true);
    }));
  });
});

// ==================== GROWTH PROGRESS TESTS ====================

describe('GrowthProgress properties', () => {
  it('all phases bounded [0,1]', () => {
    fc.assert(fc.property(
      fc.double({ min: -2, max: 3, noNaN: true, noDefaultInfinity: true }),
      (p) => {
        const gp = GrowthProgress.fromProgress(p);
        expect(gp.stem).toBeGreaterThanOrEqual(0);
        expect(gp.stem).toBeLessThanOrEqual(1);
        expect(gp.leaf).toBeGreaterThanOrEqual(0);
        expect(gp.leaf).toBeLessThanOrEqual(1);
        expect(gp.flower).toBeGreaterThanOrEqual(0);
        expect(gp.flower).toBeLessThanOrEqual(1);
        expect(gp.foliage).toBeGreaterThanOrEqual(0);
        expect(gp.foliage).toBeLessThanOrEqual(1);
        expect(gp.progress).toBeGreaterThanOrEqual(0);
        expect(gp.progress).toBeLessThanOrEqual(1);
      }
    ));
  });

  it('phases are monotonically increasing with progress', () => {
    fc.assert(fc.property(
      fc.double({ min: 0, max: 0.99, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0.001, max: 0.5, noNaN: true, noDefaultInfinity: true }),
      (p1, delta) => {
        const p2 = Math.min(1, p1 + delta);
        const g1 = GrowthProgress.fromProgress(p1);
        const g2 = GrowthProgress.fromProgress(p2);
        expect(g2.stem).toBeGreaterThanOrEqual(g1.stem - 1e-10);
        expect(g2.leaf).toBeGreaterThanOrEqual(g1.leaf - 1e-10);
        expect(g2.flower).toBeGreaterThanOrEqual(g1.flower - 1e-10);
      }
    ));
  });

  it('stem grows before flower (stem >= flower)', () => {
    fc.assert(fc.property(unitFloat, (p) => {
      const gp = GrowthProgress.fromProgress(p);
      expect(gp.stem).toBeGreaterThanOrEqual(gp.flower - 1e-10);
    }));
  });

  it('complete progress has all boolean flags set', () => {
    const gp = GrowthProgress.fromProgress(1);
    expect(gp.isComplete).toBe(true);
    expect(gp.isActive).toBe(true);
    expect(gp.hasLeaves).toBe(true);
    expect(gp.hasFlower).toBe(true);
  });

  it('easing functions bounded [0,1] for valid progress', () => {
    fc.assert(fc.property(unitFloat, (p) => {
      const gp = GrowthProgress.fromProgress(p);
      for (const easing of ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const) {
        const v = gp.eased(easing);
        expect(v).toBeGreaterThanOrEqual(-1e-10);
        expect(v).toBeLessThanOrEqual(1 + 1e-10);
      }
    }));
  });
});

// ==================== SEEDED RANDOM TESTS ====================

describe('SeededRandom properties', () => {
  it('same seed produces identical sequences', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const r1 = new SeededRandom(seed);
      const r2 = new SeededRandom(seed);
      for (let i = 0; i < 20; i++) {
        expect(r1.next()).toBe(r2.next());
      }
    }));
  });

  it('next() always in [0, 1)', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const rng = new SeededRandom(seed);
      for (let i = 0; i < 50; i++) {
        const v = rng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }));
  });

  it('range() stays within bounds', () => {
    fc.assert(fc.property(
      seedArb,
      fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0.01, max: 200, noNaN: true, noDefaultInfinity: true }),
      (seed, min, span) => {
        const max = min + span;
        const rng = new SeededRandom(seed);
        for (let i = 0; i < 20; i++) {
          const v = rng.range(min, max);
          expect(v).toBeGreaterThanOrEqual(min - 1e-10);
          expect(v).toBeLessThan(max + 1e-10);
        }
      }
    ));
  });

  it('int() returns integers in range', () => {
    fc.assert(fc.property(
      seedArb,
      fc.integer({ min: -50, max: 50 }),
      fc.integer({ min: 0, max: 20 }),
      (seed, min, span) => {
        const max = min + span;
        const rng = new SeededRandom(seed);
        for (let i = 0; i < 20; i++) {
          const v = rng.int(min, max);
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(min);
          expect(v).toBeLessThanOrEqual(max);
        }
      }
    ));
  });

  it('shuffled preserves elements', () => {
    fc.assert(fc.property(
      seedArb,
      fc.array(fc.integer(), { minLength: 0, maxLength: 20 }),
      (seed, arr) => {
        const rng = new SeededRandom(seed);
        const shuffled = rng.shuffled(arr);
        expect(shuffled.length).toBe(arr.length);
        expect([...shuffled].sort()).toEqual([...arr].sort());
      }
    ));
  });

  it('pointInCircle stays within unit circle', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const rng = new SeededRandom(seed);
      for (let i = 0; i < 20; i++) {
        const p = rng.pointInCircle();
        expect(p.x * p.x + p.y * p.y).toBeLessThanOrEqual(1 + 1e-10);
      }
    }));
  });

  it('pointOnCircle is on unit circle', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const rng = new SeededRandom(seed);
      for (let i = 0; i < 20; i++) {
        const p = rng.pointOnCircle();
        expect(Math.abs(Math.sqrt(p.x * p.x + p.y * p.y) - 1)).toBeLessThan(1e-10);
      }
    }));
  });

  it('state save/restore produces same sequence', () => {
    fc.assert(fc.property(seedArb, fc.integer({ min: 1, max: 50 }), (seed, skip) => {
      const rng = new SeededRandom(seed);
      for (let i = 0; i < skip; i++) rng.next();
      const state = rng.getState();
      const v1 = rng.next();
      rng.setState(state);
      const v2 = rng.next();
      expect(v1).toBe(v2);
    }));
  });

  it('legacy seededRandom is deterministic', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      expect(seededRandom(seed)).toBe(seededRandom(seed));
    }));
  });

  it('legacy createRandom produces deterministic sequence', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const r1 = createRandom(seed);
      const r2 = createRandom(seed);
      for (let i = 0; i < 10; i++) {
        expect(r1()).toBe(r2());
      }
    }));
  });
});

// ==================== TIMING CURVE TESTS ====================

describe('Timing curve properties', () => {
  const curveArb = fc.oneof(
    fc.constant('linear' as const),
    fc.constant('ease-out' as const),
    fc.constant('ease-in' as const),
    fc.constant('ease-in-out' as const),
    fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true })
  );

  it('monotonically increasing', () => {
    fc.assert(fc.property(
      curveArb,
      fc.integer({ min: 2, max: 100 }),
      (curve, totalGen) => {
        let prev = applyTimingCurve(0, totalGen, curve);
        for (let g = 1; g <= totalGen; g++) {
          const curr = applyTimingCurve(g, totalGen, curve);
          expect(curr).toBeGreaterThanOrEqual(prev - 1e-10);
          prev = curr;
        }
      }
    ));
  });

  it('boundaries: f(0)=0 and f(total)=1', () => {
    fc.assert(fc.property(
      curveArb,
      fc.integer({ min: 1, max: 100 }),
      (curve, totalGen) => {
        expect(applyTimingCurve(0, totalGen, curve)).toBeCloseTo(0, 8);
        expect(applyTimingCurve(totalGen, totalGen, curve)).toBeCloseTo(1, 8);
      }
    ));
  });

  it('output bounded [0, 1]', () => {
    fc.assert(fc.property(
      curveArb,
      fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: 0, max: 100 }),
      (curve, totalGen, gen) => {
        const clamped = Math.min(gen, totalGen);
        const v = applyTimingCurve(clamped, totalGen, curve);
        expect(v).toBeGreaterThanOrEqual(-1e-10);
        expect(v).toBeLessThanOrEqual(1 + 1e-10);
      }
    ));
  });

  it('linear is identity', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 100 }), (total, gen) => {
      const clamped = Math.min(gen, total);
      expect(applyTimingCurve(clamped, total, 'linear')).toBeCloseTo(clamped / total, 10);
    }));
  });

  // Start times are the *inverse* of the named easing: a fast-start curve
  // ('ease-out') starts generations earlier than linear, 'ease-in' later
  it('ease-out starts every inner generation earlier than linear, ease-in later', () => {
    fc.assert(fc.property(fc.integer({ min: 2, max: 100 }), (total) => {
      for (let g = 1; g < total; g++) {
        const linear = g / total;
        expect(applyTimingCurve(g, total, 'ease-out')).toBeLessThan(linear);
        expect(applyTimingCurve(g, total, 'ease-in')).toBeGreaterThan(linear);
      }
    }));
  });

  it('numeric exponents: >1 behaves like ease-out, <1 like ease-in', () => {
    fc.assert(fc.property(
      fc.double({ min: 1.05, max: 10, noNaN: true }),
      fc.integer({ min: 2, max: 50 }),
      (e, total) => {
        const g = Math.floor(total / 2) || 1;
        expect(applyTimingCurve(g, total, e)).toBeLessThan(g / total);
        expect(applyTimingCurve(g, total, 1 / e)).toBeGreaterThan(g / total);
      }
    ));
  });

  it('start times invert the matching GrowthProgress easing', () => {
    // eased('ease-out') = t(2 - t), eased('ease-in') = t^2: the share of
    // generations started at a curve's start time is the generation index
    for (const [curve, ease] of [
      ['ease-out', (t: number) => t * (2 - t)],
      ['ease-in', (t: number) => t * t],
      ['ease-in-out', (t: number) => t * t * (3 - 2 * t)],
    ] as const) {
      for (let g = 0; g <= 20; g++) {
        expect(ease(applyTimingCurve(g, 20, curve))).toBeCloseTo(g / 20, 10);
      }
    }
  });

  it('ease-in-out is symmetric: slow at both ends, fast in the middle', () => {
    for (let g = 0; g <= 20; g++) {
      const a = applyTimingCurve(g, 20, 'ease-in-out');
      const b = applyTimingCurve(20 - g, 20, 'ease-in-out');
      expect(a + b).toBeCloseTo(1, 10);
    }
    const edge = applyTimingCurve(1, 20, 'ease-in-out') - applyTimingCurve(0, 20, 'ease-in-out');
    const middle = applyTimingCurve(11, 20, 'ease-in-out') - applyTimingCurve(10, 20, 'ease-in-out');
    expect(edge).toBeGreaterThan(middle); // first generation gets a longer slot
  });
});

// ==================== UTILITY FUNCTION TESTS ====================

describe('Utility function properties', () => {
  it('lerp at endpoints', () => {
    fc.assert(fc.property(finiteFloat, finiteFloat, (a, b) => {
      expect(lerp(a, b, 0)).toBeCloseTo(a, 6);
      expect(lerp(a, b, 1)).toBeCloseTo(b, 6);
    }));
  });

  it('clamp is idempotent', () => {
    fc.assert(fc.property(
      finiteFloat,
      finiteFloat,
      finiteFloat,
      (v, a, b) => {
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        expect(clamp(clamp(v, min, max), min, max)).toBe(clamp(v, min, max));
      }
    ));
  });

  it('clamp output is within bounds', () => {
    fc.assert(fc.property(
      finiteFloat,
      finiteFloat,
      finiteFloat,
      (v, a, b) => {
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        const c = clamp(v, min, max);
        expect(c).toBeGreaterThanOrEqual(min);
        expect(c).toBeLessThanOrEqual(max);
      }
    ));
  });
});

// ==================== PLANT VARIATION TESTS ====================

describe('Plant variation properties', () => {
  const allPlantTypes = Object.values(PlantType);

  it('every plant type returns valid variations', () => {
    for (const type of allPlantTypes) {
      const v = getPlantVariation(type as PlantType);
      expect(v.sizeMultiplier).toBeGreaterThan(0);
      expect(v.heightMultiplier).toBeGreaterThan(0);
      expect(v.thicknessMultiplier).toBeGreaterThan(0);
      expect(v.leanMultiplier).toBeGreaterThanOrEqual(0);
      expect(v.complexity).toBeGreaterThanOrEqual(0);
      expect(v.complexity).toBeLessThanOrEqual(1);
    }
  });
});
