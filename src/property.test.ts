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
import type { TimingCurve } from './types';

// ==================== ARBITRARIES ====================

const rgb = fc.integer({ min: 0, max: 255 });
const unitFloat = fc.double({ min: 0, max: 1, noNaN: true });
const opaqueColorArb = fc.tuple(rgb, rgb, rgb).map(([r, g, b]) => new Color(r, g, b));
const colorArb = fc.tuple(rgb, rgb, rgb, unitFloat).map(([r, g, b, a]) => new Color(r, g, b, a));
/** Every finite double, from subnormals to the largest magnitudes */
const finiteFloat = fc.double({ noNaN: true, noDefaultInfinity: true });
const vec2Arb = fc.tuple(finiteFloat, finiteFloat).map(([x, y]) => new Vec2(x, y));
const nonZeroVec = vec2Arb.filter((v) => v.x !== 0 || v.y !== 0);
/** SeededRandom takes any finite seed: negative, fractional or huge */
const seedArb = fc.oneof(fc.integer(), finiteFloat);

/** Cheap properties run thousands of cases */
const RUNS = { numRuns: 2000 };
/** Same number, -0 and 0 alike, NaN equal to itself */
const sameNumber = (a: number, b: number) => a === b || (Number.isNaN(a) && Number.isNaN(b));

// ==================== COLOR TESTS ====================

describe('Color properties', () => {
  it('hex roundtrip preserves color', () => {
    fc.assert(fc.property(opaqueColorArb, (color) => {
      const rt = Color.fromHex(color.toHex());
      expect(rt).not.toBeNull();
      expect(rt!.equals(color)).toBe(true);
    }), RUNS);
  });

  it('lighten never lowers luminance', () => {
    fc.assert(fc.property(colorArb, unitFloat, (color, amount) => {
      expect(color.lighten(amount).luminance()).toBeGreaterThanOrEqual(color.luminance());
    }), RUNS);
  });

  it('darken never raises luminance', () => {
    fc.assert(fc.property(colorArb, unitFloat, (color, amount) => {
      expect(color.darken(amount).luminance()).toBeLessThanOrEqual(color.luminance());
    }), RUNS);
  });

  it('complement is an involution', () => {
    fc.assert(fc.property(colorArb, (color) => {
      expect(color.complement().complement().equals(color)).toBe(true);
    }), RUNS);
  });

  it('mix at t=0 returns first color, t=1 returns second', () => {
    fc.assert(fc.property(colorArb, colorArb, (a, b) => {
      expect(a.mix(b, 0).equals(a), 't = 0').toBe(true);
      expect(a.mix(b, 1).equals(b), 't = 1').toBe(true);
    }), {
      ...RUNS,
      // Production finding: alpha 0.3 mixed fully toward 0.9 gives 0.9000000000000001
      examples: [[new Color(0, 0, 0, 0.3), new Color(0, 0, 0, 0.9)]],
    });
  });

  it('mix stays between the two colors in every channel', () => {
    fc.assert(fc.property(colorArb, colorArb, unitFloat, (a, b, t) => {
      const mixed = a.mix(b, t);
      for (const ch of ['r', 'g', 'b', 'a'] as const) {
        expect(mixed[ch], ch).toBeGreaterThanOrEqual(Math.min(a[ch], b[ch]));
        expect(mixed[ch], ch).toBeLessThanOrEqual(Math.max(a[ch], b[ch]));
      }
    }), {
      ...RUNS,
      // Production finding: alpha overshoots 0.9 (same root as the t=1 endpoint)
      examples: [[new Color(0, 0, 0, 0.3), new Color(0, 0, 0, 0.9), 1]],
    });
  });

  it('contrast ratio is symmetric', () => {
    fc.assert(fc.property(colorArb, colorArb, (a, b) => {
      expect(a.contrastWith(b)).toBe(b.contrastWith(a));
    }), RUNS);
  });

  it('contrast ratio is between 1 and 21', () => {
    fc.assert(fc.property(colorArb, colorArb, (a, b) => {
      const ratio = a.contrastWith(b);
      expect(ratio).toBeGreaterThanOrEqual(1);
      expect(ratio).toBeLessThanOrEqual(21);
    }), RUNS);
  });

  it('isLight and isDark are complementary', () => {
    fc.assert(fc.property(colorArb, (color) => {
      expect(color.isLight() !== color.isDark()).toBe(true);
    }), RUNS);
  });

  it('constructor rounds each channel to the nearest integer in 0-255 and clamps alpha to 0-1', () => {
    // Every double, NaN and the infinities included: a Color is always valid
    fc.assert(fc.property(fc.double(), fc.double(), fc.double(), fc.double(), (r, g, b, a) => {
      const c = new Color(r, g, b, a);
      // Documented NaN rule: a NaN channel is 0, a NaN alpha is 1 (opaque)
      const clampTo = (v: number, hi: number, ifNaN: number) =>
        Number.isNaN(v) ? ifNaN : v < 0 ? 0 : v > hi ? hi : v;
      for (const [ch, v] of [[c.r, r], [c.g, g], [c.b, b]] as const) {
        expect(Number.isInteger(ch), `channel ${ch} from ${v}`).toBe(true);
        expect(Math.abs(ch - clampTo(v, 255, 0)), `channel ${ch} from ${v}`).toBeLessThanOrEqual(0.5);
      }
      expect(sameNumber(c.a, clampTo(a, 1, 1)) && c.a >= 0 && c.a <= 1, `alpha ${c.a} from ${a}`).toBe(true);
    }), {
      ...RUNS,
      examples: [
        [-10, 300, 128, -0.5],
        [128, -50, 500, 1.5],
        // Production finding: NaN passes through the clamps into the color
        [NaN, 0, 0, 1],
        [0, 0, 0, NaN],
      ],
    });
  });
});

