import type { PlantData, ResolvedOptions } from './types';
import { drawPlant } from './plants';
import { getPixelRatio, debounce, hexToRgb, DebouncedFunction } from './utils';
import { ANIMATION, COLORS } from './constants';
import { GrowthProgressPool } from './GrowthProgressPool';

/**
 * Handles canvas setup, resizing, and rendering
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;
  private options: ResolvedOptions;
  private resizeObserver: ResizeObserver | null = null;
  private resizeHandler: (() => void) | null = null;
  private debouncedResize: DebouncedFunction<() => void> | null = null;
  private dpr: number = 1;
  private width: number = 0;
  private height: number = 0;
  private pool: GrowthProgressPool;

  // Last rendered frame, kept so resize (which wipes the canvas bitmap)
  // can restore the picture even when the animation is not playing
  private lastPlants: PlantData[] | null = null;
  private lastTime: number = 0;

  // Tracks whether an unparseable fadeColor has been reported (warn once)
  private warnedInvalidFadeColor = false;

  // Cached fade gradient state (avoid re-creating gradient + strings every frame)
  private fadeGradientCache: {
    fadeColor: string;
    fadeHeight: number;
    maxHeight: number;
    width: number;
    height: number;
    gradient: CanvasGradient;
    fadeStartY: number;
  } | null = null;

  constructor(options: ResolvedOptions) {
    this.options = options;
    this.container = options.container;
    // Each Renderer gets its own pool for isolated state
    this.pool = new GrowthProgressPool();

    // Create canvas with configurable z-index and opacity
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: ${options.zIndex};
      opacity: ${options.opacity};
    `;

    // Set accessibility attributes
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.setAttribute('role', 'presentation');

    // Get context
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error(
        'Garten: Could not create 2D canvas context. ' +
        'Check that browser supports the Canvas API.'
      );
    }
    this.ctx = ctx;

    // Setup container
    this.setupContainer();

    // Insert canvas
    this.container.insertBefore(this.canvas, this.container.firstChild);

    // Initial sizing
    this.resize();

    // Setup resize observer
    this.setupResizeObserver();
  }

  /**
   * Ensure container has proper positioning
   */
  private setupContainer(): void {
    const style = window.getComputedStyle(this.container);
    if (style.position === 'static') {
      this.container.style.position = 'relative';
    }
  }

  /**
   * Setup resize observer for responsive sizing
   */
  private setupResizeObserver(): void {
    this.debouncedResize = debounce(() => this.resize(), ANIMATION.RESIZE_DEBOUNCE_MS);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.debouncedResize);
      this.resizeObserver.observe(this.container);
    } else {
      // Fallback for older browsers - store handler for cleanup
      this.resizeHandler = this.debouncedResize;
      window.addEventListener('resize', this.resizeHandler);
    }
  }

  /**
   * Handle resize.
   * Note: assigning canvas.width/height wipes the bitmap, so the last
   * rendered frame is restored afterwards — otherwise a resize while
   * paused/complete would leave the garden blank.
   */
  resize(): void {
    this.dpr = getPixelRatio(this.options.maxPixelRatio);

    const rect = this.container.getBoundingClientRect();

    // Guard against zero dimensions (container hidden or detached):
    // keep the previous dimensions and bitmap untouched
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;

    // Reset transform and scale for DPR
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);

    // Restore the last frame at the new size
    if (this.lastPlants) {
      this.render(this.lastPlants, this.lastTime);
    }
  }

  /**
   * Clear the canvas to the configured background
   * ('transparent' lets the page show through — the default)
   */
  clear(): void {
    const { background } = this.options;
    if (!background || background === 'transparent') {
      this.ctx.clearRect(0, 0, this.width, this.height);
      return;
    }
    this.ctx.fillStyle = background;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw ground indicator
   */
  drawGround(): void {
    this.ctx.fillStyle = COLORS.GROUND_COLOR;
    this.ctx.fillRect(0, this.height - ANIMATION.GROUND_HEIGHT, this.width, ANIMATION.GROUND_HEIGHT);
  }

  /**
   * Apply vertical gradient fade to make plants fade out at higher positions
   * This improves content legibility when plants might obscure page content
   */
  private applyVerticalFade(): void {
    const { fadeHeight, fadeColor, maxHeight } = this.options;
    if (fadeHeight <= 0) return;

    // Reuse cached gradient if inputs haven't changed
    const cache = this.fadeGradientCache;
    if (
      !cache ||
      cache.fadeColor !== fadeColor ||
      cache.fadeHeight !== fadeHeight ||
      cache.maxHeight !== maxHeight ||
      cache.width !== this.width ||
      cache.height !== this.height
    ) {
      // Parse fade color to RGB
      const rgb = hexToRgb(fadeColor);
      if (!rgb) {
        // Don't silently disable the fade the user asked for
        if (!this.warnedInvalidFadeColor) {
          this.warnedInvalidFadeColor = true;
          console.warn(
            `Garten: fadeColor ${JSON.stringify(fadeColor)} is not a valid hex color; the fade effect is disabled.`
          );
        }
        return;
      }

      // Calculate fade zone positions
      const plantTopY = this.height * (1 - maxHeight);
      const fadeStartY = plantTopY;
      const fadeEndY = Math.max(0, plantTopY - this.height * fadeHeight);

      // Create gradient from fade color (opaque) to transparent
      const gradient = this.ctx.createLinearGradient(0, fadeEndY, 0, fadeStartY);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

      this.fadeGradientCache = {
        fadeColor,
        fadeHeight,
        maxHeight,
        width: this.width,
        height: this.height,
        gradient,
        fadeStartY,
      };
    }

    const { gradient, fadeStartY } = this.fadeGradientCache!;

    // Apply fade using destination-out composite
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, fadeStartY);
    this.ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Render all plants
   * Pre-filters plants that haven't started growing to avoid unnecessary draw calls
   * Uses object pool for growth phase calculations to minimize allocations
   */
  render(plants: PlantData[], time: number): void {
    this.lastPlants = plants;
    this.lastTime = time;

    this.pool.beginFrame();
    try {
      this.clear();
      this.drawGround();

      for (const plant of plants) {
        // Skip plants that haven't started growing yet
        if (time < plant.delay) continue;
        drawPlant(this.ctx, plant, this.width, this.height, time, this.pool);
      }

      // Apply vertical fade if configured
      this.applyVerticalFade();
    } finally {
      this.pool.endFrame();
    }
  }

  /**
   * Render a static frame (for reduced motion)
   */
  renderStatic(plants: PlantData[], progress: number): void {
    const staticTime = progress * this.options.duration;
    this.render(plants, staticTime);
  }

  /**
   * Get canvas dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Update options
   */
  setOptions(options: ResolvedOptions): void {
    this.options = options;

    // Invalidate cached gradient when options change
    this.fadeGradientCache = null;
    this.warnedInvalidFadeColor = false;

    // Update canvas style if z-index or opacity changed
    this.canvas.style.zIndex = String(options.zIndex);
    this.canvas.style.opacity = String(options.opacity);

    this.resize();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Cancel any pending debounced resize
    if (this.debouncedResize) {
      this.debouncedResize.cancel();
      this.debouncedResize = null;
    }

    // Clean up ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clean up window resize listener (fallback for older browsers)
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    // Reset object pool to free memory
    this.pool.reset();

    // Release cached gradient and last-frame references
    this.fadeGradientCache = null;
    this.lastPlants = null;

    // Remove canvas from DOM
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
