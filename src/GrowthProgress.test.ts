import { describe, it, expect } from 'vitest';
import { GrowthProgress, calculateGrowthPhases, isPlantActive, calculateRawProgress } from './GrowthProgress';

describe('GrowthProgress', () => {
  describe('calculate', () => {
    it('should return inactive for time before delay', () => {
      const growth = GrowthProgress.calculate(0, 100, 200);
      expect(growth.isActive).toBe(false);
      expect(growth.progress).toBe(0);
    });

    it('should calculate correct progress at midpoint', () => {
      const growth = GrowthProgress.calculate(150, 100, 100);
      expect(growth.progress).toBe(0.5);
    });

    it('should cap progress at 1', () => {
      const growth = GrowthProgress.calculate(500, 100, 100);
      expect(growth.progress).toBe(1);
      expect(growth.isComplete).toBe(true);
    });
  });

  describe('fromProgress', () => {
    it('should create from raw progress value', () => {
      const growth = GrowthProgress.fromProgress(0.5);
      expect(growth.progress).toBe(0.5);
    });

    it('should clamp progress to valid range', () => {
      const underflow = GrowthProgress.fromProgress(-0.5);
      const overflow = GrowthProgress.fromProgress(1.5);
      expect(underflow.progress).toBe(0);
      expect(overflow.progress).toBe(1);
    });
  });

  describe('growth phases', () => {
    it('should calculate stem growth faster than overall progress', () => {
      const growth = GrowthProgress.fromProgress(0.5);
      expect(growth.stem).toBeGreaterThan(growth.progress);
      expect(growth.stem).toBe(0.75); // 0.5 * 1.5
    });

    it('should delay leaf growth', () => {
      const earlyGrowth = GrowthProgress.fromProgress(0.2);
      expect(earlyGrowth.hasLeaves).toBe(false);
      expect(earlyGrowth.leaf).toBe(0);

      const laterGrowth = GrowthProgress.fromProgress(0.5);
      expect(laterGrowth.hasLeaves).toBe(true);
    });

    it('should delay flower growth', () => {
      const earlyGrowth = GrowthProgress.fromProgress(0.4);
      expect(earlyGrowth.hasFlower).toBe(false);
      expect(earlyGrowth.flower).toBe(0);

      const laterGrowth = GrowthProgress.fromProgress(0.7);
      expect(laterGrowth.hasFlower).toBe(true);
    });

    it('should calculate full flower at 100% progress', () => {
      const complete = GrowthProgress.complete();
      expect(complete.stem).toBe(1);
      expect(complete.leaf).toBe(1);
      expect(complete.flower).toBe(1);
    });
  });

  describe('extended phases', () => {
    it('should calculate foliage growth', () => {
      const early = GrowthProgress.fromProgress(0.3);
      expect(early.hasFoliage).toBe(false);

      const later = GrowthProgress.fromProgress(0.6);
      expect(later.hasFoliage).toBe(true);
    });

    it('should calculate plume growth', () => {
      const early = GrowthProgress.fromProgress(0.7);
      expect(early.hasPlume).toBe(false);

      const later = GrowthProgress.fromProgress(0.9);
      expect(later.hasPlume).toBe(true);
    });
  });

  describe('static factories', () => {
    it('should create inactive instance', () => {
      const inactive = GrowthProgress.inactive();
      expect(inactive.isActive).toBe(false);
      expect(inactive.progress).toBe(0);
    });

    it('should create complete instance', () => {
      const complete = GrowthProgress.complete();
      expect(complete.isComplete).toBe(true);
      expect(complete.progress).toBe(1);
    });
  });

  describe('toObject', () => {
    it('should return phases as object', () => {
      const growth = GrowthProgress.fromProgress(0.5);
      const obj = growth.toObject();
      expect(obj).toHaveProperty('progress');
      expect(obj).toHaveProperty('stem');
      expect(obj).toHaveProperty('leaf');
      expect(obj).toHaveProperty('flower');
    });

    it('should return extended phases', () => {
      const growth = GrowthProgress.fromProgress(0.5);
      const obj = growth.toExtendedObject();
      expect(obj).toHaveProperty('foliage');
      expect(obj).toHaveProperty('plume');
    });
  });

  describe('utility methods', () => {
    it('should check range', () => {
      const growth = GrowthProgress.fromProgress(0.5);
      expect(growth.isInRange(0.4, 0.6)).toBe(true);
      expect(growth.isInRange(0.6, 0.8)).toBe(false);
    });

    it('should calculate phase progress', () => {
      const growth = GrowthProgress.fromProgress(0.75);
      const phaseProgress = growth.getPhaseProgress(0.5, 1.0);
      expect(phaseProgress).toBe(0.5);
    });

    it('should apply easing', () => {
      const growth = GrowthProgress.fromProgress(0.5);
      expect(growth.eased('linear')).toBe(0.5);
      expect(growth.eased('ease-in')).toBe(0.25); // 0.5^2
      expect(growth.eased('ease-out')).toBe(0.75); // 0.5 * (2 - 0.5)
    });
  });

  describe('custom config', () => {
    it('should use custom growth rates', () => {
      const growth = GrowthProgress.calculate(150, 100, 100, {
        stemRate: 2.0,
        leafStart: 0.2,
        flowerStart: 0.4,
      });
      expect(growth.stem).toBe(1); // 0.5 * 2.0, capped at 1
    });
  });

  describe('equals', () => {
    it('should return true for identical progress', () => {
      const a = GrowthProgress.fromProgress(0.5);
      const b = GrowthProgress.fromProgress(0.5);
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different progress', () => {
      const a = GrowthProgress.fromProgress(0.5);
      const b = GrowthProgress.fromProgress(0.6);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('approximatelyEquals', () => {
    it('should return true for progress within epsilon', () => {
      const a = GrowthProgress.fromProgress(0.5);
      const b = GrowthProgress.fromProgress(0.50005);
      expect(a.approximatelyEquals(b, 0.001)).toBe(true);
    });

    it('should return false for progress outside epsilon', () => {
      const a = GrowthProgress.fromProgress(0.5);
      const b = GrowthProgress.fromProgress(0.51);
      expect(a.approximatelyEquals(b, 0.001)).toBe(false);
    });
  });

  describe('clone', () => {
    it('should create an identical copy', () => {
      const original = GrowthProgress.fromProgress(0.75);
      const cloned = original.clone();
      expect(cloned.equals(original)).toBe(true);
    });

    it('should not be the same reference', () => {
      const original = GrowthProgress.fromProgress(0.5);
      const cloned = original.clone();
      expect(cloned).not.toBe(original);
    });
  });

  describe('toString', () => {
    it('should return readable representation', () => {
      const growth = GrowthProgress.fromProgress(0.5);
      const str = growth.toString();
      expect(str).toContain('GrowthProgress');
      expect(str).toContain('0.50');
    });
  });
});

describe('calculateGrowthPhases', () => {
  it('should return null before delay', () => {
    const result = calculateGrowthPhases(50, 100, 200);
    expect(result).toBeNull();
  });

  it('should return phases object after delay', () => {
    const result = calculateGrowthPhases(150, 100, 100);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('progress');
    expect(result).toHaveProperty('stem');
    expect(result).toHaveProperty('leaf');
    expect(result).toHaveProperty('flower');
  });
});

describe('isPlantActive', () => {
  it('should return true when time >= delay', () => {
    expect(isPlantActive(100, 50)).toBe(true);
    expect(isPlantActive(100, 100)).toBe(true);
  });

  it('should return false when time < delay', () => {
    expect(isPlantActive(50, 100)).toBe(false);
  });
});

describe('calculateRawProgress', () => {
  it('should calculate normalized progress', () => {
    expect(calculateRawProgress(150, 100, 100)).toBe(0.5);
    expect(calculateRawProgress(50, 100, 100)).toBe(0);
    expect(calculateRawProgress(300, 100, 100)).toBe(1);
  });
});