// ==================== VEC2 TESTS ====================

describe('Vec2 properties', () => {
  it('add is commutative', () => {
    fc.assert(fc.property(vec2Arb, vec2Arb, (a, b) => {
      expect(a.add(b).equals(b.add(a))).toBe(true);
    }), RUNS);
  });

  it('normalize produces unit length for non-zero vectors', () => {
    // A unit vector's length is a sqrt of a rounded sum of rounded squares
    // of rounded quotients: within a few ulps of 1, not exactly 1
    fc.assert(fc.property(nonZeroVec, (v) => {
      expect(Math.abs(v.normalize().length() - 1)).toBeLessThanOrEqual(4 * Number.EPSILON);
    }), {
      ...RUNS,
      // Production finding: length() squares its components, so it underflows
      // to 0 below ~1e-162 and overflows to Infinity above ~1.3e154
      examples: [[new Vec2(0, -5e-324)], [new Vec2(1e-200, 0)], [new Vec2(1e200, 1e200)]],
    });
  });

  it('rotation preserves length', () => {
    // Each rotated component carries a few ulps of |v| of rounding error.
    // Contract domain: vectors whose length stays representable after a few
    // ulps of rounding (a length within ~16 ulps of Number.MAX_VALUE can round
    // up to Infinity once rotated)
    fc.assert(fc.property(vec2Arb, finiteFloat, (v, angle) => {
      const before = v.length();
      fc.pre(before < Number.MAX_VALUE * (1 - 16 * Number.EPSILON));
      // Below the normal range the rounding step is Number.MIN_VALUE per component
      const tolerance = Math.max(8 * Number.EPSILON * before, 2 * Number.MIN_VALUE);
      expect(Math.abs(v.rotate(angle).length() - before)).toBeLessThanOrEqual(tolerance);
    }), {
      ...RUNS,
      // Production finding: length() overflows (see normalize)
      examples: [[new Vec2(0, 1.3407807929942597e154), 0]],
    });
  });

  it('negate is an involution', () => {
    fc.assert(fc.property(vec2Arb, (v) => {
      const back = v.negate().negate();
      expect(Object.is(back.x, v.x) && Object.is(back.y, v.y)).toBe(true);
    }), RUNS);
  });

  it('dot product is commutative', () => {
    fc.assert(fc.property(vec2Arb, vec2Arb, (a, b) => {
      expect(sameNumber(a.dot(b), b.dot(a))).toBe(true);
    }), RUNS);
  });

  it('perpendicular is orthogonal', () => {
    // x * -y + y * x: the two products round identically, so the dot product
    // is exactly zero. Both vectors are first scaled by the same power of two
    // (exact) so that the oracle's own products cannot overflow.
    fc.assert(fc.property(nonZeroVec, (v) => {
      const p = v.perpendicular();
      const largest = Math.max(Math.abs(v.x), Math.abs(v.y));
      const k = largest > 1 ? 2 ** -Math.ceil(Math.log2(largest)) : 1;
      const dot = new Vec2(v.x * k, v.y * k).dot(new Vec2(p.x * k, p.y * k));
      expect(dot === 0, `dot ${dot}`).toBe(true);
    }), RUNS);
  });

  it('lerp at endpoints returns originals', () => {
    fc.assert(fc.property(vec2Arb, vec2Arb, (a, b) => {
      expect(a.lerp(b, 0).equals(a), 't = 0').toBe(true);
      expect(a.lerp(b, 1).equals(b), 't = 1').toBe(true);
    }), {
      ...RUNS,
      // Production finding: a + (b - a) * 1 is not b (0.3 -> 0.9 gives 0.9000000000000001)
      examples: [[new Vec2(0.3, 0), new Vec2(0.9, 0)]],
    });
  });

  it('distance is non-negative and symmetric', () => {
    fc.assert(fc.property(vec2Arb, vec2Arb, (a, b) => {
      expect(a.distanceTo(b)).toBeGreaterThanOrEqual(0);
      expect(a.distanceTo(b)).toBe(b.distanceTo(a));
    }), RUNS);
  });

  it('setLength produces correct length for non-zero vectors', () => {
    // normalize (a few ulps) then one rounded multiplication per component
    fc.assert(fc.property(nonZeroVec, fc.double({ min: 0, noNaN: true, noDefaultInfinity: true }), (v, len) => {
      // Components are rounded to representable doubles; below the normal
      // range that step is Number.MIN_VALUE, not a relative epsilon
      const tolerance = Math.max(8 * Number.EPSILON * len, 2 * Number.MIN_VALUE);
      expect(Math.abs(v.setLength(len).length() - len)).toBeLessThanOrEqual(tolerance);
    }), {
      ...RUNS,
      // Production finding: length() underflows (see normalize)
      examples: [[new Vec2(1e-200, 0), 1]],
    });
  });

  it('fromPolar/angle roundtrip', () => {
    // atan2, cos and sin each round: a few ulps of |v| per component
    fc.assert(fc.property(nonZeroVec, (v) => {
      const back = Vec2.fromPolar(v.angle(), v.length());
      const len = v.length();
      expect(Math.abs(back.x - v.x)).toBeLessThanOrEqual(8 * Number.EPSILON * len);
      expect(Math.abs(back.y - v.y)).toBeLessThanOrEqual(8 * Number.EPSILON * len);
    }), {
      ...RUNS,
      // Production finding: length() underflows (see normalize)
      examples: [[new Vec2(1e-200, 0)]],
    });
  });
});

