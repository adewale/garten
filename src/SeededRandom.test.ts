import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SeededRandom, seededRandom, createRandom, pickRandom, randomRange } from './SeededRandom';
import * as utils from './utils';

// ==================== ARBITRARIES ====================

/**
 * The full seed domain: any double (negative, fractional, huge, subnormal,
 * -0, NaN, ±Infinity), with integers and the classic edge values boosted.
 */
/**
 * Seeds whose first draw sits at the very top of [0, 1): range bugs that
 * only show for u > 0.9999 are invisible to uniformly drawn seeds, so the
 * generator includes these directly (found by a ~5 ms scan).
 */
const TOP_DRAW_SEEDS = [152593, 155717, 238358, 241001];

const anySeed = fc.oneof(
  fc.double(),
  fc.integer(),
  fc.constantFrom(0, -0, 1, -1, 0.5, 2 ** 31, 2 ** 32, 2 ** 53, -(2 ** 53), 1e9, NaN, Infinity, -Infinity),
  fc.constantFrom(...TOP_DRAW_SEEDS)
);
const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
const drawCount = fc.integer({ min: 1, max: 20 });

/** Reference stream: the documented "auto-increment" over seededRandom */
/**
 * Documented seed normalization: non-finite -> 0; |seed| >= 2^53 (where
 * seed++ stops advancing) wraps into [0, 2^32), which hashSeed cannot tell
 * apart; every other seed is kept as is
 */
function normalizedSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 0;
  if (Math.abs(seed) < 2 ** 53) return seed;
  const m = BigInt(seed) % 2n ** 32n;
  return Number(m < 0n ? m + 2n ** 32n : m);
}

function referenceStream(seed: number, n: number): number[] {
  let s = seed;
  return Array.from({ length: n }, () => {
    const value = seededRandom(s);
    s = normalizedSeed(s + 1);
    return value;
  });
}

function draws(rand: () => number, n: number): number[] {
  return Array.from({ length: n }, () => rand());
}

/**
 * A SeededRandom that fails instead of hanging: a method that loops on
 * next() until it sees enough distinct values (pickMultiple) would spin
 * forever on a stuck stream, and a hang cannot be reported as a failure.
 */
class DrawBudget extends SeededRandom {
  private calls = 0;
  constructor(seed: number, private readonly budget: number) {
    super(seed);
  }
  next(): number {
    if (++this.calls > this.budget) throw new Error(`draw budget of ${this.budget} exceeded`);
    return super.next();
  }
}

/** Two generators in identical states, so one can serve as the oracle for the other */
function twins(seed: number): [SeededRandom, SeededRandom] {
  return [new SeededRandom(seed), new SeededRandom(seed)];
}

// ==================== GOLDEN VALUES (keep: shipped gardens depend on them) ====================

describe('Golden values (identical in every JS engine)', () => {
  it('seededRandom matches the pinned literals', () => {
    // Pinned literal outputs: the hash is pure 32-bit integer math, so any
    // engine must reproduce these bit-for-bit. A change here changes every
    // seeded garden users have shipped.
    expect(seededRandom(1)).toBe(0.5266567736398429);
    expect(seededRandom(12345)).toBe(0.5258435360156);
  });

  it('createRandom(42) matches the pinned literals', () => {
    // The README promises "same seed produces the same garden in every
    // engine"; these literals are the Node-side golden for that claim.
    const rand = createRandom(42);
    expect(Array.from({ length: 8 }, () => rand())).toEqual([
      0.156374619808048, 0.6335184210911393, 0.5499784420244396, 0.9933013359550387,
      0.8965381442103535, 0.24320829613134265, 0.7027762830257416, 0.7371317779179662,
    ]);
  });
});

// ==================== SIBLINGS ====================

