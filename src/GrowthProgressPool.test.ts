import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  GrowthProgressPool,
  MutableGrowthProgress,
  getDefaultPool,
  resetDefaultPool,
  disposeDefaultPool,
} from './GrowthProgressPool';
import { GrowthProgress, type GrowthConfig } from './GrowthProgress';

// ==================== ARBITRARIES ====================

/** Every double: NaN, ±Infinity, -0, subnormals and extremes included */
const anyDouble = fc.double();
const anyConfig: fc.Arbitrary<GrowthConfig> = fc.record({
  stemRate: anyDouble,
  leafStart: anyDouble,
  leafRate: anyDouble,
  flowerStart: anyDouble,
  flowerRate: anyDouble,
});

const FIELDS = ['progress', 'stem', 'leaf', 'flower', 'foliage', 'plume'] as const;
const FLAGS = ['isActive', 'isComplete', 'hasLeaves', 'hasFlower', 'hasFoliage', 'hasPlume'] as const;

/** Bit-identical fields and identical flags */
function agrees(m: MutableGrowthProgress, g: GrowthProgress): boolean {
  return FIELDS.every((k) => Object.is(m[k], g[k])) && FLAGS.every((f) => m[f] === g[f]);
}

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // Dev-mode pools warn on lifecycle misuse; the properties below drive misuse on purpose
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

// ==================== MUTABLE vs IMMUTABLE ====================

describe('Property: MutableGrowthProgress agrees exactly with GrowthProgress', () => {
  it('calculateMut matches GrowthProgress.calculate bit-for-bit for every (time, delay, duration)', () => {
    // Hostile values included: negatives, zero duration (0/0 at time === delay), NaN, ±Infinity
    fc.assert(
      fc.property(anyDouble, anyDouble, anyDouble, (t, d, dur) => {
        expect(agrees(new MutableGrowthProgress().calculateMut(t, d, dur), GrowthProgress.calculate(t, d, dur))).toBe(true);
      }),
      { numRuns: 5, examples: [[100, 100, 0], [0, 0, 0], [NaN, 0, 1], [1, 0, -0]] }
    );
  });

  it('agreement holds for every config, on a reused (dirty) object, and through the pool', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, anyDouble, anyConfig, anyDouble, (t, d, dur, cfg, junk) => {
        const expected = GrowthProgress.calculate(t, d, dur, cfg);
        const dirty = new MutableGrowthProgress();
        for (const k of FIELDS) dirty[k] = junk;
        expect(agrees(dirty.calculateMut(t, d, dur, cfg), expected)).toBe(true);

        const pool = new GrowthProgressPool({ initialSize: 1, devMode: false });
        pool.beginFrame();
        expect(agrees(pool.acquireAndCalculate(t, d, dur, cfg), expected)).toBe(true);
        pool.endFrame();
      }),
      { numRuns: 5 }
    );
  });

  it('calculateMut and reset return the same instance; reset zeroes every field', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, anyDouble, (t, d, dur) => {
        const m = new MutableGrowthProgress();
        expect(m.calculateMut(t, d, dur)).toBe(m);
        expect(m.reset()).toBe(m);
        expect(FIELDS.map((k) => m[k])).toEqual([0, 0, 0, 0, 0, 0]);
      }),
      { numRuns: 5 }
    );
  });
});

// ==================== LIFECYCLE MODEL ====================

type Cmd =
  | { kind: 'begin' }
  | { kind: 'end' }
  | { kind: 'acquire'; count: number; time: number }
  | { kind: 'reset' };

const cmdArb: fc.Arbitrary<Cmd> = fc.oneof(
  { weight: 3, arbitrary: fc.constant({ kind: 'begin' as const }) },
  { weight: 3, arbitrary: fc.constant({ kind: 'end' as const }) },
  {
    weight: 5,
    arbitrary: fc.record({
      kind: fc.constant('acquire' as const),
      count: fc.integer({ min: 1, max: 40 }),
      time: fc.double({ min: -100, max: 2000, noNaN: true }),
    }),
  },
  { weight: 1, arbitrary: fc.constant({ kind: 'reset' as const }) }
);

/**
 * Pool config for the lifecycle model. growthFactor starts at 1.5 with
 * initialSize >= 2 so that floor(size * factor) > size: the growth-stall
 * region is owned by the capacity property below.
 */
