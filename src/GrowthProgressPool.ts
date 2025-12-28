/**
 * GrowthProgressPool - Object pooling for growth phase calculations
 *
 * Eliminates ~15,000 allocations/second in the render hot path by reusing
 * MutableGrowthProgress objects across frames. Uses frame-scoped auto-release
 * to eliminate manual release burden.
 *
 * Usage:
 * ```typescript
 * const pool = new GrowthProgressPool();
 *
 * // In render loop:
 * pool.beginFrame();
 * for (const plant of plants) {
 *   const growth = pool.acquireAndCalculate(time, plant.delay, plant.growDuration);
 *   if (growth.isActive) {
 *     drawPlant(ctx, plant, growth);
 *   }
 * }
 * pool.endFrame();  // Auto-releases all objects
 * ```
 */

import { GROWTH_PHASES } from './constants';
import { GrowthConfig, GrowthProgress } from './GrowthProgress';

// ==================== DEFAULT CONSTANTS ====================

const DEFAULT_INITIAL_SIZE = 1024;
const DEFAULT_GROWTH_FACTOR = 2;
const DEFAULT_MAX_SIZE_WARNING = 8192;
const DEFAULT_MAX_SIZE = 16384;
const DEFAULT_SHRINK_THRESHOLD = 0.25;
const DEFAULT_FRAME_HISTORY_SIZE = 60;
const DEFAULT_LOW_USAGE_FRAMES_BEFORE_SHRINK = 10;

// Type declaration for process.env access
declare const process: { env?: { NODE_ENV?: string } } | undefined;

/**
 * Pool statistics for monitoring
 */
export interface PoolStats {
  /** Current pool capacity */
  poolSize: number;
  /** Total objects acquired across all frames */
  acquired: number;
  /** Total objects released across all frames */
  released: number;
  /** Maximum objects used in any single frame */
  peakUsage: number;
  /** Number of times pool had to grow */
  growthEvents: number;
  /** Objects acquired in current frame */
  currentFrameUsage: number;
}

/**
 * Per-frame statistics for profiling
 */
export interface FrameStats {
  /** Frame number */
  frameNumber: number;
  /** Objects used in this frame */
  usage: number;
  /** Timestamp when frame ended */
  timestamp: number;
}

/**
 * Information about a leaked object
 */
export interface LeakInfo {
  /** Frame when object was acquired */
  frameAcquired: number;
  /** Stack trace of acquisition (if available) */
  acquireStack?: string;
}

/**
 * Configuration for the pool
 */
export interface GrowthProgressPoolConfig {
  /** Initial pool size (default: 1024) */
  initialSize?: number;
  /** Enable dev-mode diagnostics (default: process.env.NODE_ENV !== 'production') */
  devMode?: boolean;
  /** Strict mode throws on lifecycle errors even in production (default: same as devMode) */
  strictMode?: boolean;
  /** Growth factor when pool needs to expand (default: 2) */
  growthFactor?: number;
  /** Maximum pool size before warning (default: 8192) */
  maxSizeWarning?: number;
  /** Maximum pool size - throws if exceeded (default: 16384) */
  maxSize?: number;
  /** Shrink when usage drops below this fraction of capacity (default: 0.25) */
  shrinkThreshold?: number;
  /** Number of low-usage frames before shrinking (default: 10) */
  lowUsageFramesBeforeShrink?: number;
}

/**
 * Mutable version of GrowthProgress for pool reuse
 *
 * WARNING: Do not store references to these objects beyond the current frame.
 * Values are reset when endFrame() is called on the pool.
 */
export class MutableGrowthProgress {
  /** Overall progress (0-1) */
  progress: number = 0;
  /** Stem growth phase (0-1) */
  stem: number = 0;
  /** Leaf growth phase (0-1) */
  leaf: number = 0;
  /** Flower/bloom growth phase (0-1) */
  flower: number = 0;
  /** Foliage growth for trees (0-1) */
  foliage: number = 0;
  /** Plume growth for grasses (0-1) */
  plume: number = 0;

  // Dev-mode tracking fields - only set when devMode is enabled on the pool
  /** @internal Frame number when this object was acquired (dev mode only) */
  _frameAcquired?: number;
  /** @internal Whether this object has been released (dev mode only) */
  _released?: boolean;
  /** @internal Stack trace of acquisition (dev mode only) */
  _acquireStack?: string;

  /**
   * Reset all values to default state
   */
  reset(): this {
    this.progress = 0;
    this.stem = 0;
    this.leaf = 0;
    this.flower = 0;
    this.foliage = 0;
    this.plume = 0;
    // Only reset dev fields if they exist
    if (this._frameAcquired !== undefined) {
      this._released = true;
      this._frameAcquired = -1;
      this._acquireStack = undefined;
    }
    return this;
  }

