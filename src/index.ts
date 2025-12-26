// Main class export
export { Garten } from './Garden';

// Type exports
export type {
  GardenOptions,
  GardenController,
  GardenEvents,
  PlaybackState,
  ColorOptions,
  ColorPalette,
  Density,
  PlantData,
  PlantVariation,
  TimingCurve,
  ResolvedOptions,
  GardenPreset,
  GardenTheme,
  PlantRenderContext,
  FloweringPlantContext,
  PlantRenderer,
  GardenEventType,
  GardenEventData,
} from './types';

export { PlantType, PlantCategory } from './types';

// Utility exports (for advanced usage)
export { seededRandom, createRandom } from './utils';
export { flowerPalettes, foliagePalettes } from './palettes';
export { PLANT_CATEGORIES, getPlantCategory, getPlantVariation } from './plants';

// New abstractions
export { Color, hexToRgb, rgbToHex, lightenColor, darkenColor } from './Color';
export { Vec2, MutableVec2, type Point } from './Vec2';
export { GrowthProgress, calculateGrowthPhases, isPlantActive, calculateRawProgress } from './GrowthProgress';
export {
  GrowthProgressPool,
  MutableGrowthProgress,
  getDefaultPool,
  resetDefaultPool,
  disposeDefaultPool,
  type GrowthProgressPoolConfig,
  type PoolStats,
  type FrameStats,
  type LeakInfo,
} from './GrowthProgressPool';
export { SeededRandom } from './SeededRandom';
export { CanvasHelper, drawStem, drawLeaf, drawLeafPair } from './CanvasHelper';
export { EventEmitter, SimpleEventEmitter } from './EventEmitter';
export { Environment, prefersReducedMotion, getPixelRatio, isBrowser, hasCanvasSupport } from './Environment';

// Presets and themes
export {
  themes,
  presets,
  applyTheme,
  applyPreset,
  createConfig,
  getThemeNames,
  getPresetNames,
  createTheme,
  createPreset,
  densityPreset,
  speedPreset,
} from './presets';

// Constants (for advanced customization)
export * from './constants';

// Default export for convenience
export { Garten as default } from './Garden';
