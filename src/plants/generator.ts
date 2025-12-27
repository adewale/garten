import type { PlantData, ResolvedOptions, ColorOptions } from '../types';
import { PlantType, PlantCategory } from '../types';
import { createRandom, randomRange, applyTimingCurve } from '../utils';
import { buildFlowerColors, buildFoliageColors } from '../palettes';
import { plantsPerGeneration } from '../defaults';
import { getPlantVariation } from './variations';

/**
 * Category name strings for public API
 * Maps user-friendly names to internal PlantCategory enum
 */
const categoryNameToEnum: Record<string, PlantCategory> = {
  'simple-flower': PlantCategory.SimpleFlower,
  'tulip': PlantCategory.Tulip,
  'daisy': PlantCategory.Daisy,
  'wildflower': PlantCategory.Wildflower,
  'grass': PlantCategory.Grass,
  'fern': PlantCategory.Fern,
  'bush': PlantCategory.Bush,
  'rose': PlantCategory.Rose,
  'lily': PlantCategory.Lily,
  'orchid': PlantCategory.Orchid,
  'succulent': PlantCategory.Succulent,
  'herb': PlantCategory.Herb,
  'specialty': PlantCategory.Specialty,
  'tall-flower': PlantCategory.TallFlower,
  'giant-grass': PlantCategory.GiantGrass,
  'climber': PlantCategory.Climber,
  'small-tree': PlantCategory.SmallTree,
  'tropical': PlantCategory.Tropical,
  'conifer': PlantCategory.Conifer,
};

/**
 * All available plant category names
 * Use these values in the `categories` option
 */
export const PLANT_CATEGORIES = Object.keys(categoryNameToEnum) as readonly string[];

/**
 * Convert user category names to PlantCategory set
 * Returns null if no filter (all categories)
 */
function parseCategoryFilter(categories: string[] | null): Set<PlantCategory> | null {
  if (!categories || categories.length === 0) return null;

  const result = new Set<PlantCategory>();
  for (const name of categories) {
    const category = categoryNameToEnum[name.toLowerCase()];
    if (category !== undefined) {
      result.add(category);
    }
  }

  return result.size > 0 ? result : null;
}

/**
 * Category weights for random selection
 * Weights are relative - they get normalized based on which categories are available
 */
const categoryWeights: Array<{ category: PlantCategory; weight: number }> = [
  // Short plants (always available)
  { category: PlantCategory.SimpleFlower, weight: 0.15 },
  { category: PlantCategory.Tulip, weight: 0.10 },
  { category: PlantCategory.Daisy, weight: 0.10 },
  { category: PlantCategory.Wildflower, weight: 0.10 },
  { category: PlantCategory.Grass, weight: 0.12 },
  { category: PlantCategory.Fern, weight: 0.08 },
  { category: PlantCategory.Bush, weight: 0.08 },
  { category: PlantCategory.Rose, weight: 0.06 },
  { category: PlantCategory.Lily, weight: 0.05 },
  { category: PlantCategory.Orchid, weight: 0.04 },
  { category: PlantCategory.Succulent, weight: 0.04 },
  { category: PlantCategory.Herb, weight: 0.04 },
  { category: PlantCategory.Specialty, weight: 0.04 },
  // Tall plants (available when maxHeight allows)
  { category: PlantCategory.TallFlower, weight: 0.06 },
  { category: PlantCategory.GiantGrass, weight: 0.05 },
  { category: PlantCategory.Climber, weight: 0.04 },
  { category: PlantCategory.SmallTree, weight: 0.04 },
  { category: PlantCategory.Tropical, weight: 0.03 },
  { category: PlantCategory.Conifer, weight: 0.03 },
];

/**
 * Plant types by category - uses arrays for O(1) random access
 */
