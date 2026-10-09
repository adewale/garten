import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  GrowthProgress,
  calculateGrowthPhases,
  isPlantActive,
  calculateRawProgress,
  rawGrowthProgress,
  type GrowthConfig,
} from './GrowthProgress';
import { GROWTH_PHASES } from './constants';

// ==================== ARBITRARIES ====================

/** Every double: NaN, ±Infinity, -0, subnormals and extremes included */
const anyDouble = fc.double();
const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
/**
 * [0, 1]: fc.double alone is uniform over representable doubles, so almost
 * every draw is tiny and the thresholds at 0.3-0.8 are rarely reached. Mix
 * in uniform reals so every phase boundary is exercised.
 */
const unit = fc.oneof(
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.integer({ min: 0, max: 2 ** 30 }).map((i) => i / 2 ** 30)
);
const rate = fc.double({ min: 0, max: 1e6, noNaN: true });

/** The documented config domain: starts in [0, 1], non-negative rates */
const configArb: fc.Arbitrary<GrowthConfig> = fc.record({
  stemRate: rate,
  leafStart: unit,
  leafRate: rate,
  flowerStart: unit,
  flowerRate: rate,
});

/** Partial configs where each key is absent, explicitly undefined, or set */
const partialConfigArb = fc.record(
  {
    stemRate: fc.option(rate, { nil: undefined }),
    leafStart: fc.option(unit, { nil: undefined }),
    leafRate: fc.option(rate, { nil: undefined }),
    flowerStart: fc.option(unit, { nil: undefined }),
    flowerRate: fc.option(rate, { nil: undefined }),
  },
  { requiredKeys: [] }
);

const EASINGS = ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const;
const FIELDS = ['progress', 'stem', 'leaf', 'flower', 'foliage', 'plume'] as const;
const FLAGS = ['isActive', 'isComplete', 'hasLeaves', 'hasFlower', 'hasFoliage', 'hasPlume'] as const;

function fields(g: GrowthProgress): number[] {
  return FIELDS.map((k) => g[k]);
}

function sameFields(a: GrowthProgress, b: GrowthProgress): boolean {
  return FIELDS.every((k) => Object.is(a[k], b[k]));
}

// ==================== EXAMPLES (documentation) ====================

