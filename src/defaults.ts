import type { GardenOptions, ResolvedOptions, ColorOptions, GardenEvents, Density } from './types';
import { OPTION_BOUNDS, PLANTS_PER_GENERATION, COLORS, ANIMATION, LAYOUT } from './constants';

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
 * Default garden options
 */
export const defaultOptions: Omit<ResolvedOptions, 'container'> = {
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
  seed: Math.random() * 100000,
  maxPixelRatio: ANIMATION.DEFAULT_MAX_PIXEL_RATIO,
  targetFPS: ANIMATION.DEFAULT_TARGET_FPS,
  timingCurve: 'linear',
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
 * Clamp a number to bounds from constants
 */
function clampOption(value: number, key: string): number {
  const boundsKey = optionToBoundsKey[key];
  if (!boundsKey) return value;
  const { min, max } = OPTION_BOUNDS[boundsKey];
  return Math.min(max, Math.max(min, value));
}

/**
 * Plants per generation by density - re-exported from constants
 */
export const plantsPerGeneration: Record<Density, readonly [number, number]> = PLANTS_PER_GENERATION;

/**
 * Validate CSS selector format (basic validation for common selectors)
 */
function isValidSelector(selector: string): boolean {
  // Allow simple ID, class, or tag selectors, and common combinations
  // This prevents unusual selectors while allowing flexibility
  return /^[#.]?[\w-]+(\s*[>+~]?\s*[#.]?[\w-]+)*$/.test(selector);
}

/**
 * Resolve partial options into complete options
 */
export function resolveOptions(options: GardenOptions): ResolvedOptions {
  // Resolve container with selector validation
  let container: HTMLElement;
  if (typeof options.container === 'string') {
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

  // Merge color options
  const colors: Required<ColorOptions> = {
    ...defaultColorOptions,
    ...options.colors,
  };

  // Merge events
  const events: GardenEvents = {
    ...defaultEvents,
    ...options.events,
  };

  // Resolve and clamp numeric options
  return {
    container,
    duration: clampOption(options.duration ?? defaultOptions.duration, 'duration'),
    generations: clampOption(options.generations ?? defaultOptions.generations, 'generations'),
    maxHeight: clampOption(options.maxHeight ?? defaultOptions.maxHeight, 'maxHeight'),
    colors,
    density: options.density ?? defaultOptions.density,
    categories: options.categories ?? defaultOptions.categories,
    loop: options.loop ?? defaultOptions.loop,
    speed: clampOption(options.speed ?? defaultOptions.speed, 'speed'),
    autoplay: options.autoplay ?? defaultOptions.autoplay,
    respectReducedMotion: options.respectReducedMotion ?? defaultOptions.respectReducedMotion,
    seed: clampOption(
      Number.isFinite(options.seed) ? options.seed! : defaultOptions.seed,
      'seed'
    ),
    maxPixelRatio: clampOption(options.maxPixelRatio ?? defaultOptions.maxPixelRatio, 'maxPixelRatio'),
    targetFPS: clampOption(options.targetFPS ?? defaultOptions.targetFPS, 'targetFPS'),
    timingCurve: options.timingCurve ?? defaultOptions.timingCurve,
    zIndex: clampOption(options.zIndex ?? defaultOptions.zIndex, 'zIndex'),
    opacity: clampOption(options.opacity ?? defaultOptions.opacity, 'opacity'),
    fadeHeight: clampOption(options.fadeHeight ?? defaultOptions.fadeHeight, 'fadeHeight'),
    fadeColor: options.fadeColor ?? defaultOptions.fadeColor,
    events,
  };
}