const plantTypesByCategory: Record<PlantCategory, PlantType[]> = {
  [PlantCategory.SimpleFlower]: [
    PlantType.SimpleFlower,
    PlantType.SimpleFlowerSmall,
    PlantType.SimpleFlowerLarge,
    PlantType.SimpleFlowerTall,
    PlantType.SimpleFlowerShort,
    PlantType.SimpleFlowerWide,
    PlantType.SimpleFlowerNarrow,
    PlantType.SimpleFlowerDouble,
    PlantType.SimpleFlowerClustered,
    PlantType.SimpleFlowerSpiral,
  ],
  [PlantCategory.Tulip]: [
    PlantType.Tulip,
    PlantType.TulipTall,
    PlantType.TulipShort,
    PlantType.TulipDouble,
    PlantType.TulipFringed,
    PlantType.TulipParrot,
    PlantType.TulipLily,
    PlantType.TulipRembrandt,
    PlantType.TulipDarwin,
    PlantType.TulipTriumph,
  ],
  [PlantCategory.Daisy]: [
    PlantType.Daisy,
    PlantType.DaisySmall,
    PlantType.DaisyLarge,
    PlantType.DaisyDouble,
    PlantType.DaisyGerbera,
    PlantType.DaisyShasta,
    PlantType.DaisyAfrican,
    PlantType.DaisyOxeye,
    PlantType.DaisyPainted,
    PlantType.DaisyMarguerite,
  ],
  [PlantCategory.Wildflower]: [
    PlantType.Wildflower,
    PlantType.WildflowerClustered,
    PlantType.WildflowerScattered,
    PlantType.WildflowerTall,
    PlantType.WildflowerMeadow,
    PlantType.WildflowerPrairie,
    PlantType.WildflowerAlpine,
    PlantType.WildflowerWoodland,
    PlantType.WildflowerCoastal,
    PlantType.WildflowerDesert,
  ],
  [PlantCategory.Grass]: [
    PlantType.Grass,
    PlantType.GrassTall,
    PlantType.GrassShort,
    PlantType.GrassWispy,
    PlantType.GrassThick,
    PlantType.GrassPampas,
    PlantType.GrassFountain,
    PlantType.GrassBlue,
    PlantType.GrassFeather,
    PlantType.GrassReed,
  ],
  [PlantCategory.Fern]: [
    PlantType.Fern,
    PlantType.FernSmall,
    PlantType.FernLarge,
    PlantType.FernCurly,
    PlantType.FernStraight,
    PlantType.FernMaidenhair,
    PlantType.FernBoston,
    PlantType.FernStaghorn,
    PlantType.FernBird,
    PlantType.FernTree,
  ],
  [PlantCategory.Bush]: [
    PlantType.Bush,
    PlantType.BushSmall,
    PlantType.BushLarge,
    PlantType.BushFlowering,
    PlantType.BushBerry,
    PlantType.BushRound,
    PlantType.BushSpreading,
    PlantType.BushCompact,
    PlantType.BushWild,
    PlantType.BushOrnamental,
  ],
  [PlantCategory.Rose]: [
    PlantType.Rose,
    PlantType.RoseClimbing,
    PlantType.RoseMiniature,
    PlantType.RoseWild,
    PlantType.RoseDouble,
  ],
  [PlantCategory.Lily]: [
    PlantType.Lily,
    PlantType.LilyTiger,
    PlantType.LilyCalla,
    PlantType.LilyDaylily,
    PlantType.LilyStargazer,
  ],
  [PlantCategory.Orchid]: [
    PlantType.Orchid,
    PlantType.OrchidMoth,
    PlantType.OrchidDendrobium,
    PlantType.OrchidCattleya,
    PlantType.OrchidVanda,
  ],
  [PlantCategory.Succulent]: [
    PlantType.Succulent,
    PlantType.SucculentRosette,
    PlantType.SucculentSpiky,
    PlantType.SucculentTrailing,
    PlantType.SucculentFlowering,
  ],
  [PlantCategory.Herb]: [
    PlantType.Lavender,
    PlantType.LavenderTall,
    PlantType.Sage,
    PlantType.Thyme,
    PlantType.Rosemary,
  ],
  [PlantCategory.Specialty]: [
    PlantType.Poppy,
    PlantType.Sunflower,
    PlantType.Iris,
    PlantType.Peony,
    PlantType.Hydrangea,
    PlantType.Dahlia,
  ],
  // Tall categories
  [PlantCategory.TallFlower]: [
    PlantType.Hollyhock,
    PlantType.HollyhockDouble,
    PlantType.Delphinium,
    PlantType.DelphiniumTall,
    PlantType.Foxglove,
    PlantType.FoxgloveTall,
    PlantType.Gladiolus,
    PlantType.Lupine,
  ],
  [PlantCategory.GiantGrass]: [
    PlantType.Bamboo,
    PlantType.BambooTall,
    PlantType.BambooClump,
    PlantType.GiantReed,
    PlantType.ElephantGrass,
    PlantType.Miscanthus,
    PlantType.MiscanthusTall,
    PlantType.Cortaderia,
  ],
  [PlantCategory.Climber]: [
    PlantType.Vine,
    PlantType.VineFlowering,
    PlantType.VineIvy,
    PlantType.Wisteria,
    PlantType.WisteriaCascade,
    PlantType.Clematis,
    PlantType.ClematisLarge,
    PlantType.MorningGlory,
  ],
  [PlantCategory.SmallTree]: [
    PlantType.Sapling,
    PlantType.SaplingOak,
    PlantType.SaplingMaple,
    PlantType.SaplingBirch,
    PlantType.TreeYoung,
    PlantType.TreeOrnamental,
    PlantType.Birch,
    PlantType.Willow,
    PlantType.WillowWeeping,
    PlantType.CherryBlossom,
  ],
  [PlantCategory.Tropical]: [
    PlantType.PalmSmall,
    PlantType.PalmFan,
    PlantType.BirdOfParadise,
    PlantType.BirdOfParadiseTall,
    PlantType.Banana,
    PlantType.BananaSmall,
  ],
  [PlantCategory.Conifer]: [
    PlantType.Pine,
    PlantType.PineYoung,
    PlantType.Cypress,
    PlantType.CypressTall,
    PlantType.Juniper,
    PlantType.JuniperTall,
  ],
};

