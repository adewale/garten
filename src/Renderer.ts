import type { PlantData, ResolvedOptions } from './types';
import { drawPlant } from './plants';
import { getPixelRatio, debounce, hexToRgb, DebouncedFunction } from './utils';
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
    this.debouncedResize = debounce(() => this.resize(), 100);

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
   * Handle resize
   */
  resize(): void {
    this.dpr = getPixelRatio(this.options.maxPixelRatio);

    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    // Guard against zero dimensions (container hidden or detached)
    if (this.width <= 0 || this.height <= 0) {
      return;
    }

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;

    // Reset transform and scale for DPR
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw ground indicator
   */
  drawGround(): void {
    this.ctx.fillStyle = 'rgba(139, 119, 101, 0.08)';
    this.ctx.fillRect(0, this.height - 8, this.width, 8);
  }

  /**
   * Apply vertical gradient fade to make plants fade out at higher positions
   * This improves content legibility when plants might obscure page content
   */
  private applyVerticalFade(): void {
    const { fadeHeight, fadeColor, maxHeight } = this.options;
    if (fadeHeight <= 0) return;

    // Parse fade color to RGB
    const rgb = hexToRgb(fadeColor);
    if (!rgb) return;

    // Calculate fade zone positions
    // Plants grow from bottom, so fade starts at (1 - maxHeight) from top
    const plantTopY = this.height * (1 - maxHeight);
    const fadeStartY = plantTopY;
    const fadeEndY = Math.max(0, plantTopY - this.height * fadeHeight);

    // Create gradient from fade color (opaque) to transparent
    const gradient = this.ctx.createLinearGradient(0, fadeEndY, 0, fadeStartY);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

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

    // Remove canvas from DOM
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
