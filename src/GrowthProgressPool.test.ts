import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GrowthProgressPool,
  MutableGrowthProgress,
  getDefaultPool,
  resetDefaultPool,
} from './GrowthProgressPool';
import { GROWTH_PHASES } from './constants';
import { GrowthProgress } from './GrowthProgress';

describe('MutableGrowthProgress', () => {
  describe('calculateMut', () => {
    it('should calculate correct stem phase', () => {
      const gp = new MutableGrowthProgress();
      gp.calculateMut(600, 100, 1000); // progress = 0.5

      expect(gp.progress).toBe(0.5);
      expect(gp.stem).toBe(Math.min(1, 0.5 * GROWTH_PHASES.STEM_GROWTH_RATE));
    });

    it('should calculate correct leaf phase', () => {
      const gp = new MutableGrowthProgress();
      gp.calculateMut(500, 100, 1000); // progress = 0.4

      const expectedLeaf = Math.max(
        0,
        Math.min(1, (0.4 - GROWTH_PHASES.LEAF_START) * GROWTH_PHASES.LEAF_GROWTH_RATE)
      );
      expect(gp.leaf).toBeCloseTo(expectedLeaf);
    });

    it('should calculate correct flower phase', () => {
      const gp = new MutableGrowthProgress();
      gp.calculateMut(800, 100, 1000); // progress = 0.7

      const expectedFlower = Math.max(
        0,
        Math.min(1, (0.7 - GROWTH_PHASES.FLOWER_START) * GROWTH_PHASES.FLOWER_GROWTH_RATE)
      );
      expect(gp.flower).toBeCloseTo(expectedFlower);
    });

    it('should clamp progress to [0, 1]', () => {
      const gp = new MutableGrowthProgress();

      gp.calculateMut(50, 100, 1000); // progress = -0.05
      expect(gp.progress).toBe(0);

      gp.calculateMut(1500, 100, 1000); // progress = 1.4
      expect(gp.progress).toBe(1);
    });

    it('should return this for chaining', () => {
      const gp = new MutableGrowthProgress();
      const result = gp.calculateMut(500, 100, 1000);
      expect(result).toBe(gp);
    });

    it('should calculate foliage phase', () => {
      const gp = new MutableGrowthProgress();
      gp.calculateMut(700, 100, 1000); // progress = 0.6

      const expectedFoliage = Math.max(
        0,
        (0.6 - GROWTH_PHASES.FOLIAGE_START) * GROWTH_PHASES.FOLIAGE_GROWTH_RATE
      );
      expect(gp.foliage).toBeCloseTo(expectedFoliage);
    });

    it('should calculate plume phase', () => {
      const gp = new MutableGrowthProgress();
      gp.calculateMut(1000, 100, 1000); // progress = 0.9

      const expectedPlume =
        (0.9 - GROWTH_PHASES.PLUME_START) / (1 - GROWTH_PHASES.PLUME_START);
      expect(gp.plume).toBeCloseTo(expectedPlume);
    });

    it('should return zero plume when progress is below threshold', () => {
      const gp = new MutableGrowthProgress();
      gp.calculateMut(500, 100, 1000); // progress = 0.4
      expect(gp.plume).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all values to zero', () => {
      const gp = new MutableGrowthProgress();
      gp.calculateMut(800, 100, 1000);
      gp.reset();

      expect(gp.progress).toBe(0);
      expect(gp.stem).toBe(0);
      expect(gp.leaf).toBe(0);
      expect(gp.flower).toBe(0);
      expect(gp.foliage).toBe(0);
      expect(gp.plume).toBe(0);
    });

    it('should return this for chaining', () => {
      const gp = new MutableGrowthProgress();
      const result = gp.reset();
      expect(result).toBe(gp);
    });
  });

  describe('boolean getters', () => {
    it('should return correct isActive', () => {
      const gp = new MutableGrowthProgress();
      gp.progress = 0;
      expect(gp.isActive).toBe(false);
      gp.progress = 0.1;
      expect(gp.isActive).toBe(true);
    });

    it('should return correct isComplete', () => {
      const gp = new MutableGrowthProgress();
      gp.progress = 0.99;
      expect(gp.isComplete).toBe(false);
      gp.progress = 1;
      expect(gp.isComplete).toBe(true);
    });

    it('should return correct hasLeaves', () => {
      const gp = new MutableGrowthProgress();
      gp.leaf = 0;
      expect(gp.hasLeaves).toBe(false);
      gp.leaf = 0.01;
      expect(gp.hasLeaves).toBe(true);
    });

    it('should return correct hasFlower', () => {
      const gp = new MutableGrowthProgress();
      gp.flower = 0;
      expect(gp.hasFlower).toBe(false);
      gp.flower = 0.01;
      expect(gp.hasFlower).toBe(true);
    });

    it('should return correct hasFoliage', () => {
      const gp = new MutableGrowthProgress();
      gp.foliage = 0;
      expect(gp.hasFoliage).toBe(false);
      gp.foliage = 0.01;
      expect(gp.hasFoliage).toBe(true);
    });

    it('should return correct hasPlume', () => {
      const gp = new MutableGrowthProgress();
      gp.plume = 0;
      expect(gp.hasPlume).toBe(false);
      gp.plume = 0.01;
      expect(gp.hasPlume).toBe(true);
    });
  });
});