describe('Property: the three RNG entry points agree on the same seed', () => {
  it('utils re-exports the SeededRandom implementations', () => {
    expect(utils.seededRandom).toBe(seededRandom);
    expect(utils.createRandom).toBe(createRandom);
    expect(utils.pickRandom).toBe(pickRandom);
    expect(utils.randomRange).toBe(randomRange);
  });

  it('createRandom(s) yields seededRandom(n), seededRandom(n + 1), ... for every finite seed', () => {
    // n is the normalized seed: s itself below 2^53, else s mod 2^32 (the
    // same hash input) so that the stream advances instead of repeating
    fc.assert(
      fc.property(finite, drawCount, (seed, n) => {
        expect(draws(createRandom(seed), n)).toEqual(referenceStream(normalizedSeed(seed), n));
      }),
      // Regression: at 2^53, seed++ was a no-op and every draw repeated
      { numRuns: 5, examples: [[2 ** 53, 3], [-(2 ** 53), 3], [Number.MAX_SAFE_INTEGER, 3]] }
    );
  });

  it('new SeededRandom(s).next() and createRandom(s) yield the same stream for every seed', () => {
    // The constructor normalizes non-finite seeds so they do not "silently
    // collapse to one stream"; createRandom must agree on the same input.
    fc.assert(
      fc.property(anySeed, drawCount, (seed, n) => {
        const rng = new SeededRandom(seed);
        expect(draws(() => rng.next(), n)).toEqual(draws(createRandom(seed), n));
      }),
      { numRuns: 5, examples: [[NaN, 3], [Infinity, 3], [Number.MAX_SAFE_INTEGER, 3]] }
    );
  });
});

describe('Property: distinct seeds give distinct streams', () => {
  it('two different 32-bit integer seeds never produce the same first four draws', () => {
    const seed32 = fc.integer({ min: -(2 ** 31), max: 2 ** 31 - 1 });
    fc.assert(
      fc.property(seed32, seed32, (a, b) => {
        fc.pre(a !== b);
        expect(draws(createRandom(a), 4)).not.toEqual(draws(createRandom(b), 4));
      }),
      { numRuns: 5 }
    );
  });
});

// ==================== RANGES OVER THE FULL SEED DOMAIN ====================