// ==================== GROWTH PROGRESS TESTS ====================

describe('GrowthProgress properties', () => {
  // Every progress value: NaN and the infinities included
  const anyProgress = fc.double();

  it('all phases bounded [0,1]', () => {
    fc.assert(fc.property(anyProgress, (p) => {
      const gp = GrowthProgress.fromProgress(p);
      for (const phase of ['progress', 'stem', 'leaf', 'flower', 'foliage', 'plume'] as const) {
        expect(gp[phase] >= 0 && gp[phase] <= 1, `${phase} = ${gp[phase]} at ${p}`).toBe(true);
      }
    }), {
      ...RUNS,
      // Production finding: NaN progress (0/0 from a zero duration) passes the clamp
      examples: [[NaN]],
    });
  });

  it('phases are monotonically increasing with progress', () => {
    fc.assert(fc.property(fc.double({ noNaN: true }), fc.double({ noNaN: true }), (a, b) => {
      const [p1, p2] = a <= b ? [a, b] : [b, a];
      const g1 = GrowthProgress.fromProgress(p1);
      const g2 = GrowthProgress.fromProgress(p2);
      for (const phase of ['progress', 'stem', 'leaf', 'flower', 'foliage', 'plume'] as const) {
        expect(g2[phase], phase).toBeGreaterThanOrEqual(g1[phase]);
      }
    }), RUNS);
  });

  it('stem grows before flower (stem >= flower)', () => {
    fc.assert(fc.property(fc.double({ noNaN: true }), (p) => {
      const gp = GrowthProgress.fromProgress(p);
      expect(gp.stem).toBeGreaterThanOrEqual(gp.flower);
    }), RUNS);
  });

  it('complete progress has all boolean flags set', () => {
    const gp = GrowthProgress.fromProgress(1);
    expect(gp.isComplete).toBe(true);
    expect(gp.isActive).toBe(true);
    expect(gp.hasLeaves).toBe(true);
    expect(gp.hasFlower).toBe(true);
  });

  it('easing functions bounded [0,1]', () => {
    fc.assert(fc.property(anyProgress, (p) => {
      const gp = GrowthProgress.fromProgress(p);
      for (const easing of ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const) {
        const v = gp.eased(easing);
        expect(v >= 0 && v <= 1, `${easing} = ${v} at ${p}`).toBe(true);
      }
    }), { ...RUNS, examples: [[NaN]] });
  });
});