  /**
   * Calculate growth phases from timing parameters (mutates in place)
   *
   * @param time Current animation time
   * @param delay Plant's growth delay
   * @param duration Plant's growth duration
   * @param config Optional custom growth configuration
   */
  calculateMut(
    time: number,
    delay: number,
    duration: number,
    config: GrowthConfig = GrowthProgress.defaultConfig
  ): this {
    const rawProgress = (time - delay) / duration;
    this.progress = Math.max(0, Math.min(1, rawProgress));

    // Calculate growth phases using config
    this.stem = Math.min(1, this.progress * config.stemRate);
    this.leaf = Math.max(
      0,
      Math.min(1, (this.progress - config.leafStart) * config.leafRate)
    );
    this.flower = Math.max(
      0,
      Math.min(1, (this.progress - config.flowerStart) * config.flowerRate)
    );

    // Extended phases (use constants directly)
    this.foliage = Math.max(
      0,
      Math.min(1, (this.progress - GROWTH_PHASES.FOLIAGE_START) * GROWTH_PHASES.FOLIAGE_GROWTH_RATE)
    );
    this.plume =
      this.progress > GROWTH_PHASES.PLUME_START
        ? (this.progress - GROWTH_PHASES.PLUME_START) / (1 - GROWTH_PHASES.PLUME_START)
        : 0;

    return this;
  }

  // ==================== BOOLEAN GETTERS ====================

  /** Whether the plant has started growing */
  get isActive(): boolean {
    return this.progress > 0;
  }

  /** Whether the plant is fully grown */
  get isComplete(): boolean {
    return this.progress >= 1;
  }

  /** Whether leaves should be drawn */
  get hasLeaves(): boolean {
    return this.leaf > 0;
  }

  /** Whether flowers should be drawn */
  get hasFlower(): boolean {
    return this.flower > 0;
  }

  /** Whether tree foliage should be drawn */
  get hasFoliage(): boolean {
    return this.foliage > 0;
  }

  /** Whether grass plumes should be drawn */
  get hasPlume(): boolean {
    return this.plume > 0;
  }
}

/**
 * Object pool for MutableGrowthProgress with frame-scoped auto-release
 *
 * Objects are automatically released when endFrame() is called, eliminating
 * the need for manual release() calls and preventing memory leaks.
 */
export class GrowthProgressPool {
  private pool: MutableGrowthProgress[] = [];
  private poolMembers = new WeakSet<MutableGrowthProgress>();
  private acquireIndex: number = 0;
  private frameNumber: number = 0;
  private inFrame: boolean = false;

  // Configuration
  private readonly initialSize: number;
  private readonly devMode: boolean;
  private readonly strictMode: boolean;
  private readonly growthFactor: number;
  private readonly maxSizeWarning: number;
  private readonly maxSize: number;
  private readonly shrinkThreshold: number;
  private readonly lowUsageFramesBeforeShrink: number;

  // Statistics
  private peakUsage: number = 0;
  private growthEvents: number = 0;
  private totalAcquired: number = 0;
  private totalReleased: number = 0;
  private consecutiveLowUsageFrames: number = 0;

  // Frame history for profiling
  private frameHistory: FrameStats[] = [];
  private readonly maxHistorySize: number = DEFAULT_FRAME_HISTORY_SIZE;

  constructor(config: GrowthProgressPoolConfig = {}) {
    // Clamp config values to safe bounds
    // Minimum of 1 for sizes (allow small values for testing), max 1M for performance scenarios
    this.initialSize = Math.max(1, Math.min(1000000, config.initialSize ?? DEFAULT_INITIAL_SIZE));

    // Default devMode: true in non-production environments
    let defaultDevMode = false;
    if (typeof process !== 'undefined' && process?.env?.NODE_ENV !== 'production') {
      defaultDevMode = true;
    }
    this.devMode = config.devMode ?? defaultDevMode;
    this.strictMode = config.strictMode ?? this.devMode;

    // Clamp growthFactor to prevent infinite loops (must be > 1) or excessive growth
    this.growthFactor = Math.max(1.1, Math.min(4, config.growthFactor ?? DEFAULT_GROWTH_FACTOR));
    this.maxSizeWarning = Math.max(1, Math.min(1000000, config.maxSizeWarning ?? DEFAULT_MAX_SIZE_WARNING));
    this.maxSize = Math.max(1, Math.min(1000000, config.maxSize ?? DEFAULT_MAX_SIZE));
    this.shrinkThreshold = Math.max(0.01, Math.min(0.99, config.shrinkThreshold ?? DEFAULT_SHRINK_THRESHOLD));
    this.lowUsageFramesBeforeShrink = Math.max(1, Math.min(10000, config.lowUsageFramesBeforeShrink ?? DEFAULT_LOW_USAGE_FRAMES_BEFORE_SHRINK));

    // Pre-allocate pool
    this.pool = new Array(this.initialSize);
    for (let i = 0; i < this.initialSize; i++) {
      this.pool[i] = new MutableGrowthProgress();
      this.poolMembers.add(this.pool[i]);
    }
  }