describe('GrowthProgressPool', () => {
  let pool: GrowthProgressPool;

  beforeEach(() => {
    pool = new GrowthProgressPool({ initialSize: 10, devMode: true });
  });

  describe('constructor', () => {
    it('should create pool with specified initial size', () => {
      const stats = pool.getStats();
      expect(stats.poolSize).toBe(10);
    });

    it('should default to 1024 initial size', () => {
      const defaultPool = new GrowthProgressPool({ devMode: false });
      expect(defaultPool.getStats().poolSize).toBe(1024);
    });

    it('should initialize all statistics to zero', () => {
      const stats = pool.getStats();
      expect(stats.acquired).toBe(0);
      expect(stats.released).toBe(0);
      expect(stats.peakUsage).toBe(0);
      expect(stats.growthEvents).toBe(0);
      expect(stats.currentFrameUsage).toBe(0);
    });
  });

  describe('beginFrame / endFrame', () => {
    it('should track frame number', () => {
      expect(pool.getFrameNumber()).toBe(0);
      pool.beginFrame();
      pool.endFrame();
      expect(pool.getFrameNumber()).toBe(1);
    });

    it('should increment frame number on each beginFrame', () => {
      pool.beginFrame();
      pool.endFrame();
      pool.beginFrame();
      pool.endFrame();
      pool.beginFrame();
      pool.endFrame();
      expect(pool.getFrameNumber()).toBe(3);
    });

    it('should track inFrame state', () => {
      expect(pool.isInFrame()).toBe(false);
      pool.beginFrame();
      expect(pool.isInFrame()).toBe(true);
      pool.endFrame();
      expect(pool.isInFrame()).toBe(false);
    });

    it('should reset all acquired objects on endFrame', () => {
      pool.beginFrame();
      const obj1 = pool.acquire();
      const obj2 = pool.acquire();
      obj1.calculateMut(500, 0, 1000);
      obj2.calculateMut(800, 0, 1000);

      expect(obj1.progress).toBe(0.5);
      expect(obj2.progress).toBe(0.8);

      pool.endFrame();

      // Objects should be reset
      expect(obj1.progress).toBe(0);
      expect(obj2.progress).toBe(0);
    });

    it('should reset acquire index on beginFrame', () => {
      pool.beginFrame();
      pool.acquire();
      pool.acquire();
      expect(pool.getStats().currentFrameUsage).toBe(2);
      pool.endFrame();

      pool.beginFrame();
      expect(pool.getStats().currentFrameUsage).toBe(0);
      pool.endFrame();
    });
  });

  describe('acquire', () => {
    it('should throw if called outside frame (dev mode)', () => {
      expect(() => pool.acquire()).toThrow(/outside of frame/);
    });

    it('should return MutableGrowthProgress instance', () => {
      pool.beginFrame();
      const obj = pool.acquire();
      expect(obj).toBeInstanceOf(MutableGrowthProgress);
      pool.endFrame();
    });

    it('should reuse objects across frames', () => {
      pool.beginFrame();
      const first = pool.acquire();
      const firstRef = first;
      pool.endFrame();

      pool.beginFrame();
      const second = pool.acquire();
      expect(second).toBe(firstRef);
      pool.endFrame();
    });

    it('should provide distinct objects within same frame', () => {
      pool.beginFrame();
      const obj1 = pool.acquire();
      const obj2 = pool.acquire();
      expect(obj1).not.toBe(obj2);
      pool.endFrame();
    });

    it('should increment currentFrameUsage', () => {
      pool.beginFrame();
      expect(pool.getStats().currentFrameUsage).toBe(0);
      pool.acquire();
      expect(pool.getStats().currentFrameUsage).toBe(1);
      pool.acquire();
      expect(pool.getStats().currentFrameUsage).toBe(2);
      pool.endFrame();
    });
  });

  describe('acquireAndCalculate', () => {
    it('should acquire and calculate in one step', () => {
      pool.beginFrame();
      const obj = pool.acquireAndCalculate(500, 0, 1000);
      expect(obj.progress).toBe(0.5);
      pool.endFrame();
    });

    it('should return the acquired object', () => {
      pool.beginFrame();
      const obj = pool.acquireAndCalculate(500, 0, 1000);
      expect(obj).toBeInstanceOf(MutableGrowthProgress);
      pool.endFrame();
    });
  });

  describe('pool growth', () => {
    it('should grow when exhausted', () => {
      const smallPool = new GrowthProgressPool({
        initialSize: 2,
        growthFactor: 2,
        devMode: false,
      });
      smallPool.beginFrame();

      smallPool.acquire();
      smallPool.acquire();
      expect(smallPool.getStats().poolSize).toBe(2);

      smallPool.acquire(); // Should trigger growth
      expect(smallPool.getStats().poolSize).toBe(4);
      expect(smallPool.getStats().growthEvents).toBe(1);

      smallPool.endFrame();
    });

    it('should use specified growth factor', () => {
      const smallPool = new GrowthProgressPool({
        initialSize: 4,
        growthFactor: 3,
        devMode: false,
      });
      smallPool.beginFrame();

      for (let i = 0; i < 5; i++) {
        smallPool.acquire();
      }

      expect(smallPool.getStats().poolSize).toBe(12); // 4 * 3
      smallPool.endFrame();
    });
  });

  describe('statistics', () => {
    it('should track peak usage', () => {
      pool.beginFrame();
      pool.acquire();
      pool.acquire();
      pool.acquire();
      pool.endFrame();

      pool.beginFrame();
      pool.acquire();
      pool.endFrame();

      expect(pool.getStats().peakUsage).toBe(3);
    });

    it('should track total acquired', () => {
      pool.beginFrame();
      pool.acquire();
      pool.acquire();
      pool.endFrame();

      pool.beginFrame();
      pool.acquire();
      pool.endFrame();

      expect(pool.getStats().acquired).toBe(3);
    });

    it('should track total released', () => {
      pool.beginFrame();
      pool.acquire();
      pool.acquire();
      pool.endFrame();

      pool.beginFrame();
      pool.acquire();
      pool.endFrame();

      expect(pool.getStats().released).toBe(3);
    });

    it('should have acquired equal released after complete frames', () => {
      pool.beginFrame();
      pool.acquire();
      pool.acquire();
      pool.endFrame();

      const stats = pool.getStats();
      expect(stats.acquired).toBe(stats.released);
    });
  });

  describe('dev mode diagnostics', () => {
    it('should warn on nested beginFrame', () => {
      // Use devMode without strictMode to get warnings instead of throws
      const warnPool = new GrowthProgressPool({ initialSize: 10, devMode: true, strictMode: false });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      warnPool.beginFrame();
      warnPool.beginFrame();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('already in frame')
      );
      warnSpy.mockRestore();
      warnPool.endFrame();
    });

    it('should warn on endFrame outside frame', () => {
      // Use devMode without strictMode to get warnings instead of throws
      const warnPool = new GrowthProgressPool({ initialSize: 10, devMode: true, strictMode: false });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      warnPool.endFrame();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('outside of frame')
      );
      warnSpy.mockRestore();
    });

    it('should detect use-after-release', () => {
      pool.beginFrame();
      const obj = pool.acquire();
      pool.endFrame();

      pool.beginFrame();
      // Object was released (reset) on previous endFrame
      expect(() => pool.validateObject(obj)).toThrow(/Use-after-release|Stale object/);
      pool.endFrame();
    });

    it('should detect stale objects from previous frame', () => {
      pool.beginFrame();
      const obj = pool.acquire();
      pool.endFrame();

      // After endFrame, object is reset so _released is true
      // validateObject should throw use-after-release
      pool.beginFrame();
      expect(() => pool.validateObject(obj)).toThrow(/Use-after-release/);
      pool.endFrame();
    });
  });

  describe('detectLeaks', () => {
    it('should return empty array when no leaks', () => {
      pool.beginFrame();
      pool.acquire();
      pool.endFrame();

      expect(pool.detectLeaks()).toEqual([]);
    });

    it('should detect unreleased objects when frame not properly ended', () => {
      // Use strictMode: false to allow nested beginFrame without throwing
      const leakPool = new GrowthProgressPool({ initialSize: 10, devMode: true, strictMode: false });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      leakPool.beginFrame();
      leakPool.acquire();
      // Don't call endFrame - simulate improper frame ending

      // Manually move to next frame (simulating a bug where endFrame was skipped)
      leakPool.beginFrame(); // This starts frame 2

      // Object from frame 1 should be detected as a leak
      const leaks = leakPool.detectLeaks();
      expect(leaks.length).toBe(1);
      expect(leaks[0].frameAcquired).toBe(1);
      leakPool.endFrame();
      warnSpy.mockRestore();
    });
  });

  describe('reset', () => {
    it('should reset pool to initial state', () => {
      pool.beginFrame();
      pool.acquire();
      pool.acquire();
      pool.endFrame();

      pool.reset();

      const stats = pool.getStats();
      expect(stats.poolSize).toBe(10);
      expect(stats.acquired).toBe(0);
      expect(stats.released).toBe(0);
      expect(stats.peakUsage).toBe(0);
      expect(pool.getFrameNumber()).toBe(0);
    });

    it('should shrink pool back to initial size if grown', () => {
      const smallPool = new GrowthProgressPool({
        initialSize: 2,
        growthFactor: 2,
        devMode: false,
      });

      smallPool.beginFrame();
      for (let i = 0; i < 10; i++) {
        smallPool.acquire();
      }
      smallPool.endFrame();

      expect(smallPool.getStats().poolSize).toBeGreaterThan(2);

      smallPool.reset();
      expect(smallPool.getStats().poolSize).toBe(2);
    });

    it('should reset inFrame state', () => {
      pool.beginFrame();
      pool.reset();
      expect(pool.isInFrame()).toBe(false);
    });
  });
});

