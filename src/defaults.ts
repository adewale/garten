import type { GardenOptions, ResolvedOptions, ColorOptions, GardenEvents, Density } from './types';
import { OPTION_BOUNDS, PLANTS_PER_GENERATION, COLORS, ANIMATION, LAYOUT } from './constants';
import { omitUndefined } from './utils';

// Type declaration for process (Node.js environment detection for dev warnings)
declare const process: { env?: { NODE_ENV?: string } } | undefined;

/**
 * Default color options
 */
export const defaultColorOptions: Required<ColorOptions> = {
  accent: COLORS.DEFAULT_ACCENT,
  palette: 'natural',
  flowerColors: [],
  foliageColors: [],
  accentWeight: 0.4,
};

/**
 * Default event handlers (empty - all properties are optional)
 */
export const defaultEvents: GardenEvents = {};

/**
 * Default garden options.
 * `seed` is intentionally absent: a fresh random seed is generated per
 * resolveOptions() call, never shared at module load time.
 */
export const defaultOptions: Omit<ResolvedOptions, 'container' | 'seed'> = {
  duration: ANIMATION.DEFAULT_DURATION,
  generations: ANIMATION.DEFAULT_GENERATIONS,
  maxHeight: LAYOUT.DEFAULT_MAX_HEIGHT,
  colors: defaultColorOptions,
  density: 'normal',
  categories: null,
  loop: false,
  speed: 1,
  autoplay: true,
  respectReducedMotion: true,
  maxPixelRatio: ANIMATION.DEFAULT_MAX_PIXEL_RATIO,
  targetFPS: ANIMATION.DEFAULT_TARGET_FPS,
  timingCurve: 'linear',
  background: COLORS.CANVAS_BACKGROUND,
  zIndex: -1,
  opacity: 1,
  fadeHeight: 0,
  fadeColor: COLORS.DEFAULT_FADE_COLOR,
  events: defaultEvents,
};

/**
 * Map from option key to OPTION_BOUNDS key
 */
type BoundsKey = keyof typeof OPTION_BOUNDS;

const optionToBoundsKey: Record<string, BoundsKey> = {
  duration: 'DURATION',
  generations: 'GENERATIONS',
  maxHeight: 'MAX_HEIGHT',
  speed: 'SPEED',
  maxPixelRatio: 'MAX_PIXEL_RATIO',
  targetFPS: 'TARGET_FPS',
  opacity: 'OPACITY',
  fadeHeight: 'FADE_HEIGHT',
  zIndex: 'Z_INDEX',
  seed: 'SEED',
};

/**
 * Resolve a numeric option: non-numbers and non-finite values (NaN,
 * ±Infinity) fall back to the default, finite values are clamped to bounds.
 */
function resolveNumber(value: number | undefined, defaultValue: number, key: string): number {
  const candidate =
    typeof value === 'number' && Number.isFinite(value) ? value : defaultValue;
  const boundsKey = optionToBoundsKey[key];
  if (!boundsKey) return candidate;
  const { min, max } = OPTION_BOUNDS[boundsKey];
  return Math.min(max, Math.max(min, candidate));
}

/**
 * Normalize a seed into [0, SEED.max). Unlike plain clamping this keeps
 * negative and out-of-range seeds distinct from each other.
 */
function normalizeSeed(seed: number): number {
  const { max } = OPTION_BOUNDS.SEED;
  return ((seed % max) + max) % max;
}

/**
 * Clamp a fraction to [0, 1], falling back to a default for non-finite input
 */
function clampFraction(value: number | undefined, defaultValue: number): number {
  const candidate =
    typeof value === 'number' && Number.isFinite(value) ? value : defaultValue;
  return Math.min(1, Math.max(0, candidate));
}

/**
 * Plants per generation by density - re-exported from constants
 */
export const plantsPerGeneration: Record<Density, readonly [number, number]> = PLANTS_PER_GENERATION;

/**
 * Validate CSS selector format using browser's native validation
 */
function isValidSelector(selector: string): boolean {
  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve partial options into complete options
 */
export function resolveOptions(options: GardenOptions): ResolvedOptions {
  // Resolve container with selector validation
  let container: HTMLElement;
  if (typeof options.container === 'string') {
    if (typeof document === 'undefined') {
      throw new Error(
        'Garten: document is not available. Garten requires a browser environment ' +
        'when the container is given as a selector string.'
      );
    }
    // Validate selector format to prevent unusual selectors
    if (!isValidSelector(options.container)) {
      throw new Error(`Garten: Invalid selector format "${options.container}". Use simple selectors like "#id" or ".class".`);
    }
    const el = document.querySelector(options.container);
    if (!el || !(el instanceof HTMLElement)) {
      throw new Error(`Garten: Container "${options.container}" not found`);
    }
    container = el;
  } else {
    container = options.container;
  }

  // Warn if container is not connected to the DOM (may cause issues)
  if (typeof process !== 'undefined' && process?.env?.NODE_ENV !== 'production') {
    if (!container.isConnected) {
      console.warn('Garten: Container is not connected to the DOM. Animation may not render.');
    }
  }

  // Merge color options. omitUndefined prevents explicit-undefined fields
  // (e.g. from theme helpers) from clobbering the defaults.
  const mergedColors: Required<ColorOptions> = {
    ...defaultColorOptions,
    ...omitUndefined(options.colors),
  };
  const colors: Required<ColorOptions> = {
    ...mergedColors,
    flowerColors: Array.isArray(mergedColors.flowerColors) ? mergedColors.flowerColors : [],
    foliageColors: Array.isArray(mergedColors.foliageColors) ? mergedColors.foliageColors : [],
    accentWeight: clampFraction(mergedColors.accentWeight, defaultColorOptions.accentWeight),
  };

  // Merge events
  const events: GardenEvents = {
    ...defaultEvents,
    ...omitUndefined(options.events),
  };

  // Resolve, sanitize, and clamp numeric options
  return {
    container,
    duration: resolveNumber(options.duration, defaultOptions.duration, 'duration'),
    generations: resolveNumber(options.generations, defaultOptions.generations, 'generations'),
    maxHeight: resolveNumber(options.maxHeight, defaultOptions.maxHeight, 'maxHeight'),
    colors,
    density: options.density ?? defaultOptions.density,
    categories: options.categories ?? defaultOptions.categories,
    loop: options.loop ?? defaultOptions.loop,
    speed: resolveNumber(options.speed, defaultOptions.speed, 'speed'),
    autoplay: options.autoplay ?? defaultOptions.autoplay,
    respectReducedMotion: options.respectReducedMotion ?? defaultOptions.respectReducedMotion,
    seed: normalizeSeed(
      // Use provided seed if finite, otherwise generate a random one
      (typeof options.seed === 'number' && Number.isFinite(options.seed))
        ? options.seed
        : Math.random() * 100000
    ),
    maxPixelRatio: resolveNumber(options.maxPixelRatio, defaultOptions.maxPixelRatio, 'maxPixelRatio'),
    targetFPS: resolveNumber(options.targetFPS, defaultOptions.targetFPS, 'targetFPS'),
    timingCurve: options.timingCurve ?? defaultOptions.timingCurve,
    background: typeof options.background === 'string' ? options.background : defaultOptions.background,
    zIndex: resolveNumber(options.zIndex, defaultOptions.zIndex, 'zIndex'),
    opacity: resolveNumber(options.opacity, defaultOptions.opacity, 'opacity'),
    fadeHeight: resolveNumber(options.fadeHeight, defaultOptions.fadeHeight, 'fadeHeight'),
    fadeColor: options.fadeColor ?? defaultOptions.fadeColor,
    events,
  };
}