  /**
   * Begin a new frame - must be called before acquiring objects
   */
  beginFrame(): void {
    if (this.inFrame) {
      const msg = 'GrowthProgressPool: beginFrame() called while already in frame. Did you forget endFrame()?';
      if (this.devMode) {
        console.warn(msg);
      }
      if (this.strictMode) {
        throw new Error(msg);
      }
      // Self-healing in non-strict production: just reset for new frame
      this.acquireIndex = 0;
    }

    this.frameNumber++;
    this.inFrame = true;
    this.acquireIndex = 0;
  }

  /**
   * End the current frame - automatically releases all acquired objects
   */
  endFrame(): void {
    if (!this.inFrame) {
      const msg = 'GrowthProgressPool: endFrame() called outside of frame';
      if (this.devMode) {
        console.warn(msg);
      }
      if (this.strictMode) {
        throw new Error(msg);
      }
      return; // No-op in non-strict production
    }

    // Track statistics
    const frameUsage = this.acquireIndex;
    if (frameUsage > this.peakUsage) {
      this.peakUsage = frameUsage;
    }
    this.totalReleased += frameUsage;

    // Track frame history for profiling
    this.frameHistory.push({
      frameNumber: this.frameNumber,
      usage: frameUsage,
      timestamp: Date.now(),
    });
    if (this.frameHistory.length > this.maxHistorySize) {
      this.frameHistory.shift();
    }

    // Reset all acquired objects for next frame
    for (let i = 0; i < this.acquireIndex; i++) {
      this.pool[i].reset();
    }

    this.inFrame = false;

    // Check for shrink opportunity
    this.maybeShrink(frameUsage);
  }

  /**
   * Acquire a MutableGrowthProgress from the pool
   * Objects are automatically released on endFrame()
   */
  acquire(): MutableGrowthProgress {
    if (!this.inFrame) {
      const msg = 'GrowthProgressPool: acquire() called outside of frame. Call beginFrame() first.';
      if (this.devMode || this.strictMode) {
        throw new Error(msg);
      }
      // In non-strict production, auto-start a frame (self-healing)
      this.beginFrame();
    }

    // Grow pool if needed
    if (this.acquireIndex >= this.pool.length) {
      this.grow();
    }

    const obj = this.pool[this.acquireIndex];

    // Only set dev fields in dev mode
    if (this.devMode) {
      obj._frameAcquired = this.frameNumber;
      obj._released = false;
      // Don't capture stack on every acquire - too expensive
      // Stack is captured lazily if validation fails
    }

    this.acquireIndex++;
    this.totalAcquired++;

    return obj;
  }

  /**
   * Acquire and calculate in one step (convenience method)
   *
   * @param time Current animation time
   * @param delay Plant's growth delay
   * @param duration Plant's growth duration
   * @param config Optional custom growth configuration
   */
  acquireAndCalculate(
    time: number,
    delay: number,
    duration: number,
    config?: GrowthConfig
  ): MutableGrowthProgress {
    return this.acquire().calculateMut(time, delay, duration, config);
  }

  /**
   * Grow the pool when capacity is exhausted
   * @throws Error if maxSize would be exceeded
   */
  private grow(): void {
    const oldSize = this.pool.length;
    const newSize = Math.floor(oldSize * this.growthFactor);

    if (newSize > this.maxSize) {
      throw new Error(
        `GrowthProgressPool: Maximum size ${this.maxSize} exceeded. ` +
          `This indicates a leak or unexpectedly high plant count.`
      );
    }

    if (this.devMode && newSize > this.maxSizeWarning) {
      console.warn(
        `GrowthProgressPool: Pool grew to ${newSize} objects. ` +
          `This may indicate a leak or unexpectedly high plant count.`
      );
    }

    // Extend array with new objects
    for (let i = oldSize; i < newSize; i++) {
      const obj = new MutableGrowthProgress();
      this.pool.push(obj);
      this.poolMembers.add(obj);
    }

    this.growthEvents++;
    // Reset consecutive low usage since we just grew
    this.consecutiveLowUsageFrames = 0;
  }