describe('Default pool', () => {
  beforeEach(() => {
    resetDefaultPool();
  });

  it('should return singleton instance', () => {
    const pool1 = getDefaultPool();
    const pool2 = getDefaultPool();
    expect(pool1).toBe(pool2);
  });

  it('should be resetable', () => {
    const pool = getDefaultPool();
    pool.beginFrame();
    pool.acquire();
    pool.endFrame();

    expect(pool.getStats().acquired).toBe(1);

    resetDefaultPool();

    expect(pool.getStats().acquired).toBe(0);
  });
});

describe('MutableGrowthProgress equivalence to GrowthProgress', () => {
  it('should produce identical results to immutable GrowthProgress', () => {
    const testCases = [
      { time: 0, delay: 100, duration: 1000 },
      { time: 100, delay: 100, duration: 1000 },
      { time: 350, delay: 100, duration: 1000 },
      { time: 600, delay: 100, duration: 1000 },
      { time: 1100, delay: 100, duration: 1000 },
      { time: 2000, delay: 100, duration: 1000 },
    ];

    for (const { time, delay, duration } of testCases) {
      const immutable = GrowthProgress.calculate(time, delay, duration);
      const mutable = new MutableGrowthProgress().calculateMut(time, delay, duration);

      expect(mutable.progress).toBeCloseTo(immutable.progress, 10);
      expect(mutable.stem).toBeCloseTo(immutable.stem, 10);
      expect(mutable.leaf).toBeCloseTo(immutable.leaf, 10);
      expect(mutable.flower).toBeCloseTo(immutable.flower, 10);
      expect(mutable.foliage).toBeCloseTo(immutable.foliage, 10);
      expect(mutable.plume).toBeCloseTo(immutable.plume, 10);

      expect(mutable.isActive).toBe(immutable.isActive);
      expect(mutable.isComplete).toBe(immutable.isComplete);
      expect(mutable.hasLeaves).toBe(immutable.hasLeaves);
      expect(mutable.hasFlower).toBe(immutable.hasFlower);
      expect(mutable.hasFoliage).toBe(immutable.hasFoliage);
      expect(mutable.hasPlume).toBe(immutable.hasPlume);
    }
  });

  it('should maintain phase ordering invariant (stem >= flower)', () => {
    const mutable = new MutableGrowthProgress();

    for (let p = 0; p <= 1; p += 0.05) {
      mutable.calculateMut(p * 1000 + 100, 100, 1000);
      expect(mutable.stem).toBeGreaterThanOrEqual(mutable.flower);
    }
  });

  it('should clamp all phases to [0, 1]', () => {
    const mutable = new MutableGrowthProgress();

    for (let p = -0.5; p <= 1.5; p += 0.1) {
      mutable.calculateMut(p * 1000 + 100, 100, 1000);

      expect(mutable.progress).toBeGreaterThanOrEqual(0);
      expect(mutable.progress).toBeLessThanOrEqual(1);
      expect(mutable.stem).toBeGreaterThanOrEqual(0);
      expect(mutable.stem).toBeLessThanOrEqual(1);
      expect(mutable.leaf).toBeGreaterThanOrEqual(0);
      expect(mutable.leaf).toBeLessThanOrEqual(1);
      expect(mutable.flower).toBeGreaterThanOrEqual(0);
      expect(mutable.flower).toBeLessThanOrEqual(1);
      expect(mutable.foliage).toBeGreaterThanOrEqual(0);
      expect(mutable.foliage).toBeLessThanOrEqual(1);
      expect(mutable.plume).toBeGreaterThanOrEqual(0);
      expect(mutable.plume).toBeLessThanOrEqual(1);
    }
  });

  it('should clamp foliage to maximum of 1 at full progress', () => {
    // This specifically tests the bug where (1.0 - 0.4) * 1.7 = 1.02 > 1
    const mutable = new MutableGrowthProgress();
    mutable.calculateMut(1100, 100, 1000); // progress = 1.0

    expect(mutable.foliage).toBeLessThanOrEqual(1);
    expect(mutable.foliage).toBeCloseTo(1, 5);
  });
});

