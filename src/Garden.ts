import type {
  GardenOptions,
  GardenController,
  GardenEventType,
  GardenEventData,
  PlaybackState,
  PlantData,
  ResolvedOptions,
} from './types';
import { resolveOptions } from './defaults';
import { generatePlants } from './plants';
import { Renderer } from './Renderer';
import { EventEmitter } from './EventEmitter';
import { prefersReducedMotion, omitUndefined } from './utils';
import { OPTION_BOUNDS } from './constants';

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
 * garden.on('complete', () => console.log('done'));
 * garden.play();
 * ```
 */
export class Garten implements GardenController {
  private options: ResolvedOptions;
  private renderer!: Renderer;
  private plants: PlantData[] = [];
  private emitter: EventEmitter = new EventEmitter();

  private destroyed: boolean = false;
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
   * Handle reduced motion preference: render the completed garden as a
   * static frame. An explicit play() call afterwards still animates —
   * a direct user action is treated as consent to motion.
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

    let shouldContinue: boolean;
    try {
      shouldContinue = this.advanceFrame(timestamp);
    } catch (error) {
      this.handleFrameError(error);
      return;
    }

    if (shouldContinue) {
      this.animationId = requestAnimationFrame(this.tick);
    }
  };

  /**
   * Advance one animation frame
   * @returns false when the animation completed (non-looping)
   */
  private advanceFrame(timestamp: number): boolean {
    this.elapsedTime = (timestamp - this.startTime) * this.speed / 1000;

    // Report every generation boundary crossed since the last frame —
    // background tabs and slow frames can cross several at once
    this.emitGenerationEvents();

    // Emit progress
    const progress = Math.min(1, this.elapsedTime / this.options.duration);
    this.options.events.onProgress?.(progress, this.elapsedTime);
    if (this.emitter.hasListeners('progress')) {
      this.emitter.emit('progress', { progress, elapsedTime: this.elapsedTime });
    }

    // Render frame (clamp time to prevent overflow beyond duration)
    const renderTime = Math.min(this.elapsedTime, this.options.duration);
    this.renderer.render(this.plants, renderTime);

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
        this.emitter.emit('complete', undefined);
        return false;
      }
    }

    return true;
  }

  /**
   * Fire generation-complete events for every boundary crossed since the
   * last reported generation, up to the current elapsed time
   */
  private emitGenerationEvents(): void {
    const { duration, generations } = this.options;
    if (generations <= 0 || duration <= 0) return;

    const timePerGen = duration / generations;
    const currentGen = Math.min(generations, Math.floor(this.elapsedTime / timePerGen));

    for (let gen = Math.max(1, this.lastReportedGeneration + 1); gen <= currentGen; gen++) {
      this.options.events.onGenerationComplete?.(gen, generations);
      if (this.emitter.hasListeners('generationComplete')) {
        this.emitter.emit('generationComplete', {
          generation: gen,
          totalGenerations: generations,
        });
      }
    }

    if (currentGen > this.lastReportedGeneration) {
      this.lastReportedGeneration = currentGen;
    }
  }

  /**
   * Contain a frame error: stop the loop in a resumable state instead of
   * leaving it stranded in 'playing' with no scheduled frame
   */
  private handleFrameError(error: unknown): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.pausedAt = this.elapsedTime;
    this.state = 'paused';
    this.emitStateChange();
    console.error(
      'Garten: A rendering error occurred; the animation has been paused. ' +
      'Call play() to retry.',
      error
    );
  }

  /**
   * Emit state change event
   */
  private emitStateChange(): void {
    this.options.events.onStateChange?.(this.state);
    if (this.emitter.hasListeners('stateChange')) {
      this.emitter.emit('stateChange', { state: this.state });
    }
  }

  /**
   * Start or resume playback.
   * Resumes from a previous pause() or seek() position; starts from the
   * beginning when idle or complete.
   */
  play(): void {
    if (this.destroyed || this.state === 'playing') return;

    const duration = this.options.duration;
    const startFrom =
      this.state === 'paused'
        ? this.pausedAt
        : this.elapsedTime > 0 && this.elapsedTime < duration
          ? this.elapsedTime // positioned via seek() while idle/complete
          : 0;

    if (startFrom === 0) {
      // Start fresh
      this.elapsedTime = 0;
      this.lastReportedGeneration = -1;
    }
    this.startTime = performance.now() - (startFrom * 1000 / this.speed);

    this.state = 'playing';
    this.emitStateChange();
    this.emitter.emit('play', undefined);
    // Allow the first frame to render immediately
    this.lastFrameTime = performance.now() - this.frameInterval;
    this.animationId = requestAnimationFrame(this.tick);
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.destroyed || this.state !== 'playing') return;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.pausedAt = this.elapsedTime;
    this.state = 'paused';
    this.emitStateChange();
    this.emitter.emit('pause', undefined);
  }

  /**
   * Stop and reset to beginning
   */
  stop(): void {
    if (this.destroyed) return;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.elapsedTime = 0;
    this.pausedAt = 0;
    this.lastReportedGeneration = -1;
    this.state = 'idle';
    this.emitStateChange();
    this.emitter.emit('stop', undefined);

    // Render initial state
    this.renderer.render(this.plants, 0);
  }

  /**
   * Jump to specific time in seconds
   * @param time - Time in seconds to seek to (clamped to [0, duration]).
   *   Non-finite values are ignored.
   * @remarks Generation-complete events are not fired for boundaries the
   *   seek jumps across; subsequent playback resumes correct numbering.
   */
  seek(time: number): void {
    if (this.destroyed || !Number.isFinite(time)) return;

    const clampedTime = Math.max(0, Math.min(time, this.options.duration));

    if (this.state === 'playing') {
      this.startTime = performance.now() - (clampedTime * 1000 / this.speed);
    } else {
      this.pausedAt = clampedTime;
    }

    this.elapsedTime = clampedTime;

    // Align generation tracking with the new position without firing
    // catch-up events (guard against division by zero)
    const timePerGen = this.options.generations > 0
      ? this.options.duration / this.options.generations
      : 0;
    this.lastReportedGeneration = timePerGen > 0
      ? Math.min(this.options.generations, Math.floor(clampedTime / timePerGen))
      : 0;

    // Render at new position
    this.renderer.render(this.plants, clampedTime);

    if (clampedTime >= this.options.duration && !this.options.loop) {
      // Seeking to the end completes the animation
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      if (this.state !== 'complete') {
        this.state = 'complete';
        this.emitStateChange();
        this.options.events.onComplete?.();
        this.emitter.emit('complete', undefined);
      }
    } else if (this.state === 'complete') {
      // Seeking backward out of the completed state is resumable
      this.state = 'paused';
      this.emitStateChange();
    }
  }

  /**
   * Set playback speed multiplier
   * @param speed - Speed multiplier; must be a positive finite number.
   *   Values outside the supported range are clamped.
   * @throws {Error} If speed is not a positive finite number
   */
  setSpeed(speed: number): void {
    if (this.destroyed) return;
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed <= 0) {
      throw new Error('Garten: Speed must be a positive finite number');
    }

    const { min, max } = OPTION_BOUNDS.SPEED;
    const clamped = Math.min(max, Math.max(min, speed));

    const wasPlaying = this.state === 'playing';

    if (wasPlaying) {
      // Pause to recalculate timing
      this.pause();
    }

    this.speed = clamped;
    this.options.speed = clamped;

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
   * Subscribe to a lifecycle event
   * @returns Unsubscribe function
   */
  on<K extends GardenEventType>(
    event: K,
    handler: (data: GardenEventData[K]) => void
  ): () => void {
    return this.emitter.on(event, handler);
  }

  /**
   * Subscribe to a lifecycle event for one occurrence only
   * @returns Unsubscribe function
   */
  once<K extends GardenEventType>(
    event: K,
    handler: (data: GardenEventData[K]) => void
  ): () => void {
    return this.emitter.once(event, handler);
  }

  /**
   * Unsubscribe a handler from a lifecycle event
   */
  off<K extends GardenEventType>(
    event: K,
    handler: (data: GardenEventData[K]) => void
  ): void {
    this.emitter.off(event, handler);
  }

  /**
   * Update options
   * @throws {Error} If `speed` is not a positive finite number, or if
   *   `container` differs from the construction container (the canvas
   *   cannot be re-parented — create a new instance instead)
   */
  setOptions(newOptions: Partial<GardenOptions>): void {
    if (this.destroyed) return;

    // Validate before mutating any state
    if (newOptions.speed !== undefined) {
      if (
        typeof newOptions.speed !== 'number' ||
        !Number.isFinite(newOptions.speed) ||
        newOptions.speed <= 0
      ) {
        throw new Error('Garten: Speed must be a positive finite number');
      }
    }
    if (newOptions.container !== undefined) {
      const target =
        typeof newOptions.container === 'string'
          ? document.querySelector(newOptions.container)
          : newOptions.container;
      if (target !== this.options.container) {
        throw new Error(
          'Garten: container cannot be changed after construction. ' +
          'Destroy this instance and create a new one instead.'
        );
      }
    }

    const needsRegeneration =
      newOptions.generations !== undefined ||
      newOptions.density !== undefined ||
      newOptions.maxHeight !== undefined ||
      newOptions.colors !== undefined ||
      newOptions.seed !== undefined ||
      newOptions.categories !== undefined ||
      newOptions.timingCurve !== undefined ||
      newOptions.duration !== undefined;

    // Deep merge colors to preserve existing sub-properties
    // (omitUndefined: explicit undefined must not clobber current values)
    const mergedColors = newOptions.colors
      ? {
          accent: this.options.colors.accent,
          palette: this.options.colors.palette,
          accentWeight: this.options.colors.accentWeight,
          flowerColors: this.options.colors.flowerColors,
          foliageColors: this.options.colors.foliageColors,
          ...omitUndefined(newOptions.colors),
        }
      : undefined;

    // Merge options, preserving existing values
    this.options = resolveOptions({
      container: this.options.container,
      duration: this.options.duration,
      generations: this.options.generations,
      maxHeight: this.options.maxHeight,
      density: this.options.density,
      categories: this.options.categories ?? undefined,
      seed: this.options.seed,
      timingCurve: this.options.timingCurve,
      background: this.options.background,
      opacity: this.options.opacity,
      zIndex: this.options.zIndex,
      loop: this.options.loop,
      speed: this.options.speed,
      autoplay: this.options.autoplay,
      respectReducedMotion: this.options.respectReducedMotion,
      maxPixelRatio: this.options.maxPixelRatio,
      targetFPS: this.options.targetFPS,
      fadeHeight: this.options.fadeHeight,
      fadeColor: this.options.fadeColor,
      events: this.options.events,
      colors: {
        accent: this.options.colors.accent,
        palette: this.options.colors.palette,
        accentWeight: this.options.colors.accentWeight,
        flowerColors: this.options.colors.flowerColors,
        foliageColors: this.options.colors.foliageColors,
      },
      ...omitUndefined(newOptions),
      ...(mergedColors ? { colors: mergedColors } : {}),
    });

    // Update renderer
    this.renderer.setOptions(this.options);

    // Clamp time-based state if duration was reduced
    if (newOptions.duration !== undefined) {
      this.pausedAt = Math.min(this.pausedAt, this.options.duration);
      this.elapsedTime = Math.min(this.elapsedTime, this.options.duration);
    }

    this.frameInterval = 1000 / this.options.targetFPS;

    if (this.emitter.hasListeners('optionsChange')) {
      this.emitter.emit('optionsChange', { options: newOptions });
    }

    // Regenerate if needed
    if (needsRegeneration) {
      this.regenerate();
    } else if (this.state !== 'playing') {
      // Visual-only changes (background, fade, opacity, ...) must be
      // visible immediately, not on the next playing frame
      this.renderer.render(this.plants, Math.min(this.elapsedTime, this.options.duration));
    }

    // Update speed if changed (use the resolved, clamped value)
    if (newOptions.speed !== undefined) {
      this.setSpeed(this.options.speed);
    }
  }

  /**
   * Force regenerate all plants
   */
  regenerate(): void {
    if (this.destroyed) return;

    const wasPlaying = this.state === 'playing';
    if (wasPlaying) {
      this.pause();
    }

    this.plants = generatePlants(this.options);

    // Align generation tracking with the current position (no catch-up
    // events for boundaries that already passed)
    const genDuration = this.options.duration / this.options.generations;
    const currentGen = genDuration > 0 ? Math.floor(this.elapsedTime / genDuration) : 0;
    this.lastReportedGeneration = Math.min(currentGen, this.options.generations);

    // Re-render at current position
    this.renderer.render(this.plants, this.elapsedTime);

    this.emitter.emit('regenerate', undefined);

    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Clean up and remove from DOM.
   * After destroy() all controller methods become no-ops.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // Stop animation
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Clean up renderer
    this.renderer.destroy();

    // Release event callback references to allow GC of captured closures
    this.options.events = {};
    this.emitter.removeAllListeners();

    // Clear state
    this.plants = [];
    this.elapsedTime = 0;
    this.pausedAt = 0;
    this.state = 'idle';
  }
}
