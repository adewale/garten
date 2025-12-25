/**
 * Plant category for efficient type grouping
 * Categories determine rendering approach and height ranges
 */
export enum PlantCategory {
  SimpleFlower = 0,
  Tulip = 1,
  Daisy = 2,
  Wildflower = 3,
  Grass = 4,
  Fern = 5,
  Bush = 6,
  Rose = 7,
  Lily = 8,
  Orchid = 9,
  Succulent = 10,
  Herb = 11,
  Specialty = 12,
  // Tall categories (30-100% height range)
  TallFlower = 13,
  GiantGrass = 14,
  Climber = 15,
  SmallTree = 16,
  Tropical = 17,
  Conifer = 18,
}

/**
 * Plant variation parameters derived from type
 * Used to create visual differences without separate render functions
 */
export interface PlantVariation {
  sizeMultiplier: number;
  heightMultiplier: number;
  petalCountModifier: number;
  thicknessMultiplier: number;
  leanMultiplier: number;
  complexity: number; // 0-1, affects detail level
}

/**
 * Plant type enumeration - 147 distinct plant types
 * Organized by category for efficient rendering
 */
export enum PlantType {
  // === SIMPLE FLOWERS (0-9) ===
  SimpleFlower = 'simple-flower',
  SimpleFlowerSmall = 'simple-flower-small',
  SimpleFlowerLarge = 'simple-flower-large',
  SimpleFlowerTall = 'simple-flower-tall',
  SimpleFlowerShort = 'simple-flower-short',
  SimpleFlowerWide = 'simple-flower-wide',
  SimpleFlowerNarrow = 'simple-flower-narrow',
  SimpleFlowerDouble = 'simple-flower-double',
  SimpleFlowerClustered = 'simple-flower-clustered',
  SimpleFlowerSpiral = 'simple-flower-spiral',

  // === TULIPS (10-19) ===
  Tulip = 'tulip',
  TulipTall = 'tulip-tall',
  TulipShort = 'tulip-short',
  TulipDouble = 'tulip-double',
  TulipFringed = 'tulip-fringed',
  TulipParrot = 'tulip-parrot',
  TulipLily = 'tulip-lily',
  TulipRembrandt = 'tulip-rembrandt',
  TulipDarwin = 'tulip-darwin',
  TulipTriumph = 'tulip-triumph',

  // === DAISIES (20-29) ===
  Daisy = 'daisy',
  DaisySmall = 'daisy-small',
  DaisyLarge = 'daisy-large',
  DaisyDouble = 'daisy-double',
  DaisyGerbera = 'daisy-gerbera',
  DaisyShasta = 'daisy-shasta',
  DaisyAfrican = 'daisy-african',
  DaisyOxeye = 'daisy-oxeye',
  DaisyPainted = 'daisy-painted',
  DaisyMarguerite = 'daisy-marguerite',

  // === WILDFLOWERS (30-39) ===
  Wildflower = 'wildflower',
  WildflowerClustered = 'wildflower-clustered',
  WildflowerScattered = 'wildflower-scattered',
  WildflowerTall = 'wildflower-tall',
  WildflowerMeadow = 'wildflower-meadow',
  WildflowerPrairie = 'wildflower-prairie',
  WildflowerAlpine = 'wildflower-alpine',
  WildflowerWoodland = 'wildflower-woodland',
  WildflowerCoastal = 'wildflower-coastal',
  WildflowerDesert = 'wildflower-desert',

  // === GRASSES (40-49) ===
  Grass = 'grass',
  GrassTall = 'grass-tall',
  GrassShort = 'grass-short',
  GrassWispy = 'grass-wispy',
  GrassThick = 'grass-thick',
  GrassPampas = 'grass-pampas',
  GrassFountain = 'grass-fountain',
  GrassBlue = 'grass-blue',
  GrassFeather = 'grass-feather',
  GrassReed = 'grass-reed',

  // === FERNS (50-59) ===
  Fern = 'fern',
  FernSmall = 'fern-small',
  FernLarge = 'fern-large',
  FernCurly = 'fern-curly',
  FernStraight = 'fern-straight',
  FernMaidenhair = 'fern-maidenhair',
  FernBoston = 'fern-boston',
  FernStaghorn = 'fern-staghorn',
  FernBird = 'fern-bird',
  FernTree = 'fern-tree',

