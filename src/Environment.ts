/**
 * Environment Detection - Centralized browser capability checks
 * Detects device capabilities and user preferences
 */

/**
 * Environment capabilities
 */
export interface EnvironmentCapabilities {
  /** Whether we're in a browser environment */
  isBrowser: boolean;
  /** Whether Canvas 2D is supported */
  hasCanvas: boolean;
  /** Whether ResizeObserver is available */
  hasResizeObserver: boolean;
  /** Whether requestAnimationFrame is available */
  hasRAF: boolean;
  /** Whether high DPI screens are detected */
  isHighDPI: boolean;
  /** Device pixel ratio */
  pixelRatio: number;
  /** Whether touch is supported */
  hasTouch: boolean;
  /** Whether the device is likely mobile */
  isMobile: boolean;
  /** Whether reduced motion is preferred */
  prefersReducedMotion: boolean;
  /** Whether dark mode is preferred */
  prefersDarkMode: boolean;
  /** Whether the page is currently visible */
  isPageVisible: boolean;
}

/**
 * Environment class - Centralized capability detection
 *
 * Usage:
 * ```typescript
 * const env = Environment.detect();
 *
 * if (env.prefersReducedMotion) {
 *   // Skip animation
 * }
 *
 * const dpr = env.getClampedPixelRatio(2);
 *
 * // Listen for visibility changes
 * const cleanup = Environment.onVisibilityChange((visible) => {
 *   if (visible) garden.play();
 *   else garden.pause();
 * });
 * ```
 */
export class Environment {
  private static _cached: EnvironmentCapabilities | null = null;
  private static _visibilityListeners: Set<(visible: boolean) => void> = new Set();
  private static _visibilityHandler: (() => void) | null = null;

  // ==================== DETECTION ====================

  /**
   * Detect current environment capabilities
   * Results are cached for performance
   */
  static detect(): EnvironmentCapabilities {
    if (this._cached) {
      return this._cached;
    }

    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    if (!isBrowser) {
      this._cached = {
        isBrowser: false,
        hasCanvas: false,
        hasResizeObserver: false,
        hasRAF: false,
        isHighDPI: false,
        pixelRatio: 1,
        hasTouch: false,
        isMobile: false,
        prefersReducedMotion: false,
        prefersDarkMode: false,
        isPageVisible: true,
      };
      return this._cached;
    }

    const pixelRatio = window.devicePixelRatio || 1;

    this._cached = {
      isBrowser: true,
      hasCanvas: this.checkCanvasSupport(),
      hasResizeObserver: typeof ResizeObserver !== 'undefined',
      hasRAF: typeof requestAnimationFrame !== 'undefined',
      isHighDPI: pixelRatio > 1,
      pixelRatio,
      hasTouch: this.checkTouchSupport(),
      isMobile: this.checkMobile(),
      prefersReducedMotion: this.checkReducedMotion(),
      prefersDarkMode: this.checkDarkMode(),
      isPageVisible: this.checkPageVisibility(),
    };

    return this._cached;
  }

  /**
   * Clear cached detection (useful for testing)
   */
  static clearCache(): void {
    this._cached = null;
  }

  // ==================== INDIVIDUAL CHECKS ====================

