/**
 * Constants file - Centralized magic numbers, colors, and configuration values
 * Improves maintainability and provides clear documentation for values
 */

// ==================== SIZE CONSTANTS ====================

/**
 * Plant size constants for rendering
 */
export const PLANT_SIZES = {
  /** Base stem thickness for standard flowers */
  STEM_THICKNESS_BASE: 2,
  /** Thick stem for tulips, roses */
  STEM_THICKNESS_THICK: 2.5,
  /** Thin stem for daisies, orchids */
  STEM_THICKNESS_THIN: 1.5,
  /** Tree trunk base width */
  TRUNK_WIDTH_BASE: 6,
  /** Conifer trunk width */
  TRUNK_WIDTH_CONIFER: 4,

  /** Base flower size for simple flowers */
  FLOWER_SIZE_SIMPLE: 18,
  /** Sunflower size */
  FLOWER_SIZE_SUNFLOWER: 25,
  /** Dahlia size */
  FLOWER_SIZE_DAHLIA: 24,
  /** Rose size */
  FLOWER_SIZE_ROSE: 20,
  /** Lily size */
  FLOWER_SIZE_LILY: 22,
  /** Tulip size */
  FLOWER_SIZE_TULIP: 22,
  /** Daisy size */
  FLOWER_SIZE_DAISY: 16,
  /** Wildflower size */
  FLOWER_SIZE_WILDFLOWER: 14,
  /** Orchid size */
  FLOWER_SIZE_ORCHID: 18,
  /** Peony size */
  FLOWER_SIZE_PEONY: 22,
  /** Iris size */
  FLOWER_SIZE_IRIS: 20,
  /** Hydrangea size */
  FLOWER_SIZE_HYDRANGEA: 28,
  /** Poppy size */
  FLOWER_SIZE_POPPY: 18,

  /** Base leaf size */
  LEAF_SIZE_BASE: 15,
  /** Large leaf for roses, lilies */
  LEAF_SIZE_LARGE: 20,
  /** Small leaf size */
  LEAF_SIZE_SMALL: 12,
  /** Tropical leaf size */
  LEAF_SIZE_TROPICAL: 30,

  /** Foliage cluster radius for trees */
  FOLIAGE_RADIUS_BASE: 25,
} as const;

// ==================== GROWTH PHASE CONSTANTS ====================

/**
 * Growth timing thresholds for plant animation phases
 */
export const GROWTH_PHASES = {
  /** Stem growth multiplier for faster stem growth */
  STEM_GROWTH_RATE: 1.5,
  /** When leaf growth starts (as fraction of total progress) */
  LEAF_START: 0.3,
  /** Leaf growth rate multiplier */
  LEAF_GROWTH_RATE: 2,
  /** When flower growth starts (as fraction of total progress) */
  FLOWER_START: 0.5,
  /** Flower growth rate multiplier */
  FLOWER_GROWTH_RATE: 2,
  /** When tree foliage starts */
  FOLIAGE_START: 0.4,
  /** Foliage growth rate multiplier */
  FOLIAGE_GROWTH_RATE: 1.7,
  /** When pampas grass plumes appear */
  PLUME_START: 0.8,
  /** Flowering bush flower threshold */
  BUSH_FLOWER_START: 0.7,
  /** Complex bush flower threshold */
  BUSH_FLOWER_START_COMPLEX: 0.5,
  /** Lavender spike appearance */
  LAVENDER_SPIKE_START: 0.5,
  /** Palm frond appearance */
  PALM_FROND_START: 0.3,
  /** Conifer foliage appearance */
  CONIFER_FOLIAGE_START: 0.2,
} as const;

// ==================== COLOR CONSTANTS ====================

/**
 * Standard colors used across renderers
 */