  // === BUSHES (60-69) ===
  Bush = 'bush',
  BushSmall = 'bush-small',
  BushLarge = 'bush-large',
  BushFlowering = 'bush-flowering',
  BushBerry = 'bush-berry',
  BushRound = 'bush-round',
  BushSpreading = 'bush-spreading',
  BushCompact = 'bush-compact',
  BushWild = 'bush-wild',
  BushOrnamental = 'bush-ornamental',

  // === ROSES (70-74) ===
  Rose = 'rose',
  RoseClimbing = 'rose-climbing',
  RoseMiniature = 'rose-miniature',
  RoseWild = 'rose-wild',
  RoseDouble = 'rose-double',

  // === LILIES (75-79) ===
  Lily = 'lily',
  LilyTiger = 'lily-tiger',
  LilyCalla = 'lily-calla',
  LilyDaylily = 'lily-daylily',
  LilyStargazer = 'lily-stargazer',

  // === ORCHIDS (80-84) ===
  Orchid = 'orchid',
  OrchidMoth = 'orchid-moth',
  OrchidDendrobium = 'orchid-dendrobium',
  OrchidCattleya = 'orchid-cattleya',
  OrchidVanda = 'orchid-vanda',

  // === SUCCULENTS (85-89) ===
  Succulent = 'succulent',
  SucculentRosette = 'succulent-rosette',
  SucculentSpiky = 'succulent-spiky',
  SucculentTrailing = 'succulent-trailing',
  SucculentFlowering = 'succulent-flowering',

  // === HERBS (90-94) ===
  Lavender = 'lavender',
  LavenderTall = 'lavender-tall',
  Sage = 'sage',
  Thyme = 'thyme',
  Rosemary = 'rosemary',

  // === SPECIALTY FLOWERS (95-100) ===
  Poppy = 'poppy',
  Sunflower = 'sunflower',
  Iris = 'iris',
  Peony = 'peony',
  Hydrangea = 'hydrangea',
  Dahlia = 'dahlia',

  // === TALL FLOWERS (101-108) - Height: 30-50% ===
  Hollyhock = 'hollyhock',
  HollyhockDouble = 'hollyhock-double',
  Delphinium = 'delphinium',
  DelphiniumTall = 'delphinium-tall',
  Foxglove = 'foxglove',
  FoxgloveTall = 'foxglove-tall',
  Gladiolus = 'gladiolus',
  Lupine = 'lupine',

  // === GIANT GRASSES (109-116) - Height: 40-70% ===
  Bamboo = 'bamboo',
  BambooTall = 'bamboo-tall',
  BambooClump = 'bamboo-clump',
  GiantReed = 'giant-reed',
  ElephantGrass = 'elephant-grass',
  Miscanthus = 'miscanthus',
  MiscanthusTall = 'miscanthus-tall',
  Cortaderia = 'cortaderia',

  // === CLIMBERS (117-124) - Height: 50-90% ===
  Vine = 'vine',
  VineFlowering = 'vine-flowering',
  VineIvy = 'vine-ivy',
  Wisteria = 'wisteria',
  WisteriaCascade = 'wisteria-cascade',
  Clematis = 'clematis',
  ClematisLarge = 'clematis-large',
  MorningGlory = 'morning-glory',

  // === SMALL TREES (125-134) - Height: 60-100% ===
  Sapling = 'sapling',
  SaplingOak = 'sapling-oak',
  SaplingMaple = 'sapling-maple',
  SaplingBirch = 'sapling-birch',
  TreeYoung = 'tree-young',
  TreeOrnamental = 'tree-ornamental',
  Birch = 'birch',
  Willow = 'willow',
  WillowWeeping = 'willow-weeping',
  CherryBlossom = 'cherry-blossom',

  // === TROPICAL (135-140) - Height: 50-85% ===
  PalmSmall = 'palm-small',
  PalmFan = 'palm-fan',
  BirdOfParadise = 'bird-of-paradise',
  BirdOfParadiseTall = 'bird-of-paradise-tall',
  Banana = 'banana',
  BananaSmall = 'banana-small',

  // === CONIFERS (141-146) - Height: 55-100% ===
  Pine = 'pine',
  PineYoung = 'pine-young',
  Cypress = 'cypress',
  CypressTall = 'cypress-tall',
  Juniper = 'juniper',
  JuniperTall = 'juniper-tall',
}

/**
 * Color palette presets
 */
export type ColorPalette = 'natural' | 'warm' | 'cool' | 'monochrome' | 'vibrant';

/**
 * Timing curve presets for generation pacing
 * - 'linear': Equal time per generation (default)
 * - 'ease-out': Fast start, slow end (early gens grow quickly)
 * - 'ease-in': Slow start, fast end
 * - 'ease-in-out': Slow-fast-slow
 * - number: Custom exponent (>1 = ease-out effect, <1 = ease-in effect)
 */