describe('Property: [0, 1) over the full seed domain', () => {
  it('the top-draw seed scan found its targets (generator sanity)', () => {
    expect(TOP_DRAW_SEEDS.length).toBeGreaterThan(0);
  });

  it('seededRandom(s) is in [0, 1) for every double, NaN and ±Infinity included', () => {
    fc.assert(
      fc.property(anySeed, (seed) => {
        const v = seededRandom(seed);
        expect(v >= 0 && v < 1, `${seed} -> ${v}`).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('every SeededRandom draw is in [0, 1)', () => {
    fc.assert(
      fc.property(anySeed, drawCount, (seed, n) => {
        const rng = new SeededRandom(seed);
        for (const v of draws(() => rng.next(), n)) expect(v >= 0 && v < 1).toBe(true);
      }),
      { numRuns: 5 }
    );
  });
});

describe('Property: derived ranges honor their documented bounds', () => {
  it('range(min, max) is in [min, max) for every finite min < max', () => {
    fc.assert(
      fc.property(anySeed, finite, finite, (seed, a, b) => {
        fc.pre(a !== b);
        const [min, max] = a < b ? [a, b] : [b, a];
        const v = new SeededRandom(seed).range(min, max);
        expect(v >= min && v < max, `[${min}, ${max}) -> ${v}`).toBe(true);
      }),
      {
        numRuns: 5,
        examples: [
          // min + u * (max - min) rounds up to max when the range is a few ulps wide
          [1, 1, 1 + 2 ** -52],
          // max - min overflows to Infinity and 0 * Infinity is NaN
          [0, -3.0935524797788157e293, 1.7976931348623127e308],
        ],
      }
    );
  });

  it('randomRange(min, max, rand) is in [min, max) for every finite min < max', () => {
    fc.assert(
      fc.property(anySeed, finite, finite, (seed, a, b) => {
        fc.pre(a !== b);
        const [min, max] = a < b ? [a, b] : [b, a];
        const v = randomRange(min, max, createRandom(seed));
        expect(v >= min && v < max, `[${min}, ${max}) -> ${v}`).toBe(true);
      }),
      { numRuns: 5, examples: [[1, 1, 1 + 2 ** -52], [-5e-324, 0, 5e-324]] }
    );
  });

  it('int(min, max) is an integer in [min, max] for every safe-integer min <= max', () => {
    const safe = fc.integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER });
    fc.assert(
      fc.property(anySeed, safe, safe, (seed, a, b) => {
        const [min, max] = a <= b ? [a, b] : [b, a];
        const v = new SeededRandom(seed).int(min, max);
        expect(Number.isInteger(v) && v >= min && v <= max, `[${min}, ${max}] -> ${v}`).toBe(true);
      }),
      {
        numRuns: 5,
        // Near 2^53 the ulp is 1, so min + u rounds up to max + 1. Failures
        // only exist at the very top of the range, which makes shrinking
        // crawl for minutes: report the first counterexample unshrunk.
        endOnFailure: true,
        examples: [[1, 9007199254740982, 9007199254740982]],
      }
    );
  });

  it('int(min, max) reaches every value of a small range', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: 0, max: 4 }), anySeed, (min, span, seed) => {
        const rng = new SeededRandom(seed);
        const seen = new Set(Array.from({ length: 400 }, () => rng.int(min, min + span)));
        expect(seen.size).toBe(span + 1);
      }),
      { numRuns: 5, examples: [[0, 1, 2 ** 53]] }
    );
  });

  it('below(n) is an integer in [0, n) for every positive safe integer n', () => {
    fc.assert(
      fc.property(anySeed, fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }), (seed, n) => {
        const v = new SeededRandom(seed).below(n);
        expect(Number.isInteger(v) && v >= 0 && v < n).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('centered(r) is in [-r, r] and around(c, r) in [c - r, c + r] for finite r >= 0', () => {
    const nonNeg = fc.double({ min: 0, noNaN: true, noDefaultInfinity: true });
    fc.assert(
      fc.property(anySeed, finite, nonNeg, (seed, c, r) => {
        const [a, b] = twins(seed);
        const centered = a.centered(r);
        expect(centered >= -r && centered <= r).toBe(true);
        const around = b.around(c, r);
        expect(around >= c - r && around <= c + r).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  // Unit-interval and geometric helpers: each documented range, one test per method
  const unitRanges: Array<[string, (r: SeededRandom) => boolean]> = [
    ['angle() in [0, 2pi)', (r) => { const v = r.angle(); return v >= 0 && v < 2 * Math.PI; }],
    ['degrees() in [0, 360)', (r) => { const v = r.degrees(); return v >= 0 && v < 360; }],
    ['centeredBias() in [0, 1)', (r) => { const v = r.centeredBias(); return v >= 0 && v < 1; }],
    ['edgeBias() in [0, 1]', (r) => { const v = r.edgeBias(); return v >= 0 && v <= 1; }],
    ['pointInCircle() within the unit disc', (r) => { const p = r.pointInCircle(); return p.x * p.x + p.y * p.y <= 1; }],
    ['pointOnCircle() on the unit circle', (r) => { const p = r.pointOnCircle(); return Math.abs(Math.hypot(p.x, p.y) - 1) <= 4 * Number.EPSILON; }],
    ['gaussian() is finite', (r) => Number.isFinite(r.gaussian())],
    ['sign() is exactly 1 or -1', (r) => { const v = r.sign(); return v === 1 || v === -1; }],
  ];
  it.each(unitRanges)('%s for every seed', (_name, holds) => {
    fc.assert(
      fc.property(anySeed, (seed) => {
        expect(holds(new SeededRandom(seed))).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('exponential(lambda) is >= 0 (finite when representable), biased(e) in [0, 1], for positive parameters', () => {
    const positive = fc.double({ min: Number.MIN_VALUE, max: 1e6, noNaN: true });
    fc.assert(
      fc.property(anySeed, positive, positive, (seed, lambda, e) => {
        const [a, b] = twins(seed);
        const x = a.exponential(lambda);
        expect(x >= 0, `exp(${lambda}) -> ${x}`).toBe(true);
        // -log(1 - u) <= 32 * ln 2 since u <= 1 - 2^-32; past that the true
        // value exceeds Number.MAX_VALUE and Infinity is the correct rounding
        if (lambda >= (32 * Math.LN2) / Number.MAX_VALUE * 2) expect(Number.isFinite(x)).toBe(true);
        const y = b.biased(e);
        expect(y >= 0 && y <= 1).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('pointInRect(w, h) is in [0, w] x [0, h] for positive w, h', () => {
    // The doc promises no half-open interval here (unlike range/angle), and
    // u * w rounds to w for subnormal w, so the closed rectangle is the contract
    const positive = fc.double({ min: Number.MIN_VALUE, max: 1e300, noNaN: true });
    fc.assert(
      fc.property(anySeed, positive, positive, (seed, w, h) => {
        const p = new SeededRandom(seed).pointInRect(w, h);
        expect(p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h).toBe(true);
      }),
      { numRuns: 5 }
    );
  });
});

// ==================== ONE DRAW, MANY SPELLINGS ====================

describe('Property: convenience methods are the documented function of one draw', () => {
  it('chance(p) is next() < p: always false for p <= 0, always true for p >= 1', () => {
    fc.assert(
      fc.property(anySeed, fc.double({ noNaN: true }), (seed, p) => {
        const [a, b] = twins(seed);
        expect(a.chance(p)).toBe(b.next() < p);
        if (p <= 0) expect(new SeededRandom(seed).chance(p)).toBe(false);
        if (p >= 1) expect(new SeededRandom(seed).chance(p)).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('bool() is chance(0.5) and sign() is bool() ? 1 : -1', () => {
    fc.assert(
      fc.property(anySeed, (seed) => {
        const [a, b] = twins(seed);
        const [c, d] = twins(seed);
        expect(a.bool()).toBe(b.chance(0.5));
        expect(c.sign()).toBe(d.bool() ? 1 : -1);
      }),
      { numRuns: 5 }
    );
  });

  it('pick(arr) is arr[pickIndex(arr)], an element of the array', () => {
    fc.assert(
      fc.property(anySeed, fc.array(fc.integer(), { minLength: 1, maxLength: 50 }), (seed, arr) => {
        const [a, b] = twins(seed);
        const i = b.pickIndex(arr);
        expect(Number.isInteger(i) && i >= 0 && i < arr.length).toBe(true);
        expect(a.pick(arr)).toBe(arr[i]);
      }),
      { numRuns: 5 }
    );
  });

  it('pickRandom(arr, rand) is an element of the array chosen by one draw', () => {
    fc.assert(
      fc.property(anySeed, fc.array(fc.integer(), { minLength: 1, maxLength: 50 }), (seed, arr) => {
        const u = createRandom(seed)();
        expect(pickRandom(arr, createRandom(seed))).toBe(arr[Math.floor(u * arr.length)]);
      }),
      { numRuns: 5 }
    );
  });

  it('reject: pick, pickIndex and weightedPick throw on an empty array', () => {
    fc.assert(
      fc.property(anySeed, (seed) => {
        const rng = new SeededRandom(seed);
        expect(() => rng.pick([])).toThrow(/empty/);
        expect(() => rng.pickIndex([])).toThrow(/empty/);
        expect(() => rng.weightedPick([])).toThrow(/empty/);
      }),
      { numRuns: 5 }
    );
  });
});

describe('Property: collection helpers', () => {
  const distinctArray = fc.uniqueArray(fc.integer(), { minLength: 0, maxLength: 40 });

  it('pickMultiple(arr, k) returns k distinct elements of arr for every 0 <= k <= length, in bounded draws', () => {
    // Picking k of n <= 40 takes about n * ln(n) draws on a working stream;
    // 10,000 is a generous termination bound
    fc.assert(
      fc.property(anySeed, distinctArray, fc.nat(), (seed, arr, k0) => {
        const k = arr.length === 0 ? 0 : k0 % (arr.length + 1);
        const picked = new DrawBudget(seed, 10_000).pickMultiple(arr, k);
        expect(picked).toHaveLength(k);
        expect(new Set(picked).size).toBe(k);
        for (const v of picked) expect(arr).toContain(v);
      }),
      // Shrunk: at |seed| >= 2^53, seed++ is a no-op, every draw is identical
      // and the uniqueness loop never terminates
      { numRuns: 5, examples: [[2 ** 53, [0, 1], 2], [Number.MAX_SAFE_INTEGER, [0, 1, 2], 3]] }
    );
  });

  it('reject: pickMultiple throws when k exceeds the array length', () => {
    fc.assert(
      fc.property(anySeed, distinctArray, fc.integer({ min: 1, max: 10 }), (seed, arr, extra) => {
        expect(() => new SeededRandom(seed).pickMultiple(arr, arr.length + extra)).toThrow(/exceeds/);
      }),
      { numRuns: 5 }
    );
  });

  it('shuffle permutes in place and returns the same array; shuffled copies without mutating', () => {
    fc.assert(
      fc.property(anySeed, fc.array(fc.integer(), { maxLength: 60 }), (seed, arr) => {
        const [a, b] = twins(seed);
        const original = [...arr];
        const copy = [...arr];
        expect(a.shuffle(copy)).toBe(copy);
        expect([...copy].sort((x, y) => x - y)).toEqual([...original].sort((x, y) => x - y));
        const out = b.shuffled(arr);
        expect(out).not.toBe(arr);
        expect(arr).toEqual(original);
        expect(out).toEqual(copy); // same state, same permutation
      }),
      { numRuns: 5 }
    );
  });

  it('weightedPick never returns an item whose weight is 0 when another weight is positive', () => {
    const weighted = fc.array(
      fc.record({ value: fc.nat(), weight: fc.oneof(fc.constant(0), fc.double({ min: 0, max: 1e6, noNaN: true })) }),
      { minLength: 1, maxLength: 10 }
    );
    fc.assert(
      fc.property(anySeed, weighted, (seed, items) => {
        fc.pre(items.some((i) => i.weight > 0));
        const tagged = items.map((item, idx) => ({ value: idx, weight: item.weight }));
        const idx = new SeededRandom(seed).weightedPick(tagged);
        expect(tagged[idx].weight, `picked index ${idx}`).toBeGreaterThan(0);
      }),
      // Seed 0 draws exactly 0.0, and roll - 0 <= 0 picks the leading zero-weight item
      { numRuns: 5, examples: [[0, [{ value: 0, weight: 0 }, { value: 1, weight: 1 }]]] }
    );
  });
});

// ==================== STATE ====================

describe('Property: state management', () => {
  it('seed/initialSeed report the normalized seed (non-finite becomes 0)', () => {
    fc.assert(
      fc.property(anySeed, (seed) => {
        const rng = new SeededRandom(seed);
        const expected = normalizedSeed(seed);
        expect(Object.is(rng.seed, expected) && Object.is(rng.initialSeed, expected)).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('getState/setState and reset() replay the stream exactly', () => {
    fc.assert(
      fc.property(anySeed, fc.nat({ max: 20 }), drawCount, (seed, before, n) => {
        const rng = new SeededRandom(seed);
        const fromStart = draws(() => rng.next(), before + n);
        rng.reset();
        draws(() => rng.next(), before);
        const state = rng.getState();
        const first = draws(() => rng.next(), n);
        rng.setState(state);
        expect(draws(() => rng.next(), n)).toEqual(first);
        expect(first).toEqual(fromStart.slice(before));
      }),
      { numRuns: 5 }
    );
  });

  it('setSeed(s) behaves exactly like new SeededRandom(s)', () => {
    fc.assert(
      fc.property(anySeed, anySeed, drawCount, (s1, s2, n) => {
        const rng = new SeededRandom(s1);
        rng.next();
        rng.setSeed(s2);
        const fresh = new SeededRandom(s2);
        expect(rng.getState()).toEqual(fresh.getState());
        expect(draws(() => rng.next(), n)).toEqual(draws(() => fresh.next(), n));
      }),
      { numRuns: 5 }
    );
  });

  it('skip(n) advances normalized numeric state without a per-draw loop', () => {
    fc.assert(
      fc.property(anySeed, fc.nat({ max: 50 }), drawCount, (seed, n, m) => {
        const [a, b] = twins(seed);
        a.skip(n);
        expect(a.seed).toBe(normalizedSeed(normalizedSeed(seed) + n));
        b.setSeed(normalizedSeed(seed) + n);
        expect(draws(() => a.next(), m)).toEqual(draws(() => b.next(), m));
      }),
      // Shrunk: at 2^53 next() is stuck (seed++ is a no-op) but skip(2) moves
      { numRuns: 5, examples: [[2 ** 53, 2, 1]] }
    );
    const rng = new SeededRandom(0);
    rng.skip(Number.MAX_SAFE_INTEGER);
    expect(rng.seed).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => rng.skip(Infinity)).toThrow(RangeError);
    expect(() => rng.skip(-1)).toThrow(RangeError);
    expect(() => rng.skip(0.5)).toThrow(RangeError);
  });

  it('fork is deterministic and consumes exactly one parent draw; createGenerator is a fork', () => {
    fc.assert(
      fc.property(anySeed, drawCount, (seed, n) => {
        const [a, b] = twins(seed);
        const [c, d] = twins(seed);
        const forkA = a.fork();
        const forkB = b.fork();
        expect(draws(() => forkA.next(), n)).toEqual(draws(() => forkB.next(), n));
        d.next();
        expect(draws(() => a.next(), n)).toEqual(draws(() => d.next(), n));
        const gen = c.createGenerator();
        const [e] = twins(seed);
        const forkE = e.fork();
        expect(draws(gen, n)).toEqual(draws(() => forkE.next(), n));
      }),
      { numRuns: 5 }
    );
  });

  it('fromString is deterministic and seeds with a non-negative 32-bit integer', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (s) => {
        const a = SeededRandom.fromString(s);
        const b = SeededRandom.fromString(s);
        expect(Number.isInteger(a.initialSeed) && a.initialSeed >= 0 && a.initialSeed <= 2 ** 31).toBe(true);
        expect(a.next()).toBe(b.next());
      }),
      { numRuns: 5 }
    );
  });

  it('SeededRandom.random() produces a usable generator', () => {
    const rng = SeededRandom.random();
    const v = rng.next();
    expect(v >= 0 && v < 1).toBe(true);
  });
});

// ==================== DISTRIBUTION SHAPE (pinned seed, documentation) ====================

describe('Distribution sanity at a pinned seed', () => {
  it('chance(0.8) is true about 80% of the time', () => {
    const rng = new SeededRandom(12345);
    const hits = Array.from({ length: 1000 }, () => rng.chance(0.8)).filter(Boolean).length;
    expect(hits / 1000).toBeGreaterThan(0.75);
    expect(hits / 1000).toBeLessThan(0.85);
  });

  it('weightedPick follows a 90/10 split', () => {
    const rng = new SeededRandom(12345);
    const items = [{ value: 'common', weight: 0.9 }, { value: 'rare', weight: 0.1 }];
    const common = Array.from({ length: 1000 }, () => rng.weightedPick(items)).filter((v) => v === 'common').length;
    expect(common / 1000).toBeGreaterThan(0.85);
    expect(common / 1000).toBeLessThan(0.95);
  });

  it('gaussian(mean, sd) has roughly the requested mean and spread', () => {
    const rng = new SeededRandom(12345);
    const xs = Array.from({ length: 2000 }, () => rng.gaussian(10, 2));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean - 10)).toBeLessThan(0.2);
    expect(Math.abs(sd - 2)).toBeLessThan(0.2);
  });

  it('biased(2) leans toward 0 and biased(0.5) toward 1', () => {
    const rng = new SeededRandom(12345);
    const mean = (e: number) => Array.from({ length: 1000 }, () => rng.biased(e)).reduce((a, b) => a + b, 0) / 1000;
    expect(mean(2)).toBeLessThan(0.4);
    expect(mean(0.5)).toBeGreaterThan(0.6);
  });
});