const lifecycleConfig = fc.record({
  initialSize: fc.integer({ min: 2, max: 64 }),
  growthFactor: fc.double({ min: 1.5, max: 4, noNaN: true }),
  devMode: fc.boolean(),
  strictMode: fc.option(fc.boolean(), { nil: undefined }),
  shrinkThreshold: fc.double({ min: 0.01, max: 0.99, noNaN: true }),
  lowUsageFramesBeforeShrink: fc.integer({ min: 1, max: 5 }),
  maxSize: fc.constant(1_000_000),
});

describe('Property: frame lifecycle matches a reference model', () => {
  it('stats, frame numbers, history, resets and lifecycle errors follow the model for any command sequence', () => {
    fc.assert(
      fc.property(lifecycleConfig, fc.array(cmdArb, { maxLength: 60 }), (config, cmds) => {
        const pool = new GrowthProgressPool(config);
        const strict = config.strictMode ?? config.devMode;
        const throwOnAcquireOutside = config.devMode || strict;

        // Model
        let frame = 0, inFrame = false, acquired = 0, released = 0, peak = 0;
        let live: MutableGrowthProgress[] = [];
        let history: Array<[number, number]> = [];
        // currentFrameUsage keeps reporting the last frame's count after
        // endFrame (it is zeroed by the next beginFrame), so track it apart
        // from the live objects
        let usage = 0;

        const beginModel = () => { frame++; inFrame = true; live = []; usage = 0; };

        for (const cmd of cmds) {
          if (cmd.kind === 'begin') {
            if (inFrame && strict) {
              expect(() => pool.beginFrame()).toThrow(/already in frame/);
            } else {
              pool.beginFrame();
              beginModel();
            }
          } else if (cmd.kind === 'end') {
            if (!inFrame) {
              if (strict) expect(() => pool.endFrame()).toThrow(/outside of frame/);
              else pool.endFrame(); // documented no-op
            } else {
              const sizeBefore = pool.getStats().poolSize;
              pool.endFrame();
              const usage = live.length;
              peak = Math.max(peak, usage);
              released += usage;
              history.push([frame, usage]);
              inFrame = false;
              // Auto-release: every object handed out this frame is reset
              for (const obj of live) expect(FIELDS.map((k) => obj[k])).toEqual([0, 0, 0, 0, 0, 0]);
              // Never shrink after a frame that used at least the threshold fraction
              if (usage / sizeBefore >= config.shrinkThreshold) {
                expect(pool.getStats().poolSize).toBe(sizeBefore);
              }
              live = [];
            }
          } else if (cmd.kind === 'acquire') {
            if (!inFrame && throwOnAcquireOutside) {
              expect(() => pool.acquire()).toThrow(/outside of frame/);
            } else {
              if (!inFrame) beginModel(); // non-strict production self-heals
              for (let i = 0; i < cmd.count; i++) {
                const obj = pool.acquireAndCalculate(cmd.time + i, 0, 1000);
                expect(obj).toBeInstanceOf(MutableGrowthProgress);
                expect(live.includes(obj), 'object handed out twice in one frame').toBe(false);
                expect(agrees(obj, GrowthProgress.calculate(cmd.time + i, 0, 1000))).toBe(true);
                live.push(obj);
                usage++;
                acquired++;
              }
            }
          } else {
            pool.reset();
            frame = 0; inFrame = false; acquired = 0; released = 0; peak = 0;
            live = []; history = []; usage = 0;
            expect(pool.getStats().poolSize).toBe(config.initialSize);
          }

          const stats = pool.getStats();
          expect({
            acquired: stats.acquired, released: stats.released, peakUsage: stats.peakUsage,
            currentFrameUsage: stats.currentFrameUsage, frame: pool.getFrameNumber(), inFrame: pool.isInFrame(),
          }).toEqual({
            acquired, released, peakUsage: peak, currentFrameUsage: usage, frame, inFrame,
          });
          expect(stats.poolSize).toBeGreaterThanOrEqual(Math.max(config.initialSize, live.length));
          const h = pool.getFrameHistory();
          expect(h.map((e) => [e.frameNumber, e.usage])).toEqual(history.slice(-60));
          for (let i = 1; i < h.length; i++) expect(h[i].timestamp).toBeGreaterThanOrEqual(h[i - 1].timestamp);
        }
      }),
      { numRuns: 5 }
    );
  });

  it('frame history keeps the latest 60 frames in chronological order', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), (frames) => {
        const pool = new GrowthProgressPool({ initialSize: 4, devMode: false });
        for (let f = 0; f < frames; f++) {
          pool.beginFrame();
          for (let i = 0; i < f % 3; i++) pool.acquire();
          pool.endFrame();
        }
        const h = pool.getFrameHistory();
        const first = Math.max(1, frames - 59);
        expect(h.map((e) => e.frameNumber)).toEqual(Array.from({ length: frames - first + 1 }, (_, i) => first + i));
        expect(h.map((e) => e.usage)).toEqual(h.map((e) => (e.frameNumber - 1) % 3));
      }),
      { numRuns: 5 }
    );
  });
});

