/**
 * GrowthProgress Domain Object
 * Standardizes growth phase calculations for plant rendering
 * Encapsulates the timing logic for different plant growth phases
 */

import { GROWTH_PHASES } from './constants';

/**
 * Growth phases data structure
 */
export interface GrowthPhases {
  /** Overall progress (0-1) */
  progress: number;
  /** Stem growth phase (0-1) */
  stem: number;
  /** Leaf growth phase (0-1) */
  leaf: number;
  /** Flower/bloom growth phase (0-1) */
  flower: number;
}

/**
 * Extended growth phases including additional plant-specific phases
 */
export interface ExtendedGrowthPhases extends GrowthPhases {
  /** Foliage growth for trees (0-1) */
  foliage: number;
  /** Plume growth for grasses (0-1) */
  plume: number;
}

/**
 * Configuration for growth timing
 */
export interface GrowthConfig {
  /** Rate at which stems grow (multiplier on progress) */
  stemRate: number;
  /** When leaf growth starts (0-1) */
  leafStart: number;
  /** Rate at which leaves grow (multiplier on adjusted progress) */
  leafRate: number;
  /** When flower growth starts (0-1) */
  flowerStart: number;
  /** Rate at which flowers grow (multiplier on adjusted progress) */
  flowerRate: number;
}

/**
 * GrowthProgress class - Calculates and manages plant growth phases
 *
 * Usage:
 * ```typescript
 * const growth = GrowthProgress.calculate(time, plant.delay, plant.growDuration);
 * if (growth.isActive) {
 *   drawStem(ctx, x, y, height * growth.stem, ...);
 *   if (growth.hasLeaves) {
 *     drawLeaf(ctx, x, y, growth.leaf, ...);
 *   }
 *   if (growth.hasFlower) {
 *     drawFlower(ctx, x, y, growth.flower, ...);
 *   }
 * }
 * ```
 */
export class GrowthProgress {
  private readonly _progress: number;
  private readonly _stem: number;
  private readonly _leaf: number;
  private readonly _flower: number;
  private readonly _foliage: number;
  private readonly _plume: number;

  private constructor(
    progress: number,
    config: GrowthConfig = GrowthProgress.defaultConfig
  ) {
    this._progress = Math.max(0, Math.min(1, progress));

    // Calculate growth phases
    this._stem = Math.min(1, this._progress * config.stemRate);
    this._leaf = Math.max(0, Math.min(1, (this._progress - config.leafStart) * config.leafRate));
    this._flower = Math.max(0, Math.min(1, (this._progress - config.flowerStart) * config.flowerRate));

    // Extended phases
    this._foliage = Math.max(0, (this._progress - GROWTH_PHASES.FOLIAGE_START) * GROWTH_PHASES.FOLIAGE_GROWTH_RATE);
    this._plume = this._progress > GROWTH_PHASES.PLUME_START
      ? (this._progress - GROWTH_PHASES.PLUME_START) / (1 - GROWTH_PHASES.PLUME_START)
      : 0;
  }

  // ==================== STATIC CONFIGURATION ====================

  static readonly defaultConfig: GrowthConfig = {
    stemRate: GROWTH_PHASES.STEM_GROWTH_RATE,
    leafStart: GROWTH_PHASES.LEAF_START,
    leafRate: GROWTH_PHASES.LEAF_GROWTH_RATE,
    flowerStart: GROWTH_PHASES.FLOWER_START,
    flowerRate: GROWTH_PHASES.FLOWER_GROWTH_RATE,
  };

  // ==================== STATIC FACTORIES ====================

  /**
   * Calculate growth progress from timing parameters
   * @param time Current animation time
   * @param delay Plant's growth delay
   * @param duration Plant's growth duration
   * @param config Optional custom growth configuration
   */
  static calculate(
    time: number,
    delay: number,
    duration: number,
    config?: Partial<GrowthConfig>
  ): GrowthProgress {
    const progress = (time - delay) / duration;
    const fullConfig = config
      ? { ...GrowthProgress.defaultConfig, ...config }
      : GrowthProgress.defaultConfig;
    return new GrowthProgress(progress, fullConfig);
  }

  /**
   * Create from raw progress value
   * @param progress Progress value (0-1)
   * @param config Optional custom growth configuration
   */
  static fromProgress(progress: number, config?: Partial<GrowthConfig>): GrowthProgress {
    const fullConfig = config
      ? { ...GrowthProgress.defaultConfig, ...config }
      : GrowthProgress.defaultConfig;
    return new GrowthProgress(progress, fullConfig);
  }

  /**
   * Create an inactive (zero progress) growth state
   */
  static inactive(): GrowthProgress {
    return new GrowthProgress(0);
  }

  /**
   * Create a complete (full progress) growth state
   */
  static complete(): GrowthProgress {
    return new GrowthProgress(1);
  }

  // ==================== GETTERS ====================

  /** Overall progress (0-1) */
  get progress(): number {
    return this._progress;
  }

  /** Stem growth phase (0-1) */
  get stem(): number {
    return this._stem;
  }

  /** Leaf growth phase (0-1) */
  get leaf(): number {
    return this._leaf;
  }

  /** Flower/bloom growth phase (0-1) */
  get flower(): number {
    return this._flower;
  }

  /** Foliage growth for trees (0-1) */
  get foliage(): number {
    return this._foliage;
  }