  /**
   * Check if pool should shrink and do so if appropriate
   */
  private maybeShrink(frameUsage: number): void {
    // Don't shrink below initial size
    if (this.pool.length <= this.initialSize) {
      this.consecutiveLowUsageFrames = 0;
      return;
    }

    const usageRatio = frameUsage / this.pool.length;

    if (usageRatio < this.shrinkThreshold) {
      this.consecutiveLowUsageFrames++;

      if (this.consecutiveLowUsageFrames >= this.lowUsageFramesBeforeShrink) {
        this.shrink();
      }
    } else {
      this.consecutiveLowUsageFrames = 0;
    }
  }

  /**
   * Shrink the pool to reclaim memory
   */
  private shrink(): void {
    const newSize = Math.max(
      this.initialSize,
      Math.floor(this.pool.length / this.growthFactor)
    );

    if (newSize >= this.pool.length) {
      return; // Nothing to shrink
    }

    // Remove objects from pool (WeakSet will GC them automatically)
    this.pool.length = newSize;
    this.consecutiveLowUsageFrames = 0;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return {
      poolSize: this.pool.length,
      acquired: this.totalAcquired,
      released: this.totalReleased,
      peakUsage: this.peakUsage,
      growthEvents: this.growthEvents,
      currentFrameUsage: this.acquireIndex,
    };
  }

  /**
   * Get frame history for profiling (rolling window of recent frames)
   */
  getFrameHistory(): readonly FrameStats[] {
    return this.frameHistory;
  }

  /**
   * Check for leaks (dev mode only)
   * Returns info about objects that were acquired but not properly released
   */
  detectLeaks(): LeakInfo[] {
    if (!this.devMode) return [];

    const leaks: LeakInfo[] = [];
    for (let i = 0; i < this.pool.length; i++) {
      const obj = this.pool[i];
      if (obj._released === false && obj._frameAcquired !== undefined && obj._frameAcquired < this.frameNumber) {
        leaks.push({
          frameAcquired: obj._frameAcquired,
          acquireStack: obj._acquireStack,
        });
      }
    }
    return leaks;
  }

  /**
   * Validate that an object is from this pool and currently valid
   * Throws in dev mode if use-after-release is detected
   */
  validateObject(obj: MutableGrowthProgress): boolean {
    if (!this.devMode) return true;

    // Check pool membership
    if (!this.poolMembers.has(obj)) {
      throw new Error(
        'GrowthProgressPool: Object is not from this pool'
      );
    }

    if (obj._released) {
      // Capture stack now for debugging
      const currentStack = new Error().stack;
      throw new Error(
        `GrowthProgressPool: Use-after-release detected. ` +
          `Object was acquired at frame ${obj._frameAcquired ?? 'unknown'}, ` +
          `current frame is ${this.frameNumber}.\n` +
          `Validation location:\n${currentStack}`
      );
    }

    if (obj._frameAcquired !== this.frameNumber) {
      throw new Error(
        `GrowthProgressPool: Stale object detected. ` +
          `Object from frame ${obj._frameAcquired ?? 'unknown'} used in frame ${this.frameNumber}.`
      );
    }

    return true;
  }

  /**
   * Reset pool to initial state
   * @internal For testing only - do not use in production
   */
  reset(): void {
    // Resize to initial size
    if (this.pool.length > this.initialSize) {
      this.pool.length = this.initialSize;
    }

    // Ensure all slots have objects and reset them
    for (let i = 0; i < this.initialSize; i++) {
      if (!this.pool[i]) {
        const obj = new MutableGrowthProgress();
        this.pool[i] = obj;
        this.poolMembers.add(obj);
      }
      this.pool[i].reset();
    }

    this.acquireIndex = 0;
    this.frameNumber = 0;
    this.inFrame = false;
    this.peakUsage = 0;
    this.growthEvents = 0;
    this.totalAcquired = 0;
    this.totalReleased = 0;
    this.consecutiveLowUsageFrames = 0;
    this.frameHistory = [];
  }

  /**
   * Get the current frame number (incremented on each beginFrame call)
   */
  getFrameNumber(): number {
    return this.frameNumber;
  }

  /**
   * Check if currently within a frame (between beginFrame and endFrame)
   */
  isInFrame(): boolean {
    return this.inFrame;
  }
}

// ==================== SINGLETON ====================

let defaultPool: GrowthProgressPool | null = null;

/**
 * Get the default pool instance (lazily created)
 */
export function getDefaultPool(): GrowthProgressPool {
  return (defaultPool ??= new GrowthProgressPool());
}

/**
 * Reset the default pool (for testing)
 */
export function resetDefaultPool(): void {
  if (defaultPool) {
    defaultPool.reset();
  }
}

/**
 * Dispose the default pool to reclaim memory
 * After calling this, getDefaultPool() will create a new instance
 */
export function disposeDefaultPool(): void {
  defaultPool = null;
}
