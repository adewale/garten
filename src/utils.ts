import type { TimingCurve } from './types';

// Re-export RNG functions from SeededRandom to avoid duplication
export { seededRandom, createRandom, pickRandom, randomRange } from './SeededRandom';

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Parse hex color to RGB components
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
}

/**
 * Lighten a hex color
 */
export function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  return rgbToHex(
    Math.min(255, rgb.r + (255 - rgb.r) * amount),
    Math.min(255, rgb.g + (255 - rgb.g) * amount),
    Math.min(255, rgb.b + (255 - rgb.b) * amount)
  );
}

/**
 * Darken a hex color
 */
export function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  return rgbToHex(rgb.r * (1 - amount), rgb.g * (1 - amount), rgb.b * (1 - amount));
}

/**
 * Check if prefers-reduced-motion is enabled
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get device pixel ratio, clamped to max
 */
export function getPixelRatio(max: number): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, max);
}

/**
 * Debounce a function, returns object with cancel method
 */
export interface DebouncedFunction<T extends (...args: unknown[]) => void> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };

  debounced.cancel = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  return debounced as DebouncedFunction<T>;
}

/**
 * Convert timing curve preset to exponent value
 */
export function getTimingExponent(curve: TimingCurve): number {
  if (typeof curve === 'number') {
    return Math.max(0.1, curve); // Clamp to prevent division issues
  }
  switch (curve) {
    case 'ease-out': return 2.0;
    case 'ease-in': return 0.5;
    case 'ease-in-out': return 1.0; // Special case handled separately
    case 'linear':
    default: return 1.0;
  }
}

/**
 * Apply timing curve to normalize a generation's position in time
 * Returns the warped time position (0-1) for a given generation
 */
export function applyTimingCurve(
  generation: number,
  totalGenerations: number,
  curve: TimingCurve
): number {
  const normalizedGen = generation / totalGenerations;

  if (curve === 'linear' || curve === 1) {
    return normalizedGen;
  }

  if (curve === 'ease-in-out') {
    // Smooth S-curve using smoothstep formula
    const t = normalizedGen;
    return t * t * (3 - 2 * t);
  }

  const exponent = getTimingExponent(curve);

  if (exponent > 1) {
    // Ease-out: fast start, slow end
    return 1 - Math.pow(1 - normalizedGen, exponent);
  } else {
    // Ease-in: slow start, fast end
    return Math.pow(normalizedGen, 1 / exponent);
  }
}