export const COLORS = {
  /** Default flower center color */
  FLOWER_CENTER_GOLD: '#FFD700',
  /** Dark flower center (poppy) */
  FLOWER_CENTER_DARK: '#2D2D2D',
  /** Sunflower center disc */
  SUNFLOWER_CENTER: '#4A3728',
  /** Sunflower inner center */
  SUNFLOWER_CENTER_INNER: '#3D2D20',
  /** Lily stamens */
  LILY_STAMENS: '#8B4513',
  /** Dahlia center */
  DAHLIA_CENTER: '#DAA520',
  /** Pampas grass plume */
  GRASS_PLUME: '#F5F5DC',
  /** Lavender stem */
  LAVENDER_STEM: '#4A7C40',
  /** Tulip stripe highlight */
  TULIP_STRIPE: '#FFFFFF',
  /** Ground indicator */
  GROUND_COLOR: 'rgba(139, 119, 101, 0.08)',
  /** Canvas background */
  CANVAS_BACKGROUND: '#ffffff',
  /** Default accent color (Cloudflare orange) */
  DEFAULT_ACCENT: '#F6821F',
  /** Default fade color */
  DEFAULT_FADE_COLOR: '#ffffff',
} as const;

// ==================== ANIMATION CONSTANTS ====================

/**
 * Animation timing and rendering constants
 */
export const ANIMATION = {
  /** Default animation duration in seconds */
  DEFAULT_DURATION: 600,
  /** Default number of generations */
  DEFAULT_GENERATIONS: 47,
  /** Default target FPS */
  DEFAULT_TARGET_FPS: 30,
  /** Default device pixel ratio limit */
  DEFAULT_MAX_PIXEL_RATIO: 2,
  /** Debounce delay for resize handler in ms */
  RESIZE_DEBOUNCE_MS: 100,
  /** Ground indicator height in pixels */
  GROUND_HEIGHT: 8,
} as const;

// ==================== PLANT LAYOUT CONSTANTS ====================

/**
 * Plant layout and positioning constants
 */
export const LAYOUT = {
  /** Default max height as fraction of container */
  DEFAULT_MAX_HEIGHT: 0.35,
  /** Threshold for tall plant boost activation */
  TALL_PLANT_HEIGHT_THRESHOLD: 0.5,
  /** Threshold for tall garden detection */
  TALL_GARDEN_THRESHOLD: 0.35,
  /** Height bias factor for tall gardens */
  HEIGHT_BIAS_FACTOR: 0.5,
  /** Tree trunk height as fraction of total */
  TREE_TRUNK_RATIO: 0.6,
  /** Conifer trunk height as fraction of total */
  CONIFER_TRUNK_RATIO: 0.95,
  /** Tropical trunk ratio */
  TROPICAL_TRUNK_RATIO: 0.5,
  /** Tall flower stem ratio */
  TALL_FLOWER_STEM_RATIO: 1.0,
} as const;

// ==================== PETAL COUNT DEFAULTS ====================

/**
 * Default petal counts for various flower types
 */
export const PETAL_COUNTS = {
  /** Simple flower base petals */
  SIMPLE_FLOWER: 5,
  /** Daisy petals (minimum) */
  DAISY_MIN: 8,
  /** Daisy base petals */
  DAISY_BASE: 12,
  /** Sunflower ray petals */
  SUNFLOWER: 16,
  /** Rose petal layers */
  ROSE_LAYERS: 3,
  /** Complex rose petal layers */
  ROSE_LAYERS_COMPLEX: 4,
  /** Peony layers */
  PEONY_LAYERS: 5,
  /** Dahlia layers */
  DAHLIA_LAYERS: 4,
  /** Hydrangea floret count base */
  HYDRANGEA_FLORETS: 20,
  /** Succulent layers base */
  SUCCULENT_LAYERS: 3,
  /** Complex succulent layers */
  SUCCULENT_LAYERS_COMPLEX: 4,
  /** Succulent leaves per layer */
  SUCCULENT_LEAVES: 6,
  /** Poppy petals */
  POPPY: 4,
  /** Iris standards (upright petals) */
  IRIS_STANDARDS: 3,
  /** Orchid outer petals (sepals) */
  ORCHID_SEPALS: 3,
  /** Orchid side petals */
  ORCHID_SIDE_PETALS: 2,
  /** Lavender buds per spike */
  LAVENDER_BUDS: 8,
} as const;