// ==================== NEW FEATURE TESTS ====================

describe('Pool shrinking', () => {
  it('should shrink when usage drops below threshold for sustained period', () => {
    const pool = new GrowthProgressPool({
      initialSize: 64,
      devMode: false,
      shrinkThreshold: 0.25,
      lowUsageFramesBeforeShrink: 5,
    });

    // Force growth by using many objects
    pool.beginFrame();
    for (let i = 0; i < 200; i++) {
      pool.acquire();
    }
    pool.endFrame();

    const grownSize = pool.getStats().poolSize;
    expect(grownSize).toBeGreaterThan(64);

    // Run several frames with low usage
    for (let f = 0; f < 10; f++) {
      pool.beginFrame();
      pool.acquire(); // Only 1 object - below 25% threshold
      pool.endFrame();
    }

    expect(pool.getStats().poolSize).toBeLessThan(grownSize);
  });

  it('should not shrink below initial size', () => {
    const pool = new GrowthProgressPool({
      initialSize: 64,
      devMode: false,
      shrinkThreshold: 0.25,
      lowUsageFramesBeforeShrink: 2,
    });

    // Run many low-usage frames
    for (let f = 0; f < 20; f++) {
      pool.beginFrame();
      pool.acquire();
      pool.endFrame();
    }

    expect(pool.getStats().poolSize).toBe(64);
  });
});