/**
 * Height ranges by category [min, max] as fraction of container height
 * Categories are only available when maxHeight >= their minimum height
 */
const categoryHeightRanges: Record<PlantCategory, [number, number]> = {
  // Short plants (available at any maxHeight)
  [PlantCategory.SimpleFlower]: [0.10, 0.22],
  [PlantCategory.Tulip]: [0.12, 0.22],
  [PlantCategory.Daisy]: [0.10, 0.20],
  [PlantCategory.Wildflower]: [0.08, 0.18],
  [PlantCategory.Grass]: [0.03, 0.10],
  [PlantCategory.Fern]: [0.06, 0.14],
  [PlantCategory.Bush]: [0.08, 0.16],
  [PlantCategory.Rose]: [0.12, 0.25],
  [PlantCategory.Lily]: [0.14, 0.26],
  [PlantCategory.Orchid]: [0.10, 0.20],
  [PlantCategory.Succulent]: [0.04, 0.10],
  [PlantCategory.Herb]: [0.06, 0.14],
  [PlantCategory.Specialty]: [0.12, 0.28],
  // Tall plants (available when maxHeight is high enough)
  [PlantCategory.TallFlower]: [0.30, 0.50],
  [PlantCategory.GiantGrass]: [0.40, 0.70],
  [PlantCategory.Climber]: [0.50, 0.90],
  [PlantCategory.SmallTree]: [0.60, 1.00],
  [PlantCategory.Tropical]: [0.50, 0.85],
  [PlantCategory.Conifer]: [0.55, 1.00],
};

/**
 * Map from PlantType to category for efficient lookup
 * Built once at module load time
 */
const plantTypeToCategory: Map<PlantType, PlantCategory> = new Map();
for (const [category, types] of Object.entries(plantTypesByCategory)) {
  for (const type of types) {
    plantTypeToCategory.set(type, Number(category) as PlantCategory);
  }
}

/**
 * Tall categories that should be boosted when maxHeight is high
 */
const tallCategories = new Set([
  PlantCategory.TallFlower,
  PlantCategory.GiantGrass,
  PlantCategory.Climber,
  PlantCategory.SmallTree,
  PlantCategory.Tropical,
  PlantCategory.Conifer,
]);


