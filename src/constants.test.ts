/**
 * Cross-constant invariant tests.
 *
 * Magic numbers chosen independently drift out of agreement (the v1.0.x
 * seed-stride collision and the pool-cap-vs-OPTION_BOUNDS crash were both
 * "individually plausible constants, never checked against each other").
 * These tests make the relationships explicit and executable.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  OPTION_BOUNDS,
  PLANTS_PER_GENERATION,
  ANIMATION,
  LAYOUT,
  GROWTH_PHASES,
  VARIATION_DEFAULTS,
  COMPLEXITY,
} from './constants';
import {
  GEN_SEED_STRIDE,
  PLANT_SEED_STRIDE,
  GEN_COUNT_SEED_OFFSET,
  MAX_RNG_DRAWS_PER_PLANT,
  generatePlants,
} from './plants/generator';
import { resolveOptions } from './defaults';

/**
 * Draw counter: every stream handed out by createRandom() is wrapped so the
 * number of draws consumed per seed can be measured, not assumed.
 */
const rngDraws = vi.hoisted(() => new Map<number, number>());

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    createRandom: (initialSeed: number) => {
      const rand = actual.createRandom(initialSeed);
      rngDraws.set(initialSeed, 0);
      return () => {
        rngDraws.set(initialSeed, (rngDraws.get(initialSeed) ?? 0) + 1);
        return rand();
      };
    },
  };
});

describe('Constraint: option bounds are well-formed', () => {
  it.each(Object.entries(OPTION_BOUNDS))('%s has min < max', (_key, bounds) => {
    expect(bounds.min).toBeLessThan(bounds.max);
    expect(Number.isFinite(bounds.min)).toBe(true);
    expect(Number.isFinite(bounds.max)).toBe(true);
  });

  it('every default lies within its bounds', () => {
    const pairs: Array<[number, { min: number; max: number }]> = [
      [ANIMATION.DEFAULT_DURATION, OPTION_BOUNDS.DURATION],
      [ANIMATION.DEFAULT_GENERATIONS, OPTION_BOUNDS.GENERATIONS],
      [ANIMATION.DEFAULT_TARGET_FPS, OPTION_BOUNDS.TARGET_FPS],
      [ANIMATION.DEFAULT_MAX_PIXEL_RATIO, OPTION_BOUNDS.MAX_PIXEL_RATIO],
      [LAYOUT.DEFAULT_MAX_HEIGHT, OPTION_BOUNDS.MAX_HEIGHT],
    ];
    for (const [value, { min, max }] of pairs) {
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
    }
  });
});

describe('Constraint: density configuration is well-formed', () => {
  it.each(Object.entries(PLANTS_PER_GENERATION))(
    '%s range is positive and ordered',
    (_density, [min, max]) => {
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThanOrEqual(min);
    }
  );
});

describe('Constraint: seed strides cannot collide', () => {
  const maxPlantsPerGen = Math.max(
    ...Object.values(PLANTS_PER_GENERATION).map(([, max]) => max)
  );
  const largestPlantOffset =
    (maxPlantsPerGen - 1) * PLANT_SEED_STRIDE + MAX_RNG_DRAWS_PER_PLANT;

  it('generation stride exceeds every per-plant offset (no cross-generation reuse)', () => {
    expect(GEN_SEED_STRIDE).toBeGreaterThan(largestPlantOffset);
  });

  it('generation-count RNG sits clear of all plant streams', () => {
    expect(GEN_COUNT_SEED_OFFSET).toBeGreaterThan(largestPlantOffset);
    expect(GEN_COUNT_SEED_OFFSET + MAX_RNG_DRAWS_PER_PLANT).toBeLessThan(GEN_SEED_STRIDE);
  });

  it('measured per-plant RNG draws <= MAX_RNG_DRAWS_PER_PLANT <= PLANT_SEED_STRIDE', () => {
    // createRandom(s) consumes seeds s, s+1, ... so a plant stream that draws
    // more than PLANT_SEED_STRIDE values runs into its neighbor's stream.
    // Measure the worst legal garden (lush, max generations, full height,
    // every category) over several seeds rather than trusting a comment.
    let maxPlantDraws = 0;
    let maxGenCountDraws = 0;
    let plantStreams = 0;
    for (const seed of [1, 42, 4242]) {
      rngDraws.clear();
      const plants = generatePlants(
        resolveOptions({
          container: document.createElement('div'),
          seed,
          density: 'lush',
          generations: OPTION_BOUNDS.GENERATIONS.max,
          maxHeight: OPTION_BOUNDS.MAX_HEIGHT.max,
        })
      );
      const plantSeeds = new Set(plants.map((p) => p.seed));
      for (const [streamSeed, draws] of rngDraws) {
        if (plantSeeds.has(streamSeed)) {
          maxPlantDraws = Math.max(maxPlantDraws, draws);
          plantStreams++;
        } else {
          maxGenCountDraws = Math.max(maxGenCountDraws, draws);
        }
      }
      expect(plantSeeds.size).toBe(plants.length);
    }

    // The wrapper really observed the generator's streams
    expect(plantStreams).toBeGreaterThan(1000);
    expect(maxPlantDraws).toBeGreaterThan(0);
    expect(maxPlantDraws).toBeLessThanOrEqual(MAX_RNG_DRAWS_PER_PLANT);
    expect(maxGenCountDraws).toBeLessThanOrEqual(MAX_RNG_DRAWS_PER_PLANT);
    expect(MAX_RNG_DRAWS_PER_PLANT).toBeLessThanOrEqual(PLANT_SEED_STRIDE);
  });

  it('worst legal garden stays within safe integer seed range', () => {
    const worstSeed =
      OPTION_BOUNDS.SEED.max +
      OPTION_BOUNDS.GENERATIONS.max * GEN_SEED_STRIDE +
      largestPlantOffset;
    expect(worstSeed).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });
});

describe('Constraint: growth phase constants are coherent', () => {
  it('phase start thresholds lie in [0, 1)', () => {
    for (const key of ['LEAF_START', 'FLOWER_START', 'FOLIAGE_START', 'PLUME_START'] as const) {
      expect(GROWTH_PHASES[key]).toBeGreaterThanOrEqual(0);
      expect(GROWTH_PHASES[key]).toBeLessThan(1);
    }
  });

  it('growth rates are positive', () => {
    for (const key of [
      'STEM_GROWTH_RATE',
      'LEAF_GROWTH_RATE',
      'FLOWER_GROWTH_RATE',
      'FOLIAGE_GROWTH_RATE',
    ] as const) {
      expect(GROWTH_PHASES[key]).toBeGreaterThan(0);
    }
  });

  it('leaves start before flowers', () => {
    expect(GROWTH_PHASES.LEAF_START).toBeLessThan(GROWTH_PHASES.FLOWER_START);
  });
});

describe('Constraint: variation and complexity defaults are sane', () => {
  it('default multipliers are positive and complexity is a fraction', () => {
    expect(VARIATION_DEFAULTS.SIZE_MULTIPLIER).toBeGreaterThan(0);
    expect(VARIATION_DEFAULTS.HEIGHT_MULTIPLIER).toBeGreaterThan(0);
    expect(VARIATION_DEFAULTS.THICKNESS_MULTIPLIER).toBeGreaterThan(0);
    expect(VARIATION_DEFAULTS.COMPLEXITY).toBeGreaterThanOrEqual(0);
    expect(VARIATION_DEFAULTS.COMPLEXITY).toBeLessThanOrEqual(1);
  });

  it('complexity thresholds are fractions', () => {
    for (const value of Object.values(COMPLEXITY)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
