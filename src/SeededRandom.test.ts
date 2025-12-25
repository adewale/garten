import { describe, it, expect } from 'vitest';
import { SeededRandom, seededRandom, createRandom, pickRandom, randomRange } from './SeededRandom';

describe('SeededRandom', () => {
  describe('determinism', () => {
    it('should produce same sequence for same seed', () => {
      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);

      for (let i = 0; i < 10; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('should produce different sequences for different seeds', () => {
      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(54321);

      let different = false;
      for (let i = 0; i < 10; i++) {
        if (rng1.next() !== rng2.next()) {
          different = true;
          break;
        }
      }
      expect(different).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const rng = new SeededRandom(12345);
      const first = rng.next();
      rng.next();
      rng.next();
      rng.reset();
      expect(rng.next()).toBe(first);
    });
  });

  describe('next', () => {
    it('should return values between 0 and 1', () => {
      const rng = new SeededRandom(12345);
      for (let i = 0; i < 100; i++) {
        const val = rng.next();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe('range', () => {
    it('should return values in specified range', () => {
      const rng = new SeededRandom(12345);
      for (let i = 0; i < 100; i++) {
        const val = rng.range(10, 20);
        expect(val).toBeGreaterThanOrEqual(10);
        expect(val).toBeLessThan(20);
      }
    });
  });

  describe('int', () => {
    it('should return integers in specified range (inclusive)', () => {
      const rng = new SeededRandom(12345);
      const values = new Set<number>();
      for (let i = 0; i < 100; i++) {
        const val = rng.int(1, 3);
        values.add(val);
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(3);
      }
      // Should eventually hit all values
      expect(values.size).toBe(3);
    });
  });

  describe('below', () => {
    it('should return integers in [0, max)', () => {
      const rng = new SeededRandom(12345);
      for (let i = 0; i < 100; i++) {
        const val = rng.below(5);
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(5);
      }
    });
  });

  describe('centered', () => {
    it('should return values in [-range, range]', () => {
      const rng = new SeededRandom(12345);
      for (let i = 0; i < 100; i++) {
        const val = rng.centered(5);
        expect(val).toBeGreaterThanOrEqual(-5);
        expect(val).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('around', () => {
    it('should return values centered around a value', () => {
      const rng = new SeededRandom(12345);
      for (let i = 0; i < 100; i++) {
        const val = rng.around(10, 2);
        expect(val).toBeGreaterThanOrEqual(8);
        expect(val).toBeLessThanOrEqual(12);
      }
    });
  });

  describe('boolean methods', () => {
    it('should return booleans', () => {
      const rng = new SeededRandom(12345);
      let hasTrue = false;
      let hasFalse = false;

      for (let i = 0; i < 100; i++) {
        const val = rng.bool();
        if (val) hasTrue = true;
        else hasFalse = true;
      }

      expect(hasTrue).toBe(true);
      expect(hasFalse).toBe(true);
    });

    it('should respect probability in chance', () => {
      const rng = new SeededRandom(12345);
      let trueCount = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        if (rng.chance(0.8)) trueCount++;
      }

      // Should be roughly 80% true (with some variance)
      expect(trueCount / iterations).toBeGreaterThan(0.7);
      expect(trueCount / iterations).toBeLessThan(0.9);
    });

    it('should return 1 or -1 from sign', () => {
      const rng = new SeededRandom(12345);
      let hasPositive = false;
      let hasNegative = false;

      for (let i = 0; i < 100; i++) {
        const val = rng.sign();
        expect(Math.abs(val)).toBe(1);
        if (val === 1) hasPositive = true;
        if (val === -1) hasNegative = true;
      }

      expect(hasPositive).toBe(true);
      expect(hasNegative).toBe(true);
    });
  });

  describe('array methods', () => {
    it('should pick random element', () => {
      const rng = new SeededRandom(12345);
      const arr = ['a', 'b', 'c', 'd'];
      const picked = rng.pick(arr);
      expect(arr).toContain(picked);
    });

    it('should throw on empty array', () => {
      const rng = new SeededRandom(12345);
      expect(() => rng.pick([])).toThrow();
    });

    it('should pick multiple unique elements', () => {
      const rng = new SeededRandom(12345);
      const arr = [1, 2, 3, 4, 5];
      const picked = rng.pickMultiple(arr, 3);
      expect(picked.length).toBe(3);
      expect(new Set(picked).size).toBe(3); // All unique
    });

    it('should shuffle array', () => {
      const rng = new SeededRandom(12345);
      const arr = [1, 2, 3, 4, 5];
      const original = [...arr];
      rng.shuffle(arr);

      expect(arr.length).toBe(original.length);
      expect(arr.sort()).toEqual(original.sort()); // Same elements
    });

    it('should return shuffled copy', () => {
      const rng = new SeededRandom(12345);
      const arr = [1, 2, 3, 4, 5];
      const shuffled = rng.shuffled(arr);

      expect(shuffled).not.toBe(arr); // Different reference
      expect(shuffled.sort()).toEqual(arr.sort()); // Same elements
    });
  });

  describe('weighted pick', () => {
    it('should respect weights', () => {
      const rng = new SeededRandom(12345);
      const items = [
        { value: 'common', weight: 0.9 },
        { value: 'rare', weight: 0.1 },
      ];

      let commonCount = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        if (rng.weightedPick(items) === 'common') commonCount++;
      }

      // Should be roughly 90% common (with some variance)
      expect(commonCount / iterations).toBeGreaterThan(0.8);
    });
  });

  describe('distributions', () => {
    it('should produce gaussian distribution', () => {
      const rng = new SeededRandom(12345);
      let sum = 0;
      const n = 1000;

      for (let i = 0; i < n; i++) {
        sum += rng.gaussian(0, 1);
      }

      // Mean should be close to 0
      expect(Math.abs(sum / n)).toBeLessThan(0.2);
    });

    it('should produce biased distribution', () => {
      const rng = new SeededRandom(12345);
      let sum = 0;
      const n = 1000;

      for (let i = 0; i < n; i++) {
        sum += rng.biased(2); // Bias toward 0
      }

      // Mean should be less than 0.5
      expect(sum / n).toBeLessThan(0.4);
    });
  });

  describe('geometric methods', () => {
    it('should produce angle in [0, 2PI)', () => {
      const rng = new SeededRandom(12345);
      for (let i = 0; i < 100; i++) {
        const angle = rng.angle();
        expect(angle).toBeGreaterThanOrEqual(0);
        expect(angle).toBeLessThan(Math.PI * 2);
      }
    });

    it('should produce point in circle', () => {
      const rng = new SeededRandom(12345);
      for (let i = 0; i < 100; i++) {
        const point = rng.pointInCircle();
        const dist = Math.sqrt(point.x * point.x + point.y * point.y);
        expect(dist).toBeLessThanOrEqual(1);
      }
    });

    it('should produce point on circle edge', () => {
      const rng = new SeededRandom(12345);
      for (let i = 0; i < 100; i++) {
        const point = rng.pointOnCircle();
        const dist = Math.sqrt(point.x * point.x + point.y * point.y);
        expect(dist).toBeCloseTo(1, 5);
      }
    });
  });

  describe('fork', () => {
    it('should create independent sequence', () => {
      const rng = new SeededRandom(12345);
      rng.next();
      const forked = rng.fork();

      // Advance original
      const origValues = [rng.next(), rng.next()];
      // Forked should have different sequence
      const forkedValues = [forked.next(), forked.next()];

      expect(origValues).not.toEqual(forkedValues);
    });
  });

  describe('state management', () => {
    it('should get and restore state', () => {
      const rng = new SeededRandom(12345);
      rng.next();
      rng.next();
      const state = rng.getState();

      const val1 = rng.next();
      rng.next();

      rng.setState(state);
      const val2 = rng.next();

      expect(val1).toBe(val2);
    });
  });

  describe('static methods', () => {
    it('should create from string', () => {
      const rng1 = SeededRandom.fromString('hello');
      const rng2 = SeededRandom.fromString('hello');

      expect(rng1.next()).toBe(rng2.next());
    });

    it('should create random instance', () => {
      const rng = SeededRandom.random();
      expect(rng.next()).toBeGreaterThanOrEqual(0);
      expect(rng.next()).toBeLessThan(1);
    });
  });
});

describe('Legacy compatibility functions', () => {
  describe('seededRandom', () => {
    it('should be deterministic', () => {
      expect(seededRandom(12345)).toBe(seededRandom(12345));
    });

    it('should return value in [0, 1)', () => {
      const val = seededRandom(12345);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    });
  });

  describe('createRandom', () => {
    it('should create auto-incrementing random function', () => {
      const rand = createRandom(12345);
      const v1 = rand();
      const v2 = rand();
      expect(v1).not.toBe(v2);
    });
  });

  describe('pickRandom', () => {
    it('should pick from array', () => {
      const rand = createRandom(12345);
      const arr = ['a', 'b', 'c'];
      const picked = pickRandom(arr, rand);
      expect(arr).toContain(picked);
    });
  });

  describe('randomRange', () => {
    it('should return value in range', () => {
      const rand = createRandom(12345);
      const val = randomRange(10, 20, rand);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThan(20);
    });
  });
});