describe('GrowthProgress examples', () => {
  it('computes the documented default phases at 50% progress', () => {
    const g = GrowthProgress.calculate(150, 100, 100);
    expect(g.progress).toBe(0.5);
    expect(g.stem).toBe(0.75); // 0.5 * 1.5
    expect(g.leaf).toBeCloseTo(0.4, 12); // (0.5 - 0.3) * 2
    expect(g.flower).toBe(0); // flowers start at 0.5
    expect(g.isActive).toBe(true);
    expect(g.hasFlower).toBe(false);
  });

  it('inactive() and complete() are progress 0 and 1', () => {
    expect(GrowthProgress.inactive().equals(GrowthProgress.fromProgress(0))).toBe(true);
    expect(GrowthProgress.complete().equals(GrowthProgress.fromProgress(1))).toBe(true);
    expect(fields(GrowthProgress.complete())).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('defaultConfig mirrors GROWTH_PHASES', () => {
    expect(GrowthProgress.defaultConfig).toEqual({
      stemRate: GROWTH_PHASES.STEM_GROWTH_RATE,
      leafStart: GROWTH_PHASES.LEAF_START,
      leafRate: GROWTH_PHASES.LEAF_GROWTH_RATE,
      flowerStart: GROWTH_PHASES.FLOWER_START,
      flowerRate: GROWTH_PHASES.FLOWER_GROWTH_RATE,
    });
  });

  it('toString has a readable two-decimal format', () => {
    expect(GrowthProgress.fromProgress(0.5).toString()).toBe(
      'GrowthProgress(0.50: stem=0.75, leaf=0.40, flower=0.00)'
    );
  });
});

// ==================== CONSTRUCTION ====================

describe('Property: calculate is fromProgress of the raw timing progress', () => {
  it('rawGrowthProgress is exactly 1 from time >= delay + duration on, else (time - delay) / duration', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, anyDouble, (t, d, dur) => {
        const expected = t >= d + dur ? 1 : (t - d) / dur;
        expect(Object.is(rawGrowthProgress(t, d, dur), expected)).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('calculate(t, d, D, cfg) equals fromProgress(rawGrowthProgress(t, d, D), cfg) bit-for-bit', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, anyDouble, fc.option(configArb, { nil: undefined }), (t, d, dur, cfg) => {
        expect(sameFields(GrowthProgress.calculate(t, d, dur, cfg), GrowthProgress.fromProgress(rawGrowthProgress(t, d, dur), cfg))).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('a plant is exactly fully grown from its end time on (time >= delay + duration)', () => {
    fc.assert(
      fc.property(finite, fc.double({ min: Number.MIN_VALUE, max: 1e12, noNaN: true }), fc.double({ min: 0, max: 1e12, noNaN: true }), (d, dur, extra) => {
        const end = d + dur;
        fc.pre(Number.isFinite(end));
        const g = GrowthProgress.calculate(end + extra, d, dur);
        expect(g.progress).toBe(1);
        expect(g.isComplete).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('explicitly undefined config keys behave exactly like absent ones', () => {
    fc.assert(
      fc.property(unit, partialConfigArb, (p, partial) => {
        const stripped = Object.fromEntries(Object.entries(partial).filter(([, v]) => v !== undefined));
        expect(sameFields(GrowthProgress.fromProgress(p, partial), GrowthProgress.fromProgress(p, stripped))).toBe(true);
        expect(sameFields(
          GrowthProgress.fromProgress(p, partial),
          GrowthProgress.fromProgress(p, { ...GrowthProgress.defaultConfig, ...stripped })
        )).toBe(true);
      }),
      { numRuns: 5 }
    );
  });
});

describe('Property: every phase stays in [0, 1]', () => {
  it('for any finite time and delay, any finite duration (zero and negative included) and any config', () => {
    // Zero duration with time === delay is 0 / 0: the getters are documented
    // as (0-1), and NaN reaches the renderers as a non-finite coordinate.
    fc.assert(
      fc.property(finite, finite, finite, configArb, (t, d, dur, cfg) => {
        const g = GrowthProgress.calculate(t, d, dur, cfg);
        for (const k of FIELDS) {
          expect(g[k] >= 0 && g[k] <= 1, `${k} = ${g[k]}`).toBe(true);
        }
      }),
      { numRuns: 5, examples: [[100, 100, 0, GrowthProgress.defaultConfig]] }
    );
  });

  it('for any finite raw progress (fromProgress clamps out-of-range input)', () => {
    fc.assert(
      fc.property(finite, configArb, (p, cfg) => {
        const g = GrowthProgress.fromProgress(p, cfg);
        expect(g.progress).toBe(Math.max(0, Math.min(1, p)));
        for (const k of FIELDS) expect(g[k] >= 0 && g[k] <= 1, `${k} = ${g[k]}`).toBe(true);
      }),
      { numRuns: 5 }
    );
  });
});

// ==================== REFERENCE MODEL ====================

describe('Property: phases follow the documented linear ramps', () => {
  // GrowthConfig documents each phase as a rate multiplier on the progress
  // past its start, clamped to [0, 1]; stems start at 0. Foliage and plume
  // use the fixed GROWTH_PHASES constants.
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  it('stem/leaf/flower/foliage/plume equal the reference ramps for any config', () => {
    fc.assert(
      fc.property(unit, configArb, (p, cfg) => {
        const g = GrowthProgress.fromProgress(p, cfg);
        expect(g.stem).toBe(Math.min(1, p * cfg.stemRate));
        expect(g.leaf).toBe(clamp01((p - cfg.leafStart) * cfg.leafRate));
        expect(g.flower).toBe(clamp01((p - cfg.flowerStart) * cfg.flowerRate));
        expect(g.foliage).toBe(clamp01((p - GROWTH_PHASES.FOLIAGE_START) * GROWTH_PHASES.FOLIAGE_GROWTH_RATE));
        expect(g.plume).toBe(clamp01((p - GROWTH_PHASES.PLUME_START) / (1 - GROWTH_PHASES.PLUME_START)));
      }),
      { numRuns: 5 }
    );
  });
});

// ==================== PHASE ORDERING ====================

describe('Property: phase ordering laws', () => {
  it('every phase is monotone non-decreasing in progress, for any config', () => {
    fc.assert(
      fc.property(finite, finite, configArb, (a, b, cfg) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const g1 = GrowthProgress.fromProgress(lo, cfg);
        const g2 = GrowthProgress.fromProgress(hi, cfg);
        for (const k of FIELDS) expect(g1[k] <= g2[k], `${k}: ${g1[k]} > ${g2[k]}`).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('a phase that starts no later and grows no slower is never behind (leaf >= flower)', () => {
    // Construct configs in the ordered subset directly: leafStart <= flowerStart, leafRate >= flowerRate
    const ordered = fc
      .tuple(unit, unit, rate, rate, rate)
      .map(([s1, s2, r1, r2, stemRate]) => ({
        stemRate,
        leafStart: Math.min(s1, s2),
        flowerStart: Math.max(s1, s2),
        leafRate: Math.max(r1, r2),
        flowerRate: Math.min(r1, r2),
      }));
    fc.assert(
      fc.property(unit, ordered, (p, cfg) => {
        const g = GrowthProgress.fromProgress(p, cfg);
        expect(g.leaf).toBeGreaterThanOrEqual(g.flower);
      }),
      { numRuns: 5 }
    );
  });

  it('with the shipped constants, stem >= leaf >= flower at every progress', () => {
    fc.assert(
      fc.property(unit, (p) => {
        const g = GrowthProgress.fromProgress(p);
        expect(g.stem >= g.leaf && g.leaf >= g.flower, `${p}: ${fields(g)}`).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('leaf/flower are exactly 0 up to their start; plume is 0 up to PLUME_START and exactly 1 at completion', () => {
    fc.assert(
      fc.property(unit, configArb, (p, cfg) => {
        const g = GrowthProgress.fromProgress(p, cfg);
        if (p <= cfg.leafStart) expect(g.leaf).toBe(0);
        if (p <= cfg.flowerStart) expect(g.flower).toBe(0);
        if (p <= GROWTH_PHASES.PLUME_START) expect(g.plume).toBe(0);
        else expect(g.plume).toBeGreaterThan(0);
        if (p <= GROWTH_PHASES.FOLIAGE_START) expect(g.foliage).toBe(0);
      }),
      { numRuns: 5, examples: [[GROWTH_PHASES.PLUME_START, GrowthProgress.defaultConfig]] }
    );
    expect(GrowthProgress.fromProgress(1).plume).toBe(1);
  });
});

// ==================== SIBLING CALCULATORS ====================

describe('Property: legacy helpers agree with GrowthProgress', () => {
  it('calculateRawProgress is GrowthProgress.calculate(...).progress for every double input', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, anyDouble, (t, d, dur) => {
        expect(Object.is(calculateRawProgress(t, d, dur), GrowthProgress.calculate(t, d, dur).progress)).toBe(true);
      }),
      { numRuns: 5, examples: [[0, 0, 0]] }
    );
  });

  it('calculateGrowthPhases is null exactly when GrowthProgress is inactive, else the class phases bit-for-bit', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, anyDouble, (t, d, dur) => {
        const legacy = calculateGrowthPhases(t, d, dur);
        const modern = GrowthProgress.calculate(t, d, dur);
        if (!modern.isActive) {
          expect(legacy).toBeNull();
        } else {
          expect(legacy).not.toBeNull();
          for (const k of ['progress', 'stem', 'leaf', 'flower'] as const) {
            expect(Object.is(legacy![k], modern[k]), k).toBe(true);
          }
        }
      }),
      { numRuns: 5, examples: [[100, 100, 200], [1000, 0, 100], [0, 0, 0]] }
    );
  });

  it('isPlantActive(time, delay) agrees with GrowthProgress.isActive for any positive duration', () => {
    // calculateGrowthPhases and isActive both treat time === delay
    // (progress 0) as not yet active. isPlantActive has no duration, so the
    // contract is agreement wherever the duration is resolvable at this scale
    // (see the two preconditions).
    fc.assert(
      fc.property(finite, finite, fc.double({ min: Number.MIN_VALUE, noNaN: true, noDefaultInfinity: true }), (t, d, dur) => {
        fc.pre(!((t - d) / dur === 0 && t - d > 0)); // division underflow
        // A duration absorbed by the delay (d + dur === d) makes start and end
        // the same instant, which counts as grown; isPlantActive cannot know
        fc.pre(d + dur !== d);
        expect(isPlantActive(t, d)).toBe(GrowthProgress.calculate(t, d, dur).isActive);
      }),
      { numRuns: 5, examples: [[100, 100, 200]] }
    );
  });
});

// ==================== ACCESSORS AND HELPERS ====================

describe('Property: accessors are consistent', () => {
  it('toObject/toExtendedObject carry the getter values; flags are the documented predicates', () => {
    fc.assert(
      fc.property(anyDouble, configArb, (p, cfg) => {
        const g = GrowthProgress.fromProgress(p, cfg);
        expect(g.toExtendedObject()).toEqual(Object.fromEntries(FIELDS.map((k) => [k, g[k]])));
        expect(g.toObject()).toEqual({ progress: g.progress, stem: g.stem, leaf: g.leaf, flower: g.flower });
        expect(FLAGS.map((f) => g[f])).toEqual([
          g.progress > 0, g.progress >= 1, g.leaf > 0, g.flower > 0, g.foliage > 0, g.plume > 0,
        ]);
      }),
      { numRuns: 5 }
    );
  });

  it('clone preserves the instance exactly, custom config included', () => {
    fc.assert(
      fc.property(unit, configArb, (p, cfg) => {
        const g = GrowthProgress.fromProgress(p, cfg);
        const c = g.clone();
        expect(c).not.toBe(g);
        expect(sameFields(c, g)).toBe(true);
        expect(c.equals(g)).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('equals compares all six fields; approximatelyEquals is the strict per-field epsilon test', () => {
    fc.assert(
      fc.property(unit, configArb, unit, configArb, fc.double({ min: 0, max: 1, noNaN: true }), (p1, c1, p2, c2, eps) => {
        const a = GrowthProgress.fromProgress(p1, c1);
        const b = GrowthProgress.fromProgress(p2, c2);
        expect(a.equals(b)).toBe(FIELDS.every((k) => a[k] === b[k]));
        expect(a.approximatelyEquals(b, eps)).toBe(FIELDS.every((k) => Math.abs(a[k] - b[k]) < eps));
        // Strict: an epsilon equal to the largest field difference is not enough
        expect(a.approximatelyEquals(b, Math.max(...FIELDS.map((k) => Math.abs(a[k] - b[k]))))).toBe(false);
      }),
      { numRuns: 5 }
    );
  });

  it('isInRange(min, max) is min-inclusive and max-exclusive', () => {
    fc.assert(
      fc.property(unit, finite, finite, (p, min, max) => {
        expect(GrowthProgress.fromProgress(p).isInRange(min, max)).toBe(p >= min && p < max);
      }),
      { numRuns: 5, examples: [[0.5, 0.5, 0.6], [0.5, 0.4, 0.5]] }
    );
  });

  it('getPhaseProgress(start, end) saturates at the edges and is monotone in progress', () => {
    fc.assert(
      fc.property(unit, unit, unit, unit, (a, b, s1, s2) => {
        fc.pre(s1 !== s2);
        const [start, end] = s1 < s2 ? [s1, s2] : [s2, s1];
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const v1 = GrowthProgress.fromProgress(lo).getPhaseProgress(start, end);
        const v2 = GrowthProgress.fromProgress(hi).getPhaseProgress(start, end);
        expect(v1 >= 0 && v1 <= 1).toBe(true);
        expect(v1).toBeLessThanOrEqual(v2);
        if (lo <= start) expect(v1).toBe(0);
        if (hi >= end) expect(v2).toBe(1);
      }),
      { numRuns: 5 }
    );
  });
});

describe('Property: easing', () => {
  it.each(EASINGS)('%s maps [0, 1] onto [0, 1] with exact endpoints and is monotone', (easing) => {
    fc.assert(
      fc.property(unit, unit, (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const e1 = GrowthProgress.fromProgress(lo).eased(easing);
        const e2 = GrowthProgress.fromProgress(hi).eased(easing);
        expect(e1 >= 0 && e2 <= 1).toBe(true);
        expect(e1).toBeLessThanOrEqual(e2);
      }),
      {
        numRuns: 5,
        // Shrunk: t * (2 - t) rounds up to 1 just below t = 1, then back down
        examples: [[0.5, 0.5 - 2 ** -53], [0.9999999999996576, 0.9999999999999994]],
      }
    );
    expect(GrowthProgress.fromProgress(0).eased(easing)).toBe(0);
    expect(GrowthProgress.fromProgress(1).eased(easing)).toBe(1);
  });

  it('ease-in never leads and ease-out never lags linear; eased() defaults to linear', () => {
    fc.assert(
      fc.property(unit, (p) => {
        const g = GrowthProgress.fromProgress(p);
        expect(g.eased('ease-in')).toBeLessThanOrEqual(g.eased('linear'));
        expect(g.eased('ease-out')).toBeGreaterThanOrEqual(g.eased('linear'));
        expect(g.eased()).toBe(g.eased('linear'));
      }),
      { numRuns: 5 }
    );
  });

  it('easedStem/easedFlower apply the same easing to the phase value (default ease-out)', () => {
    fc.assert(
      fc.property(unit, configArb, fc.constantFrom(...EASINGS), (p, cfg, easing) => {
        const g = GrowthProgress.fromProgress(p, cfg);
        expect(g.easedStem(easing)).toBe(GrowthProgress.fromProgress(g.stem).eased(easing));
        expect(g.easedFlower(easing)).toBe(GrowthProgress.fromProgress(g.flower).eased(easing));
        expect(g.easedStem()).toBe(g.easedStem('ease-out'));
        expect(g.easedFlower()).toBe(g.easedFlower('ease-out'));
      }),
      { numRuns: 5 }
    );
  });
});