  /**
   * Check if Canvas 2D is supported
   */
  private static checkCanvasSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch {
      return false;
    }
  }

  /**
   * Check if touch is supported
   */
  private static checkTouchSupport(): boolean {
    return 'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-expect-error - msMaxTouchPoints is IE-specific
      (navigator.msMaxTouchPoints || 0) > 0;
  }

  /**
   * Check if device is likely mobile
   */
  private static checkMobile(): boolean {
    // Check user agent
    const ua = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
    const isMobileUA = mobileKeywords.some(keyword => ua.includes(keyword));

    // Check screen size
    const isSmallScreen = window.innerWidth <= 768;

    // Check touch capability
    const hasTouch = this.checkTouchSupport();

    return isMobileUA || (hasTouch && isSmallScreen);
  }

  /**
   * Check if user prefers reduced motion
   */
  private static checkReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Check if user prefers dark mode
   */
  private static checkDarkMode(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Check if page is currently visible
   */
  private static checkPageVisibility(): boolean {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  }

  // ==================== PUBLIC UTILITY METHODS ====================

  /**
   * Check if reduced motion is preferred
   */
  static prefersReducedMotion(): boolean {
    return this.detect().prefersReducedMotion;
  }

  /**
   * Check if dark mode is preferred
   */
  static prefersDarkMode(): boolean {
    return this.detect().prefersDarkMode;
  }

  /**
   * Get device pixel ratio, clamped to a maximum
   */
  static getPixelRatio(max: number = 2): number {
    const env = this.detect();
    return Math.min(env.pixelRatio, max);
  }

  /**
   * Check if page is visible
   */
  static isPageVisible(): boolean {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  }

  /**
   * Check if the environment supports all required features
   */
  static isSupported(): boolean {
    const env = this.detect();
    return env.isBrowser && env.hasCanvas && env.hasRAF;
  }

  /**
   * Get recommended settings based on device capabilities
   */
  static getRecommendedSettings(): {
    maxPixelRatio: number;
    targetFPS: number;
    density: 'sparse' | 'normal' | 'dense';
  } {
    const env = this.detect();

    // Low-end mobile device
    if (env.isMobile && env.pixelRatio > 2) {
      return {
        maxPixelRatio: 1.5,
        targetFPS: 24,
        density: 'sparse',
      };
    }

    // Standard mobile
    if (env.isMobile) {
      return {
        maxPixelRatio: 2,
        targetFPS: 30,
        density: 'normal',
      };
    }

    // High DPI desktop
    if (env.isHighDPI) {
      return {
        maxPixelRatio: 2,
        targetFPS: 30,
        density: 'normal',
      };
    }

    // Standard desktop
    return {
      maxPixelRatio: 1,
      targetFPS: 30,
      density: 'dense',
    };
  }

  // ==================== EVENT LISTENERS ====================

  /**
   * Listen for page visibility changes
   * @returns Cleanup function
   */
  static onVisibilityChange(callback: (visible: boolean) => void): () => void {
    if (typeof document === 'undefined') {
      return () => {};
    }

    this._visibilityListeners.add(callback);

    // Set up handler if not already done
    if (!this._visibilityHandler) {
      this._visibilityHandler = () => {
        const visible = !document.hidden;
        for (const listener of this._visibilityListeners) {
          try {
            listener(visible);
          } catch (error) {
            console.error('Error in visibility change handler:', error);
          }
        }
      };
      document.addEventListener('visibilitychange', this._visibilityHandler);
    }

    // Return cleanup function
    return () => {
      this._visibilityListeners.delete(callback);

      // Clean up handler if no more listeners
      if (this._visibilityListeners.size === 0 && this._visibilityHandler) {
        document.removeEventListener('visibilitychange', this._visibilityHandler);
        this._visibilityHandler = null;
      }
    };
  }

  /**
   * Listen for reduced motion preference changes
   * @returns Cleanup function
   */
  static onReducedMotionChange(callback: (prefersReduced: boolean) => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handler = (e: MediaQueryListEvent) => {
      // Invalidate cache
      this._cached = null;
      callback(e.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }

    // Legacy browsers - addListener/removeListener are deprecated but needed for older browsers
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }

  /**
   * Listen for dark mode preference changes
   * @returns Cleanup function
   */
  static onDarkModeChange(callback: (prefersDark: boolean) => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
      // Invalidate cache
      this._cached = null;
      callback(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }

    // Legacy browsers - addListener/removeListener are deprecated but needed for older browsers
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }

  /**
   * Listen for window resize
   * @returns Cleanup function
   */
  static onResize(callback: (width: number, height: number) => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handler = () => {
      callback(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }
}

// ==================== STANDALONE FUNCTIONS FOR BACKWARD COMPATIBILITY ====================

/**
 * Check if prefers-reduced-motion is enabled
 * Backward compatible with existing utils.ts function
 */
export function prefersReducedMotion(): boolean {
  return Environment.prefersReducedMotion();
}

/**
 * Get device pixel ratio, clamped to max
 * Backward compatible with existing utils.ts function
 */
export function getPixelRatio(max: number): number {
  return Environment.getPixelRatio(max);
}

/**
 * Check if running in a browser environment
 */
export function isBrowser(): boolean {
  return Environment.detect().isBrowser;
}

/**
 * Check if Canvas 2D is supported
 */
export function hasCanvasSupport(): boolean {
  return Environment.detect().hasCanvas;
}
