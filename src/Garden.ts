import type {
  GardenOptions,
  GardenController,
  PlaybackState,
  PlantData,
  ResolvedOptions,
} from './types';
import { resolveOptions } from './defaults';
import { generatePlants, didGenerationComplete } from './plants';
import { Renderer } from './Renderer';
import { prefersReducedMotion } from './utils';

/**
 * Garten - A beautiful animated garden for your website
 *
 * @example
 * ```typescript
 * const garden = new Garten({
 *   container: '#my-container',
 *   duration: 600,
 *   generations: 47,
 * });
 *
 * garden.play();
 * ```
 */
export class Garten implements GardenController {
  private options: ResolvedOptions;
  private renderer!: Renderer;
  private plants: PlantData[] = [];

  private state: PlaybackState = 'idle';
  private animationId: number | null = null;
  private startTime: number = 0;
  private pausedAt: number = 0;
  private elapsedTime: number = 0;
  private speed: number = 1;
  private lastFrameTime: number = 0;
  private frameInterval: number;
  private lastReportedGeneration: number = -1;

  constructor(options: GardenOptions) {
    // Resolve and validate options
    this.options = resolveOptions(options);
    this.speed = this.options.speed;
    this.frameInterval = 1000 / this.options.targetFPS;

    // Check for reduced motion preference
    if (this.options.respectReducedMotion && prefersReducedMotion()) {
      this.handleReducedMotion();
      return;
    }

    // Initialize renderer
    this.renderer = new Renderer(this.options);

    // Generate plants
    this.plants = generatePlants(this.options);

    // Auto-play if enabled
    if (this.options.autoplay) {
      this.play();
    }
  }

  /**
   * Handle reduced motion preference
   */
  private handleReducedMotion(): void {
    this.renderer = new Renderer(this.options);
    this.plants = generatePlants(this.options);

    // Render a static frame at 100% progress
    this.renderer.renderStatic(this.plants, 1);
    this.state = 'complete';
    this.emitStateChange();
  }

  /**
   * Animation loop
   */
  private tick = (timestamp: number): void => {
    if (this.state !== 'playing') return;

    // Throttle to target FPS
    if (timestamp - this.lastFrameTime < this.frameInterval) {
      this.animationId = requestAnimationFrame(this.tick);
      return;
    }
    this.lastFrameTime = timestamp;

    // Calculate elapsed time
    const previousElapsed = this.elapsedTime;
    this.elapsedTime = (timestamp - this.startTime) * this.speed / 1000;

    // Check for generation completion
    const completedGen = didGenerationComplete(
      previousElapsed,
      this.elapsedTime,
      this.options.duration,
      this.options.generations
    );
    if (completedGen !== null && completedGen > this.lastReportedGeneration) {
      this.lastReportedGeneration = completedGen;
      this.options.events.onGenerationComplete?.(completedGen, this.options.generations);
    }

    // Emit progress
    const progress = Math.min(1, this.elapsedTime / this.options.duration);
    this.options.events.onProgress?.(progress, this.elapsedTime);

    // Render frame
    this.renderer.render(this.plants, this.elapsedTime);

    // Check for completion
    if (this.elapsedTime >= this.options.duration) {
      if (this.options.loop) {
        // Reset for loop
        this.startTime = timestamp;
        this.elapsedTime = 0;
        this.lastReportedGeneration = -1;
      } else {
        this.state = 'complete';
        this.emitStateChange();
        this.options.events.onComplete?.();
        return;
      }
    }

    // Continue animation
    this.animationId = requestAnimationFrame(this.tick);
  };

  /**
   * Emit state change event
   */
  private emitStateChange(): void {
    this.options.events.onStateChange?.(this.state);
  }

  /**
   * Start or resume playback
   */
  play(): void {
    if (this.state === 'playing') return;

    if (this.state === 'paused') {
      // Resume from paused position
      this.startTime = performance.now() - (this.pausedAt * 1000 / this.speed);
    } else {
      // Start fresh
      this.startTime = performance.now();
      this.elapsedTime = 0;
      this.lastReportedGeneration = -1;
    }

    this.state = 'playing';
    this.emitStateChange();
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame(this.tick);
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.state !== 'playing') return;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.pausedAt = this.elapsedTime;
    this.state = 'paused';
    this.emitStateChange();
  }

  /**
   * Stop and reset to beginning
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.elapsedTime = 0;
    this.pausedAt = 0;
    this.lastReportedGeneration = -1;
    this.state = 'idle';
    this.emitStateChange();

    // Render initial state
    this.renderer.render(this.plants, 0);
  }

  /**
   * Jump to specific time in seconds
   */
  seek(time: number): void {
    const clampedTime = Math.max(0, Math.min(time, this.options.duration));

    if (this.state === 'playing') {
      this.startTime = performance.now() - (clampedTime * 1000 / this.speed);
    } else {
      this.pausedAt = clampedTime;
    }

    this.elapsedTime = clampedTime;

    // Update generation tracking
    const currentGen = Math.floor(clampedTime / (this.options.duration / this.options.generations));
    this.lastReportedGeneration = currentGen - 1;

    // Render at new position
    this.renderer.render(this.plants, clampedTime);
  }

  /**
   * Set playback speed multiplier
   */
  setSpeed(speed: number): void {
    if (speed <= 0) {
      throw new Error('Garten: Speed must be positive');
    }

    const wasPlaying = this.state === 'playing';

    if (wasPlaying) {
      // Pause to recalculate timing
      this.pause();
    }

    this.speed = speed;

    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    return this.state;
  }

  /**
   * Get current progress (0-1)
   */
  getProgress(): number {
    return Math.min(1, this.elapsedTime / this.options.duration);
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedTime(): number {
    return this.elapsedTime;
  }

  /**
   * Update options
   */
  setOptions(newOptions: Partial<GardenOptions>): void {
    const needsRegeneration =
      newOptions.generations !== undefined ||
      newOptions.density !== undefined ||
      newOptions.maxHeight !== undefined ||
      newOptions.colors !== undefined ||
      newOptions.seed !== undefined;

    // Merge options
    this.options = resolveOptions({
      container: this.options.container,
      ...newOptions,
    });

    // Update renderer
    this.renderer.setOptions(this.options);

    // Regenerate if needed
    if (needsRegeneration) {
      this.regenerate();
    }

    // Update speed if changed
    if (newOptions.speed !== undefined) {
      this.setSpeed(newOptions.speed);
    }
  }

  /**
   * Force regenerate all plants
   */
  regenerate(): void {
    const wasPlaying = this.state === 'playing';
    if (wasPlaying) {
      this.pause();
    }

    this.plants = generatePlants(this.options);

    // Re-render at current position
    this.renderer.render(this.plants, this.elapsedTime);

    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Clean up and remove from DOM
   */
  destroy(): void {
    // Stop animation
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Clean up renderer
    this.renderer.destroy();

    // Clear state
    this.plants = [];
    this.state = 'idle';
  }
}
