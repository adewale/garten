import type { GardenOptions, ResolvedOptions, ColorOptions, GardenEvents, Density } from './types';

/**
 * Default color options
 */
export const defaultColorOptions: Required<ColorOptions> = {
  accent: '#F6821F',
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
  duration: 600,
  generations: 47,
  maxHeight: 0.35,
  colors: defaultColorOptions,
  density: 'normal',
  categories: null,
  loop: false,
  speed: 1,
  autoplay: true,
  respectReducedMotion: true,
  seed: Math.random() * 100000,
  maxPixelRatio: 2,
  targetFPS: 30,
  timingCurve: 'linear',
  zIndex: -1,
  opacity: 1,
  fadeHeight: 0,
  fadeColor: '#ffffff',
  events: defaultEvents,
};

/**
 * Bounds for numeric options to prevent resource exhaustion
 */
const numericBounds = {
  duration: { min: 1, max: 86400 },        // 1 second to 24 hours
  generations: { min: 1, max: 1000 },      // Reasonable upper limit
  maxHeight: { min: 0.05, max: 1 },        // 5% to 100%
  speed: { min: 0.01, max: 100 },          // Reasonable speed range
  maxPixelRatio: { min: 0.5, max: 4 },     // Device pixel ratio
  targetFPS: { min: 1, max: 120 },         // Frame rate
  opacity: { min: 0, max: 1 },             // CSS opacity
  fadeHeight: { min: 0, max: 1 },          // Fade zone height
  zIndex: { min: -9999, max: 9999 },       // CSS z-index
  seed: { min: 0, max: 1e9 },              // Random seed
};

/**
 * Clamp a number to bounds
 */
function clampOption(value: number, key: keyof typeof numericBounds): number {
  const { min, max } = numericBounds[key];
  return Math.min(max, Math.max(min, value));
}

/**
 * Plants per generation by density
 */
export const plantsPerGeneration: Record<Density, [number, number]> = {
  sparse: [4, 6],
  normal: [8, 13],
  dense: [14, 20],
  lush: [22, 30],
};

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