// ==================== SEEDED RANDOM TESTS ====================

describe('SeededRandom properties', () => {
  it('same seed produces identical sequences', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const r1 = new SeededRandom(seed);
      const r2 = new SeededRandom(seed);
      const a = Array.from({ length: 20 }, () => r1.next());
      expect(Array.from({ length: 20 }, () => r2.next())).toEqual(a);
    }), RUNS);
  });

  it.each([NaN, Infinity, -Infinity])('a non-finite seed (%s) behaves as seed 0', (seed) => {
    const rng = new SeededRandom(seed);
    const zero = new SeededRandom(0);
    for (let i = 0; i < 5; i++) expect(rng.next()).toBe(zero.next());
  });

  it('next() always in [0, 1)', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const rng = new SeededRandom(seed);
      const values = Array.from({ length: 50 }, () => rng.next());
      expect(values.find((v) => !(v >= 0 && v < 1))).toBeUndefined();
    }), RUNS);
  });

  it('range() stays within [min, max)', () => {
    fc.assert(fc.property(seedArb, finiteFloat, finiteFloat, (seed, a, b) => {
      fc.pre(a !== b);
      const [min, max] = a < b ? [a, b] : [b, a];
      const rng = new SeededRandom(seed);
      const values = Array.from({ length: 20 }, () => rng.range(min, max));
      expect(values.find((v) => !(v >= min && v < max))).toBeUndefined();
    }), {
      ...RUNS,
      // Production finding: min + u * (max - min) rounds up to max when the
      // span is small next to max's ulp
      examples: [[0, 0, 5e-324]],
    });
  });

  it('int() returns integers in [min, max]', () => {
    fc.assert(fc.property(seedArb, fc.integer(), fc.integer(), (seed, a, b) => {
      const [min, max] = a <= b ? [a, b] : [b, a];
      const rng = new SeededRandom(seed);
      const values = Array.from({ length: 20 }, () => rng.int(min, max));
      expect(values.find((v) => !(Number.isInteger(v) && v >= min && v <= max))).toBeUndefined();
    }), RUNS);
  });

  it('shuffled preserves elements', () => {
    fc.assert(fc.property(seedArb, fc.array(fc.integer(), { maxLength: 50 }), (seed, arr) => {
      const shuffled = new SeededRandom(seed).shuffled(arr);
      const byValue = (x: number, y: number) => x - y;
      expect([...shuffled].sort(byValue)).toEqual([...arr].sort(byValue));
    }), RUNS);
  });

  it('pointInCircle stays within unit circle', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const rng = new SeededRandom(seed);
      const points = Array.from({ length: 20 }, () => rng.pointInCircle());
      expect(points.find((p) => !(p.x * p.x + p.y * p.y <= 1))).toBeUndefined();
    }), RUNS);
  });

  it('pointOnCircle is on unit circle', () => {
    // cos and sin each round, so the point is within a few ulps of the circle
    fc.assert(fc.property(seedArb, (seed) => {
      const rng = new SeededRandom(seed);
      const points = Array.from({ length: 20 }, () => rng.pointOnCircle());
      expect(points.find((p) => !(Math.abs(Math.hypot(p.x, p.y) - 1) <= 4 * Number.EPSILON))).toBeUndefined();
    }), RUNS);
  });

  it('state save/restore produces same sequence', () => {
    fc.assert(fc.property(seedArb, fc.nat({ max: 1000 }), (seed, skip) => {
      const rng = new SeededRandom(seed);
      for (let i = 0; i < skip; i++) rng.next();
      const state = rng.getState();
      const v1 = rng.next();
      rng.setState(state);
      const v2 = rng.next();
      expect(v1).toBe(v2);
    }), RUNS);
  });

  it('legacy seededRandom is the first value of a SeededRandom', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      expect(seededRandom(seed)).toBe(new SeededRandom(seed).next());
    }), RUNS);
  });

  it('legacy createRandom produces the SeededRandom sequence', () => {
    fc.assert(fc.property(seedArb, (seed) => {
      const legacy = createRandom(seed);
      const rng = new SeededRandom(seed);
      const expected = Array.from({ length: 10 }, () => rng.next());
      expect(Array.from({ length: 10 }, () => legacy())).toEqual(expected);
    }), RUNS);
  });
});