/**
 * Select a random category based on weights, filtered by maxHeight and user selection
 * Categories whose minimum height exceeds maxHeight are excluded
 * Tall categories get boosted weights when maxHeight is high
 */
function selectCategory(
  rand: () => number,
  maxHeight: number,
  categoryFilter: Set<PlantCategory> | null
): PlantCategory {
  // Filter categories to those compatible with maxHeight and user selection
  const availableCategories = categoryWeights.filter(({ category }) => {
    // Check maxHeight compatibility
    const [minH] = categoryHeightRanges[category];
    if (minH > maxHeight) return false;

    // Check user category filter
    if (categoryFilter && !categoryFilter.has(category)) return false;

    return true;
  });

  // Fallback if no categories available
  if (availableCategories.length === 0) {
    return categoryFilter?.values().next().value ?? PlantCategory.SimpleFlower;
  }

  // Calculate boost factor for tall plants based on maxHeight
  // At maxHeight 0.35 (default): no boost (1x)
  // At maxHeight 0.7: moderate boost (2x)
  // At maxHeight 1.0: strong boost (4x)
  const tallBoostFactor = 1 + Math.max(0, (maxHeight - 0.35) / 0.65) * 3;

  // Apply boost to tall categories and calculate total weight
  let totalWeight = 0;
  const adjustedWeights = availableCategories.map(({ category, weight }) => {
    const adjustedWeight = tallCategories.has(category) ? weight * tallBoostFactor : weight;
    totalWeight += adjustedWeight;
    return { category, weight: adjustedWeight };
  });

  const roll = rand() * totalWeight;
  let cumulative = 0;

  for (const { category, weight } of adjustedWeights) {
    cumulative += weight;
    if (roll < cumulative) {
      return category;
    }
  }

  return availableCategories[0].category;
}

/**
 * Select a random plant type from a category
 */
function selectPlantType(
  rand: () => number,
  maxHeight: number,
  categoryFilter: Set<PlantCategory> | null
): PlantType {
  const category = selectCategory(rand, maxHeight, categoryFilter);
  const types = plantTypesByCategory[category];
  return types[Math.floor(rand() * types.length)];
}

/**
 * Get height range for a plant type
 */
function getHeightRange(type: PlantType, maxHeight: number): [number, number] {
  const category = plantTypeToCategory.get(type) ?? PlantCategory.SimpleFlower;
  const [min, max] = categoryHeightRanges[category];
  return [min, Math.min(max, maxHeight)];
}

/**
 * Generate a random height within range, biased toward max when maxHeight is high
 * This ensures tall gardens actually have plants reaching the top
 */
function generatePlantHeight(minH: number, maxH: number, maxHeight: number, rand: () => number): number {
  const range = maxH - minH;

  // When maxHeight is high (>0.5), bias toward the upper end of the range
  // This makes tall gardens look properly full
  if (maxHeight > 0.5 && maxH > 0.4) {
    // Use a power curve to bias toward max
    // biasFactor: 0 at maxHeight=0.5, 1 at maxHeight=1.0
    const biasFactor = (maxHeight - 0.5) / 0.5;
    // Apply bias: raise random to a power less than 1 to skew toward 1
    const biasedRand = Math.pow(rand(), 1 - biasFactor * 0.5);
    return minH + range * biasedRand;
  }

  return minH + range * rand();
}

/**
 * Generate all plants for the garden
 * Optimized for memory efficiency with pre-allocated array
 */