// ==================== VARIATION DEFAULTS ====================

/**
 * Default variation parameters
 */
export const VARIATION_DEFAULTS = {
  SIZE_MULTIPLIER: 1.0,
  HEIGHT_MULTIPLIER: 1.0,
  PETAL_COUNT_MODIFIER: 0,
  THICKNESS_MULTIPLIER: 1.0,
  LEAN_MULTIPLIER: 1.0,
  COMPLEXITY: 0.5,
} as const;

// ==================== COMPLEXITY THRESHOLDS ====================

/**
 * Complexity thresholds for conditional rendering features
 */
export const COMPLEXITY = {
  /** Threshold for additional flower details */
  DETAIL_THRESHOLD: 0.6,
  /** Threshold for tulip stripe effect */
  TULIP_STRIPE_THRESHOLD: 0.6,
  /** Threshold for grass plumes */
  GRASS_PLUME_THRESHOLD: 0.7,
  /** Threshold for fern curl effect */
  FERN_CURL_THRESHOLD: 0.7,
  /** Threshold for flowering bush extra flowers */
  BUSH_FLOWERING_THRESHOLD: 0.8,
  /** Threshold for extra rose petal layers */
  ROSE_COMPLEX_THRESHOLD: 0.8,
  /** Threshold for climbing vine flowers */
  VINE_FLOWER_THRESHOLD: 0.6,
} as const;

// ==================== CANVAS STYLE CONSTANTS ====================

/**
 * Canvas rendering style constants
 */
export const CANVAS_STYLE = {
  /** Line cap style for stems */
  LINE_CAP: 'round' as CanvasLineCap,
  /** Alpha for plume effects */
  PLUME_ALPHA: 0.7,
  /** Alpha for tulip stripe */
  TULIP_STRIPE_ALPHA: 0.3,
} as const;

// ==================== GEOMETRY CONSTANTS ====================

/**
 * Geometry and angle constants
 */
export const GEOMETRY = {
  /** Full circle in radians */
  TWO_PI: Math.PI * 2,
  /** Half circle in radians */
  PI: Math.PI,
  /** Quarter circle in radians */
  HALF_PI: Math.PI / 2,
  /** Common bezier control point ratio */
  BEZIER_CP_RATIO: 0.7,
  /** Stem curve control point 1 height ratio */
  STEM_CP1_HEIGHT: 0.4,
  /** Stem curve control point 2 height ratio */
  STEM_CP2_HEIGHT: 0.7,
  /** Stem lean control point 1 ratio */
  STEM_CP1_LEAN: 0.3,
  /** Stem lean control point 2 ratio */
  STEM_CP2_LEAN: 0.6,
} as const;

// ==================== NUMERIC BOUNDS ====================

/**
 * Bounds for numeric options to prevent resource exhaustion
 */
export const OPTION_BOUNDS = {
  DURATION: { min: 1, max: 86400 },
  GENERATIONS: { min: 1, max: 1000 },
  MAX_HEIGHT: { min: 0.05, max: 1 },
  SPEED: { min: 0.01, max: 100 },
  MAX_PIXEL_RATIO: { min: 0.5, max: 4 },
  TARGET_FPS: { min: 1, max: 120 },
  OPACITY: { min: 0, max: 1 },
  FADE_HEIGHT: { min: 0, max: 1 },
  Z_INDEX: { min: -9999, max: 9999 },
  SEED: { min: 0, max: 1e9 },
} as const;

// ==================== DENSITY CONFIGURATION ====================

/**
 * Plants per generation by density level
 */
export const PLANTS_PER_GENERATION = {
  sparse: [4, 6] as const,
  normal: [8, 13] as const,
  dense: [14, 20] as const,
  lush: [22, 30] as const,
} as const;