export type TimingCurve = 'linear' | 'ease-out' | 'ease-in' | 'ease-in-out' | number;

/**
 * Animation density options
 */
export type Density = 'sparse' | 'normal' | 'dense' | 'lush';

/**
 * Playback state
 */
export type PlaybackState = 'idle' | 'playing' | 'paused' | 'complete';

/**
 * Color configuration options
 */
export interface ColorOptions {
  /**
   * Primary accent color (hex string)
   * @default '#F6821F' (Cloudflare orange)
   */
  accent?: string;

  /**
   * Color palette preset
   * @default 'natural'
   */
  palette?: ColorPalette;

  /**
   * Custom flower colors (overrides palette)
   */
  flowerColors?: string[];

  /**
   * Custom leaf/stem colors (overrides palette)
   */
  foliageColors?: string[];

  /**
   * How much to favor the accent color (0-1)
   * @default 0.4
   */
  accentWeight?: number;
}

/**
 * Event callbacks
 */
export interface GardenEvents {
  /**
   * Called when a generation completes
   */
  onGenerationComplete?: (generation: number, totalGenerations: number) => void;

  /**
   * Called when all generations have bloomed
   */
  onComplete?: () => void;

  /**
   * Called when playback state changes
   */
  onStateChange?: (state: PlaybackState) => void;

  /**
   * Called on each animation frame with current progress
   */
  onProgress?: (progress: number, elapsedTime: number) => void;
}

/**
 * Main configuration options for Garten
 */
export interface GardenOptions {
  /**
   * Container element or CSS selector
   */
  container: string | HTMLElement;

  /**
   * Total animation duration in seconds
   * @default 600 (10 minutes)
   */
  duration?: number;

  /**
   * Number of growth generations
   * @default 47
   */
  generations?: number;

  /**
   * Maximum height as fraction of container (0-1)
   * Also controls which plant categories appear:
   * - 0.35 (default): Ground plants only (grass, flowers, bushes)
   * - 0.5+: Adds tall flowers and giant grasses
   * - 0.7+: Adds climbers and tropical plants
   * - 1.0: Full garden with trees and conifers
   * @default 0.35
   */
  maxHeight?: number;

  /**
   * Color configuration
   */
  colors?: ColorOptions;

  /**
   * Plant density
   * @default 'normal'
   */
  density?: Density;

  /**
   * Plant categories to include
   * If specified, only these categories will appear in the garden.
   * Use PLANT_CATEGORIES constant for available category names.
   * @example ['rose', 'tulip', 'grass'] // Only roses, tulips, and grass
   * @example ['small-tree', 'conifer', 'climber'] // Only tall plants
   * @default undefined (all categories)
   */
  categories?: string[];

  /**
   * Whether to loop the animation
   * @default false
   */
  loop?: boolean;

  /**
   * Initial playback speed multiplier
   * @default 1
   */
  speed?: number;

  /**
   * Whether to start playing automatically
   * @default true
   */
  autoplay?: boolean;

  /**
   * Whether to respect prefers-reduced-motion
   * @default true
   */
  respectReducedMotion?: boolean;

  /**
   * Random seed for deterministic generation
   * @default undefined (random)
   */
  seed?: number;

  /**
   * Device pixel ratio limit (for performance)
   * @default 2
   */
  maxPixelRatio?: number;

  /**
   * Target frames per second
   * @default 30
   */
  targetFPS?: number;

  /**
   * Timing curve for generation pacing
   * Controls how time is distributed across generations
   * - 'linear': Equal time per generation (default)
   * - 'ease-out': Fast start, slow end (early gens complete quickly)
   * - 'ease-in': Slow start, fast end
   * - 'ease-in-out': Slow-fast-slow
   * - number: Custom exponent (>1 = ease-out, <1 = ease-in)
   * @default 'linear'
   */
  timingCurve?: TimingCurve;

  /**
   * CSS z-index for the canvas element
   * Use negative values to place behind content
   * @default -1
   */
  zIndex?: number;

  /**
   * Global opacity for all plants (0-1)
   * @default 1
   */
  opacity?: number;

  /**
   * Height of fade-out zone as fraction of container (0-1)
   * Plants will fade to transparent over this distance from their max height
   * Set to 0 to disable fading
   * @default 0
   */
  fadeHeight?: number;

  /**
   * Color to fade into (should match page background)
   * Only used when fadeHeight > 0
   * @default '#ffffff'
   */
  fadeColor?: string;