// ==================== CAPACITY ====================

describe('Property: capacity at and beyond maxSize', () => {
  it('a frame can hold exactly maxSize distinct objects; one more throws', () => {
    // Documented: maxSize is the "Maximum pool size - throws if exceeded".
    // maxSize is bounded where it is materialized (one object per slot).
    const capacityConfig = fc
      .integer({ min: 1, max: 3000 })
      .chain((maxSize) =>
        fc.record({
          maxSize: fc.constant(maxSize),
          initialSize: fc.integer({ min: 1, max: maxSize }),
          growthFactor: fc.double({ min: 1.1, max: 4, noNaN: true }),
        })
      );
    fc.assert(
      fc.property(capacityConfig, (config) => {
        const pool = new GrowthProgressPool({ ...config, devMode: false, strictMode: false });
        pool.beginFrame();
        const seen = new Set<MutableGrowthProgress>();
        for (let i = 0; i < config.maxSize; i++) {
          const obj = pool.acquire();
          expect(obj, `acquire #${i + 1} of ${config.maxSize}`).toBeInstanceOf(MutableGrowthProgress);
          seen.add(obj);
        }
        expect(seen.size).toBe(config.maxSize);
        expect(() => pool.acquire()).toThrow(/Maximum size/);
      }),
      {
        numRuns: 5,
        examples: [
          // floor(1 * 1.1) === 1: the pool never grows and acquire() returns undefined
          [{ maxSize: 2, initialSize: 1, growthFactor: 1.1 }],
          // 1000 -> 2000 -> 4000 overshoots maxSize 3000 and throws at 2001 objects
          [{ maxSize: 3000, initialSize: 1000, growthFactor: 2 }],
        ],
      }
    );
  });

  it('the shipped default pool covers the worst legal configuration (32,768 objects)', () => {
    const pool = new GrowthProgressPool({ devMode: false });
    pool.beginFrame();
    for (let i = 0; i < 32768; i++) pool.acquire();
    expect(pool.getStats().poolSize).toBe(32768);
    expect(() => pool.acquire()).toThrow(/Maximum size 32768 exceeded/);
  });

  it('the constructor sanitizes any numeric config and the pool then serves a frame', () => {
    // Sizes are bounded where materialized: the constructor pre-allocates initialSize objects
    const knob = fc.option(
      fc.oneof(fc.double({ min: -1e4, max: 1e4 }), fc.constantFrom(NaN, Infinity, -Infinity, 0, -0, 0.5, 1.5)),
      { nil: undefined }
    );
    fc.assert(
      fc.property(
        fc.record({
          initialSize: knob,
          growthFactor: knob,
          maxSizeWarning: knob,
          maxSize: knob,
          shrinkThreshold: knob,
          lowUsageFramesBeforeShrink: knob,
          devMode: fc.boolean(),
        }, { requiredKeys: ['devMode'] }),
        (config) => {
          const pool = new GrowthProgressPool(config);
          pool.beginFrame();
          expect(pool.acquire()).toBeInstanceOf(MutableGrowthProgress);
          pool.endFrame();
          expect(Number.isInteger(pool.getStats().poolSize)).toBe(true);
        }
      ),
      // new Array(1.5) throws RangeError: fractional sizes are not rounded
      { numRuns: 5, examples: [[{ initialSize: 1.5, devMode: false }]] }
    );
  });
});

// ==================== EXAMPLES (diagnostics and singletons) ====================

