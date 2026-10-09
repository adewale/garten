import type { TimingCurve } from './types';

// Re-export RNG functions from SeededRandom to avoid duplication
export { seededRandom, createRandom, pickRandom, randomRange } from './SeededRandom';

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  // Return the endpoints exactly: a + (b - a) * t can miss b by an ulp at
  // t = 1, and (b - a) can overflow to Infinity (Infinity * 0 is NaN at t = 0)
  if (t === 0) return a;
  if (t === 1) return b;
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
 * Start time (0-1) of a generation under a timing curve.
 *
 * The curve names describe how generations arrive over time, with the same
 * meaning as GrowthProgress.eased(): the fraction of generations that have
 * started by time t follows the easing curve. A generation's start time is
 * therefore the curve's *inverse* applied to its index. 'ease-out' (fast
 * start) packs early generations close together and spreads late ones out.
 */
export function applyTimingCurve(
  generation: number,
  totalGenerations: number,
  curve: TimingCurve
): number {
  // Guard against division by zero
  if (totalGenerations <= 0) return 0;

  const normalizedGen = Math.min(1, Math.max(0, generation / totalGenerations));

  if (curve === 'linear' || curve === 1) {
    return normalizedGen;
  }

  if (curve === 'ease-in-out') {
    // Inverse of eased('ease-in-out') (2t² below the midpoint, mirrored above):
    // slow start and end, fast middle. The second half is computed as the
    // mirror of the first from (total - g) / total, so the curve is exactly
    // symmetric and hits 0 and 1 exactly.
    const g = Math.min(totalGenerations, Math.max(0, generation));
    const firstHalf = (x: number) => Math.sqrt(x / 2);
    return 2 * g <= totalGenerations
      ? firstHalf(g / totalGenerations)
      : 1 - firstHalf((totalGenerations - g) / totalGenerations);
  }

  const exponent = getTimingExponent(curve);

  if (exponent > 1) {
    // Ease-out 1 - (1 - t)^e, inverted: fast start, slow end
    return 1 - Math.pow(1 - normalizedGen, 1 / exponent);
  } else {
    // Ease-in t^(1/e), inverted: slow start, fast end
    return Math.pow(normalizedGen, exponent);
  }
}