  /**
   * Event callbacks
   */
  events?: GardenEvents;
}

/**
 * Internal plant data structure
 */
export interface PlantData {
  id: number;
  type: PlantType;
  x: number;
  maxHeight: number;
  flowerColor: string;
  stemColor: string;
  leafColor: string;
  delay: number;
  growDuration: number;
  seed: number;
  petals: number;
  lean: number;
  scale: number;
  generation: number;
  /** Cached category for O(1) lookup during rendering */
  category?: PlantCategory;
  /** Cached variation for O(1) lookup during rendering */
  variation?: PlantVariation;
}

/**
 * Resolved/normalized options (all required)
 */
export interface ResolvedOptions {
  container: HTMLElement;
  duration: number;
  generations: number;
  maxHeight: number;
  colors: Required<ColorOptions>;
  density: Density;
  categories: string[] | null;
  loop: boolean;
  speed: number;
  autoplay: boolean;
  respectReducedMotion: boolean;
  seed: number;
  maxPixelRatio: number;
  targetFPS: number;
  timingCurve: TimingCurve;
  zIndex: number;
  opacity: number;
  fadeHeight: number;
  fadeColor: string;
  events: GardenEvents;
}

/**
 * Public API for controlling the garden
 */
export interface GardenController {
  /** Start or resume playback */
  play(): void;

  /** Pause playback */
  pause(): void;

  /** Stop and reset to beginning */
  stop(): void;

  /** Jump to specific time in seconds */
  seek(time: number): void;

  /** Set playback speed multiplier */
  setSpeed(speed: number): void;

  /** Get current playback state */
  getState(): PlaybackState;

  /** Get current progress (0-1) */
  getProgress(): number;

  /** Get elapsed time in seconds */
  getElapsedTime(): number;

  /** Update options (triggers regeneration if needed) */
  setOptions(options: Partial<GardenOptions>): void;

  /** Force regenerate all plants */
  regenerate(): void;

  /** Clean up and remove from DOM */
  destroy(): void;
}

// ==================== RENDERER TYPES ====================

/**
 * Render context passed to plant renderers
 */
export interface PlantRenderContext {
  /** Canvas 2D rendering context */
  ctx: CanvasRenderingContext2D;
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Current animation time in seconds */
  time: number;
}

/**
 * Flowering plant render context with pre-calculated values
 */
export interface FloweringPlantContext {
  /** X position on canvas */
  x: number;
  /** Base Y position (canvas bottom) */
  baseY: number;
  /** Calculated plant height in pixels */
  plantHeight: number;
  /** Growth phases for this plant */
  phases: {
    progress: number;
    stem: number;
    leaf: number;
    flower: number;
  };
}

/**
 * Plant renderer function signature
 */
export type PlantRenderer = (
  ctx: CanvasRenderingContext2D,
  plant: PlantData,
  width: number,
  height: number,
  time: number,
  variation: PlantVariation
) => void;

/**
 * Category-based renderer registry type
 */
export type CategoryRenderers = Record<PlantCategory, PlantRenderer>;

// ==================== EVENT EMITTER TYPES ====================

/**
 * Event types for the garden
 */
export type GardenEventType =
  | 'play'
  | 'pause'
  | 'stop'
  | 'complete'
  | 'progress'
  | 'generationComplete'
  | 'stateChange'
  | 'regenerate'
  | 'optionsChange';

/**
 * Event handler type
 */
export type GardenEventHandler<T = unknown> = (data: T) => void;

/**
 * Event data for different event types
 */
export interface GardenEventData {
  play: void;
  pause: void;
  stop: void;
  complete: void;
  progress: { progress: number; elapsedTime: number };
  generationComplete: { generation: number; totalGenerations: number };
  stateChange: { state: PlaybackState };
  regenerate: void;
  optionsChange: { options: Partial<GardenOptions> };
}

// ==================== THEME/PRESET TYPES ====================

/**
 * Garden preset configuration
 */
export interface GardenPreset {
  /** Preset name */
  name: string;
  /** Description of the preset */
  description?: string;
  /** Partial options to apply */
  options: Partial<GardenOptions>;
}

/**
 * Theme configuration for visual styling
 */
export interface GardenTheme {
  /** Theme name */
  name: string;
  /** Color palette */
  palette: ColorPalette;
  /** Accent color */
  accent?: string;
  /** Custom flower colors */
  flowerColors?: string[];
  /** Custom foliage colors */
  foliageColors?: string[];
  /** Background/fade color */
  fadeColor?: string;
}
