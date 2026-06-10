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

// Color helpers are implemented once in Color.ts (3/6/8-digit hex support).
// Re-exported here so internal call sites and the public API share one
// implementation — a previous duplicate here only handled 6-digit hex.
export { hexToRgb, rgbToHex, lightenColor, darkenColor } from './Color';

// Environment checks are implemented once in Environment.ts.
export { prefersReducedMotion, getPixelRatio } from './Environment';

/**
 * Shallow-copy an object, dropping keys whose value is `undefined`.
 * Prevents explicit-undefined fields from clobbering defaults in spreads:
 * `{ ...defaults, ...omitUndefined(user) }`.
 */
export function omitUndefined<T extends object>(obj: T | undefined): Partial<T> {
  const result: Partial<T> = {};
  if (!obj) return result;
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
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
    // Clamp to prevent division issues (too small) and numerical instability (too large)
    return Math.max(0.1, Math.min(10, curve));
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
  // Guard against division by zero
  if (totalGenerations <= 0) return 0;

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