export function generatePlants(options: ResolvedOptions): PlantData[] {
  const { duration, generations, maxHeight, density, seed, colors, timingCurve, categories } = options;

  const [minPlantsPerGen, maxPlantsPerGen] = plantsPerGeneration[density];

  // Parse category filter
  const categoryFilter = parseCategoryFilter(categories);

  // Build color arrays once
  const flowerColors = buildFlowerColors(colors as Required<ColorOptions>);
  const foliageColors = buildFoliageColors(colors as Required<ColorOptions>);

  // Estimate total plants for pre-allocation (reduces memory fragmentation)
  const avgPlantsPerGen = (minPlantsPerGen + maxPlantsPerGen) / 2;
  const estimatedTotal = Math.ceil(generations * avgPlantsPerGen * 1.1);
  const plants: PlantData[] = [];
  plants.length = estimatedTotal; // Pre-allocate

  let plantId = 0;
  let actualCount = 0;

  for (let gen = 0; gen < generations; gen++) {
    // Apply timing curve to warp generation start times
    const warpedStart = applyTimingCurve(gen, generations, timingCurve);
    const warpedEnd = applyTimingCurve(gen + 1, generations, timingCurve);
    const genDelay = warpedStart * duration;
    const genDuration = (warpedEnd - warpedStart) * duration;

    const genRand = createRandom(seed + gen * 1000);

    // Number of plants in this generation
    const plantsInGen = Math.floor(randomRange(minPlantsPerGen, maxPlantsPerGen + 1, genRand));

    for (let p = 0; p < plantsInGen; p++) {
      const plantRand = createRandom(seed + gen * 1000 + p * 100);

      // Select plant type (filtered by maxHeight and categories)
      const type = selectPlantType(plantRand, maxHeight, categoryFilter);

      // Position
      const x = plantRand();

      // Height based on type (biased toward max for tall gardens)
      const [minH, maxH] = getHeightRange(type, maxHeight);
      const plantHeight = generatePlantHeight(minH, maxH, maxHeight, plantRand);

      // Colors - use direct array indexing for speed
      const flowerColorIdx = Math.floor(plantRand() * flowerColors.length);
      const leafColorIdx = Math.floor(plantRand() * foliageColors.leaves.length);
      const stemColorIdx = Math.floor(plantRand() * foliageColors.stems.length);

      // Timing - use warped generation duration for proper pacing
      const delay = genDelay + plantRand() * genDuration * 0.5;
      const rawGrowDuration = genDuration * randomRange(0.6, 1.0, plantRand);
      // Ensure plant finishes within animation duration, with minimum to prevent division by zero
      const growDuration = Math.max(0.001, Math.min(rawGrowDuration, duration - delay));

      // Visual properties
      const petals = 5 + Math.floor(plantRand() * 4);
      const lean = (plantRand() - 0.5) * 0.3;
      const scale = randomRange(0.7, 1.2, plantRand);

      // Cache category and variation for O(1) lookup during rendering
      const category = plantTypeToCategory.get(type) ?? PlantCategory.SimpleFlower;
      const variation = getPlantVariation(type);

      plants[actualCount++] = {
        id: plantId++,
        type,
        x,
        maxHeight: plantHeight,
        flowerColor: flowerColors[flowerColorIdx],
        stemColor: foliageColors.stems[stemColorIdx],
        leafColor: foliageColors.leaves[leafColorIdx],
        delay,
        growDuration,
        seed: seed + gen * 1000 + p * 100,
        petals,
        lean,
        scale,
        generation: gen,
        category,
        variation,
      };
    }
  }

  // Trim array to actual size
  plants.length = actualCount;

  // Sort by height for proper layering (shorter plants in front)
  plants.sort((a, b) => a.maxHeight - b.maxHeight);

  return plants;
}

/**
 * Get the generation that should be active at a given time
 */
export function getCurrentGeneration(time: number, duration: number, generations: number): number {
  const timePerGen = duration / generations;
  return Math.min(generations - 1, Math.floor(time / timePerGen));
}

/**
 * Check if a generation just completed
 */
export function didGenerationComplete(
  prevTime: number,
  currentTime: number,
  duration: number,
  generations: number
): number | null {
  const timePerGen = duration / generations;
  const prevGen = Math.floor(prevTime / timePerGen);
  const currentGen = Math.floor(currentTime / timePerGen);

  if (currentGen > prevGen && currentGen <= generations) {
    return prevGen + 1;
  }

  return null;
}

/**
 * Get the category for a plant type (exported for renderer use)
 */
export function getPlantCategory(type: PlantType): PlantCategory {
  return plantTypeToCategory.get(type) ?? PlantCategory.SimpleFlower;
}

// Re-export for convenience
export { PlantCategory } from '../types';
export { getPlantVariation } from './variations';