describe('GrowthProgressPool examples', () => {
  it('defaults to 1024 pre-allocated objects', () => {
    expect(new GrowthProgressPool({ devMode: false }).getStats().poolSize).toBe(1024);
  });

  it('grows by the growth factor when exhausted', () => {
    const pool = new GrowthProgressPool({ initialSize: 4, growthFactor: 3, devMode: false });
    pool.beginFrame();
    for (let i = 0; i < 5; i++) pool.acquire();
    expect(pool.getStats()).toMatchObject({ poolSize: 12, growthEvents: 1 });
    pool.endFrame();
  });

  it('allocates nothing after warm-up: sustained frames reuse the same instances', () => {
    const pool = new GrowthProgressPool({ initialSize: 10, devMode: true });
    const PER_FRAME = 500;
    pool.beginFrame();
    const warmUp = new Set<MutableGrowthProgress>();
    for (let i = 0; i < PER_FRAME; i++) warmUp.add(pool.acquireAndCalculate(i, 0, 1000));
    pool.endFrame();
    const { poolSize, growthEvents } = pool.getStats();
    for (let frame = 0; frame < 50; frame++) {
      pool.beginFrame();
      for (let i = 0; i < PER_FRAME; i++) {
        if (!warmUp.has(pool.acquireAndCalculate(frame * 16 + i, 0, 1000))) {
          throw new Error(`frame ${frame} acquire ${i} returned a new object`);
        }
      }
      pool.endFrame();
    }
    expect(pool.getStats()).toMatchObject({ poolSize, growthEvents });
  });

  it('shrinks after sustained low usage, but never below the initial size', () => {
    const pool = new GrowthProgressPool({
      initialSize: 64, devMode: false, shrinkThreshold: 0.25, lowUsageFramesBeforeShrink: 5,
    });
    pool.beginFrame();
    for (let i = 0; i < 200; i++) pool.acquire();
    pool.endFrame();
    const grown = pool.getStats().poolSize;
    for (let f = 0; f < 40; f++) {
      pool.beginFrame();
      pool.acquire();
      pool.endFrame();
    }
    expect(pool.getStats().poolSize).toBeLessThan(grown);
    expect(pool.getStats().poolSize).toBe(64);
  });

  it('warns (without throwing) on lifecycle misuse in dev mode without strict mode', () => {
    const pool = new GrowthProgressPool({ initialSize: 10, devMode: true, strictMode: false });
    pool.beginFrame();
    pool.beginFrame();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already in frame'));
    pool.endFrame();
    pool.endFrame();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('outside of frame'));
  });

  it('validateObject detects use-after-release and foreign objects in dev mode', () => {
    const pool = new GrowthProgressPool({ initialSize: 10, devMode: true });
    const other = new GrowthProgressPool({ initialSize: 10, devMode: true });
    pool.beginFrame();
    other.beginFrame();
    const obj = pool.acquire();
    expect(pool.validateObject(obj)).toBe(true);
    expect(() => other.validateObject(obj)).toThrow(/not from this pool/);
    pool.endFrame();
    pool.beginFrame();
    expect(() => pool.validateObject(obj)).toThrow(/Use-after-release/);
    pool.endFrame();
    other.endFrame();
    expect(new GrowthProgressPool({ initialSize: 1, devMode: false }).validateObject(obj)).toBe(true);
  });

  it('detectLeaks reports objects from a frame that was never ended', () => {
    const pool = new GrowthProgressPool({ initialSize: 10, devMode: true, strictMode: false });
    pool.beginFrame();
    pool.acquire();
    pool.endFrame();
    expect(pool.detectLeaks()).toEqual([]);

    pool.beginFrame(); // frame 2
    pool.acquire();
    pool.beginFrame(); // frame 3 without ending frame 2
    const leaks = pool.detectLeaks();
    expect(leaks).toHaveLength(1);
    expect(leaks[0].frameAcquired).toBe(2);
    pool.endFrame();
    expect(new GrowthProgressPool({ initialSize: 1, devMode: false }).detectLeaks()).toEqual([]);
  });

  it('isolates state between pool instances', () => {
    const a = new GrowthProgressPool({ initialSize: 10, devMode: true });
    const b = new GrowthProgressPool({ initialSize: 10, devMode: true });
    a.beginFrame();
    b.beginFrame();
    expect(a.acquire()).not.toBe(b.acquire());
    a.endFrame();
    expect(a.isInFrame()).toBe(false);
    expect(b.isInFrame()).toBe(true);
    b.endFrame();
  });
});

describe('Default pool', () => {
  beforeEach(() => {
    resetDefaultPool();
  });

  it('is a lazily created singleton that resetDefaultPool resets in place', () => {
    const pool = getDefaultPool();
    expect(getDefaultPool()).toBe(pool);
    pool.beginFrame();
    pool.acquire();
    pool.endFrame();
    expect(pool.getStats().acquired).toBe(1);
    resetDefaultPool();
    expect(pool.getStats().acquired).toBe(0);
  });

  it('disposeDefaultPool makes the next getDefaultPool create a fresh instance', () => {
    const first = getDefaultPool();
    first.beginFrame();
    first.acquire();
    first.endFrame();
    disposeDefaultPool();
    const second = getDefaultPool();
    expect(second).not.toBe(first);
    expect(second.getStats().acquired).toBe(0);
  });
});
