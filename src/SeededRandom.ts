/**
 * SeededRandom - Enhanced seeded random number generator
 * Provides deterministic random values for reproducible garden generation
 */

/**
 * SeededRandom class - A comprehensive seeded pseudo-random number generator
 *
 * Features:
 * - Deterministic: Same seed always produces same sequence
 * - Rich API: Range, pick, shuffle, normal distribution
 * - Stateful: Maintains seed state for sequential calls
 * - Lightweight: Uses simple sine-based PRNG (good enough for visual use)
 *
 * Usage:
 * ```typescript
 * const rng = new SeededRandom(42);
 *
 * // Basic random (0-1)
 * const value = rng.next();
 *
 * // Random in range
 * const height = rng.range(0.1, 0.5);
 *
 * // Random integer
 * const petals = rng.int(3, 8);
 *
 * // Pick from array
 * const color = rng.pick(['red', 'blue', 'green']);
 *
 * // Weighted pick
 * const category = rng.weightedPick([
 *   { value: 'common', weight: 0.7 },
 *   { value: 'rare', weight: 0.3 }
 * ]);
 * ```
 */
export class SeededRandom {
  private _seed: number;
  private _initialSeed: number;

  /**
   * Create a new SeededRandom instance
   * @param seed Initial seed value
   */
  constructor(seed: number) {
    this._initialSeed = seed;
    this._seed = seed;
  }

  // ==================== GETTERS ====================

  /**
   * Get the current seed value
   */
  get seed(): number {
    return this._seed;
  }

  /**
   * Get the initial seed value
   */
  get initialSeed(): number {
    return this._initialSeed;
  }

  // ==================== CORE METHODS ====================