describe('Strict mode', () => {
  it('should throw on nested beginFrame when strictMode is enabled', () => {
    const pool = new GrowthProgressPool({ initialSize: 10, devMode: false, strictMode: true });
    pool.beginFrame();

    expect(() => pool.beginFrame()).toThrow(/already in frame/);

    pool.endFrame();
  });

  it('should throw on endFrame outside frame when strictMode is enabled', () => {
    const pool = new GrowthProgressPool({ initialSize: 10, devMode: false, strictMode: true });

    expect(() => pool.endFrame()).toThrow(/outside of frame/);
  });

  it('should not throw when strictMode is disabled', () => {
    const pool = new GrowthProgressPool({ initialSize: 10, devMode: false, strictMode: false });
    pool.beginFrame();

    expect(() => pool.beginFrame()).not.toThrow();
    expect(() => pool.endFrame()).not.toThrow();
    expect(() => pool.endFrame()).not.toThrow(); // Extra endFrame should not throw
  });
});

describe('Max size limit', () => {
  it('should throw when max size is exceeded', () => {
    const pool = new GrowthProgressPool({
      initialSize: 8,
      growthFactor: 2,
      maxSize: 32,
      devMode: false,
    });

    pool.beginFrame();
    expect(() => {
      for (let i = 0; i < 50; i++) {
        pool.acquire();
      }
    }).toThrow(/Maximum size 32 exceeded/);
    pool.endFrame();
  });
});