// ==================== TIMING CURVE TESTS ====================

describe('Timing curve properties', () => {
  const NAMED = ['linear', 'ease-out', 'ease-in', 'ease-in-out'] as const;
  // The four names, the documented exponent range 0.1-10, and any other
  // finite number (documented as clamped into that range)
  const exponentArb = fc.double({ min: 0.1, max: 10, noNaN: true });
  const curveArb: fc.Arbitrary<TimingCurve> = fc.oneof(
    fc.constantFrom(...NAMED),
    exponentArb,
    finiteFloat
  );
  // The full generations domain (1-1000)
  const totalArb = fc.integer({ min: 1, max: 1000 });
  /** Start time of every generation 0..total, inclusive of the end */
  const starts = (total: number, curve: TimingCurve) =>
    Array.from({ length: total + 1 }, (_, g) => applyTimingCurve(g, total, curve));

  it('start times never decrease with the generation index', () => {
    fc.assert(fc.property(curveArb, totalArb, (curve, total) => {
      const s = starts(total, curve);
      const g = s.findIndex((v, i) => i > 0 && v < s[i - 1]);
      expect(g < 0 ? undefined : `generation ${g}: ${s[g]} < ${s[g - 1]}`).toBeUndefined();
    }), RUNS);
  });

  it('boundaries: f(0)=0 and f(total)=1', () => {
    fc.assert(fc.property(curveArb, totalArb, (curve, total) => {
      expect(applyTimingCurve(0, total, curve), 'first start').toBe(0);
      expect(applyTimingCurve(total, total, curve), 'end').toBe(1);
    }), {
      ...RUNS,
      // Production finding: ease-in-out starts generation 0 at 5.55e-17
      examples: [['ease-in-out', 1]],
    });
  });

  it('output bounded [0, 1] for any generation index', () => {
    fc.assert(fc.property(curveArb, totalArb, fc.integer(), (curve, total, gen) => {
      const v = applyTimingCurve(gen, total, curve);
      expect(v >= 0 && v <= 1, `${v}`).toBe(true);
    }), RUNS);
  });

  it('linear is identity', () => {
    fc.assert(fc.property(totalArb, fc.nat(), (total, raw) => {
      const g = raw % (total + 1);
      expect(applyTimingCurve(g, total, 'linear')).toBe(g / total);
    }), RUNS);
  });

  it('the names are the documented exponents: linear 1, ease-out 2, ease-in 0.5', () => {
    fc.assert(fc.property(totalArb, fc.nat(), (total, raw) => {
      const g = raw % (total + 1);
      expect(applyTimingCurve(g, total, 'linear')).toBe(applyTimingCurve(g, total, 1));
      expect(applyTimingCurve(g, total, 'ease-out')).toBe(applyTimingCurve(g, total, 2));
      expect(applyTimingCurve(g, total, 'ease-in')).toBe(applyTimingCurve(g, total, 0.5));
    }), RUNS);
  });

  it('numeric exponents follow the documented start-time formula exactly', () => {
    // e > 1 is ease-out of power e: start = 1 - (1 - x)^(1/e)
    // e < 1 is ease-in of power 1/e: start = x^e
    // e = 1 is linear: start = x
    const documented = (x: number, e: number) =>
      e > 1 ? 1 - Math.pow(1 - x, 1 / e) : e < 1 ? Math.pow(x, e) : x;
    fc.assert(fc.property(exponentArb, totalArb, fc.nat(), (e, total, raw) => {
      const g = raw % (total + 1);
      expect(applyTimingCurve(g, total, e)).toBe(documented(g / total, e));
    }), {
      ...RUNS,
      // The bounds, and 1 with its neighbors on either side
      examples: [[0.1, 7, 3], [10, 7, 3], [1, 7, 3], [1 + Number.EPSILON, 7, 3], [1 - Number.EPSILON / 2, 7, 3]],
    });
  });

  it('exponents outside 0.1-10 act as the nearest bound', () => {
    fc.assert(fc.property(finiteFloat, totalArb, fc.nat(), (e, total, raw) => {
      fc.pre(e < 0.1 || e > 10);
      const g = raw % (total + 1);
      expect(applyTimingCurve(g, total, e)).toBe(applyTimingCurve(g, total, e < 0.1 ? 0.1 : 10));
    }), { ...RUNS, examples: [[0, 5, 2], [-0, 5, 2], [-3, 5, 2], [1e300, 5, 2]] });
  });

  // The share of generations started by a curve's start time is the
  // generation index, with the same meaning as GrowthProgress.eased(): start
  // times are the inverse of the easing. Easing a start time back loses at
  // most about e x 2^-52 (e <= 10) to rounding, so 1e-12 is a safe margin
  // for an inverse computed in floating point; it is not a tolerance on
  // the contract, which is exact in real arithmetic.
  const ROUND_TRIP = 1e-12;

  it('named start times invert GrowthProgress.eased', () => {
    fc.assert(fc.property(fc.constantFrom(...NAMED), totalArb, fc.nat(), (curve, total, raw) => {
      const g = raw % (total + 1);
      const eased = GrowthProgress.fromProgress(applyTimingCurve(g, total, curve)).eased(curve);
      expect(Math.abs(eased - g / total), `${curve} ${g}/${total}`).toBeLessThanOrEqual(ROUND_TRIP);
    }), {
      ...RUNS,
      // Production finding: ease-in-out inverts smoothstep, but eased('ease-in-out') is piecewise quadratic
      examples: [['ease-in-out', 4, 1]],
    });
  });

  it('numeric start times invert the power easing they name', () => {
    // e > 1 eases out with 1 - (1 - t)^e; e < 1 eases in with t^(1/e)
    const ease = (t: number, e: number) => (e >= 1 ? 1 - Math.pow(1 - t, e) : Math.pow(t, 1 / e));
    fc.assert(fc.property(exponentArb, totalArb, fc.nat(), (e, total, raw) => {
      const g = raw % (total + 1);
      const eased = ease(applyTimingCurve(g, total, e), e);
      expect(Math.abs(eased - g / total), `e=${e} ${g}/${total}`).toBeLessThanOrEqual(ROUND_TRIP);
    }), { ...RUNS, examples: [[1, 7, 3], [0.1, 1000, 1], [10, 1000, 999]] });
  });

  it('ease-out starts inner generations earlier than linear, ease-in later', () => {
    // Strict inside: the gap to linear is at least ~x^2/4 >= 2.5e-7 for
    // N <= 1000, far above rounding. Equal at both ends.
    fc.assert(fc.property(totalArb, (total) => {
      for (let g = 0; g <= total; g++) {
        const easeOut = applyTimingCurve(g, total, 'ease-out');
        const linear = applyTimingCurve(g, total, 'linear');
        const easeIn = applyTimingCurve(g, total, 'ease-in');
        if (g === 0 || g === total) {
          expect([easeOut, easeIn], `generation ${g}`).toEqual([linear, linear]);
        } else if (!(easeOut < linear && linear < easeIn)) {
          expect(`generation ${g}/${total}: ${easeOut} < ${linear} < ${easeIn}`).toBeUndefined();
        }
      }
    }), { numRuns: 300 });
  });

  it('ease-in-out is symmetric: the late half mirrors the early half exactly', () => {
    // Exact in the direction floating point can deliver: for g in the early
    // half, start(total - g) === 1 - start(g). (The reverse, start(g) ===
    // 1 - start(total - g), would need 1 - (1 - c) === c, which rounding
    // breaks for small c whatever the formula.)
    fc.assert(fc.property(totalArb, fc.nat(), (total, raw) => {
      const g = raw % (Math.floor(total / 2) + 1);
      expect(applyTimingCurve(total - g, total, 'ease-in-out')).toBe(
        1 - applyTimingCurve(g, total, 'ease-in-out')
      );
    }), {
      ...RUNS,
      // Production finding: the two halves are computed independently and
      // disagree in the last bit (3 generations: 0.386963143105396 vs
      // 1 - 0.613036856894604 = 0.38696314310539603), and at g = 0 by 5.55e-17
      examples: [[3, 1], [1, 0]],
    });
  });

  it('ease-in-out gives the outermost generations the longest slots', () => {
    // Slow at both ends, fast in the middle: slot lengths shrink toward the
    // middle (and mirror on the far side, by symmetry). Neighboring slots
    // differ by ~1/N^3 >= 1e-9, far above rounding.
    fc.assert(fc.property(totalArb, (total) => {
      const s = starts(total, 'ease-in-out');
      for (let g = 0; g + 2 <= total / 2; g++) {
        const slot = s[g + 1] - s[g];
        const next = s[g + 2] - s[g + 1];
        if (!(slot >= next)) expect(`slot ${g} (${slot}) < slot ${g + 1} (${next}) of ${total}`).toBeUndefined();
      }
    }), { numRuns: 300 });
  });
});

// ==================== UTILITY FUNCTION TESTS ====================

describe('Utility function properties', () => {
  it('lerp at endpoints', () => {
    fc.assert(fc.property(finiteFloat, finiteFloat, (a, b) => {
      expect(lerp(a, b, 0), 't = 0').toBe(a);
      expect(lerp(a, b, 1), 't = 1').toBe(b);
    }), {
      ...RUNS,
      // Production finding: a + (b - a) * 1 is not b
      examples: [[0.3, 0.9]],
    });
  });

  it('clamp returns the value, or the bound it lies beyond', () => {
    // Any value (NaN and infinities included) against any ordered bounds
    fc.assert(fc.property(fc.double(), finiteFloat, finiteFloat, (v, a, b) => {
      const [min, max] = a <= b ? [a, b] : [b, a];
      const expected = v < min ? min : v > max ? max : v;
      const actual = clamp(v, min, max);
      expect(sameNumber(actual, expected), `clamp(${v}, ${min}, ${max}) = ${actual}`).toBe(true);
    }), RUNS);
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