  /**
   * Generate the next random value (0-1)
   */
  next(): number {
    const x = Math.sin(this._seed++ * 9999) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Reset to initial seed
   */
  reset(): void {
    this._seed = this._initialSeed;
  }

  /**
   * Set a new seed
   */
  setSeed(seed: number): void {
    this._seed = seed;
    this._initialSeed = seed;
  }

  /**
   * Create a child RNG with a derived seed
   * Useful for creating independent sequences
   */
  fork(): SeededRandom {
    return new SeededRandom(this._seed * 1000 + Math.floor(this.next() * 1000));
  }

  /**
   * Create a function that generates sequential random values
   * Compatible with existing createRandom pattern
   */
  createGenerator(): () => number {
    const rng = this.fork();
    return () => rng.next();
  }

  // ==================== RANGE METHODS ====================

  /**
   * Random float in range [min, max)
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Random integer in range [min, max] (inclusive)
   */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Random integer in range [0, max) (exclusive)
   */
  below(max: number): number {
    return Math.floor(this.next() * max);
  }

  /**
   * Random value centered around zero: [-range, range]
   */
  centered(range: number): number {
    return (this.next() - 0.5) * 2 * range;
  }

  /**
   * Random value with offset from center: center + [-range, range]
   */
  around(center: number, range: number): number {
    return center + this.centered(range);
  }

  // ==================== BOOLEAN METHODS ====================

  /**
   * Random boolean
   */
  bool(): boolean {
    return this.next() < 0.5;
  }

  /**
   * Random boolean with probability
   * @param probability Chance of returning true (0-1)
   */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /**
   * Random sign (1 or -1)
   */
  sign(): number {
    return this.bool() ? 1 : -1;
  }

  // ==================== ARRAY METHODS ====================

  /**
   * Pick a random element from an array
   */
  pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('SeededRandom.pick: Cannot pick from empty array');
    }
    return array[this.below(array.length)];
  }

  /**
   * Pick a random index from an array
   */
  pickIndex<T>(array: readonly T[]): number {
    if (array.length === 0) {
      throw new Error('SeededRandom.pickIndex: Cannot pick from empty array');
    }
    return this.below(array.length);
  }

  /**
   * Pick multiple unique random elements from an array
   * @param array Source array
   * @param count Number of elements to pick
   */
  pickMultiple<T>(array: readonly T[], count: number): T[] {
    if (count > array.length) {
      throw new Error('SeededRandom.pickMultiple: Count exceeds array length');
    }

    const result: T[] = [];
    const indices = new Set<number>();

    while (result.length < count) {
      const idx = this.below(array.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        result.push(array[idx]);
      }
    }

    return result;
  }

  /**
   * Weighted random pick
   * @param items Array of { value, weight } objects
   */
  weightedPick<T>(items: readonly { value: T; weight: number }[]): T {
    if (items.length === 0) {
      throw new Error('SeededRandom.weightedPick: Cannot pick from empty array');
    }

    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.next() * totalWeight;

    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) {
        return item.value;
      }
    }

    // Fallback to last item (shouldn't happen due to floating point)
    return items[items.length - 1].value;
  }

  /**
   * Shuffle an array in place (Fisher-Yates)
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.below(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Create a shuffled copy of an array
   */
  shuffled<T>(array: readonly T[]): T[] {
    const copy = [...array];
    return this.shuffle(copy);
  }

  // ==================== DISTRIBUTION METHODS ====================

  /**
   * Gaussian (normal) distribution
   * Uses Box-Muller transform
   * @param mean Mean of the distribution
   * @param stdDev Standard deviation
   */
  gaussian(mean: number = 0, stdDev: number = 1): number {
    // Box-Muller transform
    const u1 = this.next();
    const u2 = this.next();

    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Exponential distribution
   * @param lambda Rate parameter
   */
  exponential(lambda: number = 1): number {
    return -Math.log(1 - this.next()) / lambda;
  }

  /**
   * Biased random value (power curve)
   * @param exponent Values < 1 bias toward 1, > 1 bias toward 0
   */
  biased(exponent: number): number {
    return Math.pow(this.next(), exponent);
  }

  /**
   * Random value biased toward the center (0.5)
   * Uses average of two random values
   */
  centeredBias(): number {
    return (this.next() + this.next()) / 2;
  }

  /**
   * Random value biased toward edges (0 and 1)
   */
  edgeBias(): number {
    const v = this.next() * 2 - 1;
    return Math.abs(v);
  }

  // ==================== GEOMETRIC METHODS ====================

  /**
   * Random angle in radians [0, 2*PI)
   */
  angle(): number {
    return this.next() * Math.PI * 2;
  }

  /**
   * Random angle in degrees [0, 360)
   */
  degrees(): number {
    return this.next() * 360;
  }

  /**
   * Random point in unit circle
   */
  pointInCircle(): { x: number; y: number } {
    const angle = this.angle();
    const radius = Math.sqrt(this.next()); // sqrt for uniform distribution
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  }

  /**
   * Random point on unit circle edge
   */
  pointOnCircle(): { x: number; y: number } {
    const angle = this.angle();
    return {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };
  }

  /**
   * Random point in rectangle
   */
  pointInRect(width: number, height: number): { x: number; y: number } {
    return {
      x: this.next() * width,
      y: this.next() * height,
    };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get current state for serialization
   */
  getState(): { seed: number; initialSeed: number } {
    return {
      seed: this._seed,
      initialSeed: this._initialSeed,
    };
  }

  /**
   * Restore state from serialized data
   */
  setState(state: { seed: number; initialSeed: number }): void {
    this._seed = state.seed;
    this._initialSeed = state.initialSeed;
  }

  /**
   * Advance the seed by n steps without generating values
   * Useful for skipping ahead in the sequence
   */
  skip(n: number): void {
    this._seed += n;
  }

  /**
   * Create a new SeededRandom with a random seed
   */
  static random(): SeededRandom {
    return new SeededRandom(Math.random() * 100000);
  }

  /**
   * Create from a string (hashes the string to get a seed)
   */
  static fromString(str: string): SeededRandom {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return new SeededRandom(Math.abs(hash));
  }
}

// ==================== LEGACY COMPATIBILITY ====================

/**
 * Seeded pseudo-random number generator function
 * Returns a value between 0 and 1
 * Compatible with existing code
 */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

/**
 * Create a seeded random function that auto-increments
 * Compatible with existing createRandom pattern
 */
export function createRandom(initialSeed: number): () => number {
  let seed = initialSeed;
  return () => seededRandom(seed++);
}

/**
 * Pick a random item from an array using seeded random
 * Compatible with existing pickRandom pattern
 */
export function pickRandom<T>(array: readonly T[], rand: () => number): T {
  return array[Math.floor(rand() * array.length)];
}

/**
 * Pick a random number in range using seeded random
 * Compatible with existing randomRange pattern
 */
export function randomRange(min: number, max: number, rand: () => number): number {
  return min + rand() * (max - min);
}