describe('Frame history', () => {
  it('should track frame history', () => {
    const pool = new GrowthProgressPool({ initialSize: 64, devMode: false });

    pool.beginFrame();
    pool.acquire();
    pool.acquire();
    pool.acquire();
    pool.endFrame();

    pool.beginFrame();
    pool.acquire();
    pool.endFrame();

    const history = pool.getFrameHistory();
    expect(history.length).toBe(2);
    expect(history[0].usage).toBe(3);
    expect(history[1].usage).toBe(1);
    expect(history[0].frameNumber).toBe(1);
    expect(history[1].frameNumber).toBe(2);
  });

  it('should limit history size to max (60 frames)', () => {
    const pool = new GrowthProgressPool({ initialSize: 64, devMode: false });

    // Run 100 frames
    for (let i = 0; i < 100; i++) {
      pool.beginFrame();
      pool.acquire();
      pool.endFrame();
    }

    const history = pool.getFrameHistory();
    expect(history.length).toBe(60); // Max history size
    expect(history[0].frameNumber).toBe(41); // Oldest kept frame
    expect(history[59].frameNumber).toBe(100); // Most recent frame
  });
});

describe('Pool membership validation', () => {
  it('should throw when validating object from different pool', () => {
    const pool1 = new GrowthProgressPool({ initialSize: 10, devMode: true });
    const pool2 = new GrowthProgressPool({ initialSize: 10, devMode: true });

    pool1.beginFrame();
    pool2.beginFrame();

    const obj1 = pool1.acquire();
    // Try to validate obj1 against pool2
    expect(() => pool2.validateObject(obj1)).toThrow(/not from this pool/);

    pool1.endFrame();
    pool2.endFrame();
  });
});

describe('disposeDefaultPool', () => {
  it('should dispose and recreate default pool', async () => {
    const { getDefaultPool, disposeDefaultPool, resetDefaultPool } = await import('./GrowthProgressPool');
    resetDefaultPool();

    const pool1 = getDefaultPool();
    pool1.beginFrame();
    pool1.acquire();
    pool1.endFrame();

    expect(pool1.getStats().acquired).toBe(1);

    disposeDefaultPool();

    const pool2 = getDefaultPool();
    expect(pool2).not.toBe(pool1);
    expect(pool2.getStats().acquired).toBe(0);

    // Clean up
    resetDefaultPool();
  });
});

describe('Multiple pool instances', () => {
  it('should isolate state between pool instances', () => {
    const pool1 = new GrowthProgressPool({ initialSize: 10, devMode: true });
    const pool2 = new GrowthProgressPool({ initialSize: 10, devMode: true });

    pool1.beginFrame();
    pool2.beginFrame();

    const obj1 = pool1.acquire();
    const obj2 = pool2.acquire();

    expect(obj1).not.toBe(obj2);
    expect(pool1.getStats().currentFrameUsage).toBe(1);
    expect(pool2.getStats().currentFrameUsage).toBe(1);

    pool1.endFrame();
    expect(pool1.isInFrame()).toBe(false);
    expect(pool2.isInFrame()).toBe(true);

    pool2.endFrame();
  });
});