  /** Plume growth for grasses (0-1) */
  get plume(): number {
    return this._plume;
  }

  // ==================== BOOLEAN CHECKS ====================

  /** Whether the plant has started growing */
  get isActive(): boolean {
    return this._progress > 0;
  }

  /** Whether the plant is fully grown */
  get isComplete(): boolean {
    return this._progress >= 1;
  }

  /** Whether leaves should be drawn */
  get hasLeaves(): boolean {
    return this._leaf > 0;
  }

  /** Whether flowers should be drawn */
  get hasFlower(): boolean {
    return this._flower > 0;
  }

  /** Whether tree foliage should be drawn */
  get hasFoliage(): boolean {
    return this._foliage > 0;
  }

  /** Whether grass plumes should be drawn */
  get hasPlume(): boolean {
    return this._plume > 0;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get all phases as an object
   */
  toObject(): GrowthPhases {
    return {
      progress: this._progress,
      stem: this._stem,
      leaf: this._leaf,
      flower: this._flower,
    };
  }

  /**
   * Get extended phases including foliage and plume
   */
  toExtendedObject(): ExtendedGrowthPhases {
    return {
      progress: this._progress,
      stem: this._stem,
      leaf: this._leaf,
      flower: this._flower,
      foliage: this._foliage,
      plume: this._plume,
    };
  }

  /**
   * Check if progress is within a range
   * @param min Minimum progress (inclusive)
   * @param max Maximum progress (exclusive)
   */
  isInRange(min: number, max: number): boolean {
    return this._progress >= min && this._progress < max;
  }

  /**
   * Get a clamped progress value for a specific phase
   * @param start When this phase starts (0-1)
   * @param end When this phase ends (0-1)
   */
  getPhaseProgress(start: number, end: number): number {
    if (this._progress <= start) return 0;
    if (this._progress >= end) return 1;
    return (this._progress - start) / (end - start);
  }

  /**
   * Get eased progress using common easing functions
   * @param easing Easing type: 'linear', 'ease-in', 'ease-out', 'ease-in-out'
   */
  eased(easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'linear'): number {
    const t = this._progress;
    switch (easing) {
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return t * (2 - t);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'linear':
      default:
        return t;
    }
  }

  /**
   * Apply an easing function to the stem growth
   */
  easedStem(easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'ease-out'): number {
    return this._applyEasing(this._stem, easing);
  }

  /**
   * Apply an easing function to the flower growth
   */
  easedFlower(easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'ease-out'): number {
    return this._applyEasing(this._flower, easing);
  }

  private _applyEasing(
    value: number,
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  ): number {
    const t = value;
    switch (easing) {
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return t * (2 - t);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'linear':
      default:
        return t;
    }
  }

  /**
   * Check if this growth progress equals another
   */
  equals(other: GrowthProgress): boolean {
    return (
      this._progress === other._progress &&
      this._stem === other._stem &&
      this._leaf === other._leaf &&
      this._flower === other._flower &&
      this._foliage === other._foliage &&
      this._plume === other._plume
    );
  }

  /**
   * Check if this growth progress is approximately equal to another
   * @param other GrowthProgress to compare with
   * @param epsilon Maximum difference allowed (default 0.0001)
   */
  approximatelyEquals(other: GrowthProgress, epsilon: number = 0.0001): boolean {
    return (
      Math.abs(this._progress - other._progress) < epsilon &&
      Math.abs(this._stem - other._stem) < epsilon &&
      Math.abs(this._leaf - other._leaf) < epsilon &&
      Math.abs(this._flower - other._flower) < epsilon &&
      Math.abs(this._foliage - other._foliage) < epsilon &&
      Math.abs(this._plume - other._plume) < epsilon
    );
  }

  /**
   * Clone this growth progress
   */
  clone(): GrowthProgress {
    return GrowthProgress.fromProgress(this._progress);
  }

  /**
   * String representation
   */
  toString(): string {
    return `GrowthProgress(${this._progress.toFixed(2)}: stem=${this._stem.toFixed(2)}, leaf=${this._leaf.toFixed(2)}, flower=${this._flower.toFixed(2)})`;
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Quick calculation for legacy code - returns null if plant hasn't started growing
 * Compatible with the existing GrowthPhases interface used in renderers
 */
export function calculateGrowthPhases(
  time: number,
  delay: number,
  growDuration: number
): GrowthPhases | null {
  const progress = (time - delay) / growDuration;
  if (progress <= 0) return null;

  return {
    progress,
    stem: Math.min(1, progress * GROWTH_PHASES.STEM_GROWTH_RATE),
    leaf: Math.max(0, Math.min(1, (progress - GROWTH_PHASES.LEAF_START) * GROWTH_PHASES.LEAF_GROWTH_RATE)),
    flower: Math.max(0, Math.min(1, (progress - GROWTH_PHASES.FLOWER_START) * GROWTH_PHASES.FLOWER_GROWTH_RATE)),
  };
}

/**
 * Check if a plant should be rendered at the given time
 */
export function isPlantActive(time: number, delay: number): boolean {
  return time >= delay;
}

/**
 * Calculate raw progress (0-1) without phase separation
 */
export function calculateRawProgress(time: number, delay: number, duration: number): number {
  return Math.max(0, Math.min(1, (time - delay) / duration));
}
