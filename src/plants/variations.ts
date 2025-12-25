/**
 * Plant variation parameters and sparse map with defaults
 * Extracted to reduce redundancy and improve maintainability
 */

import type { PlantVariation } from '../types';
import { PlantType } from '../types';
import { VARIATION_DEFAULTS } from '../constants';

/**
 * Default variation parameters used as base for all plants
 */
export const defaultVariation: PlantVariation = {
  sizeMultiplier: VARIATION_DEFAULTS.SIZE_MULTIPLIER,
  heightMultiplier: VARIATION_DEFAULTS.HEIGHT_MULTIPLIER,
  petalCountModifier: VARIATION_DEFAULTS.PETAL_COUNT_MODIFIER,
  thicknessMultiplier: VARIATION_DEFAULTS.THICKNESS_MULTIPLIER,
  leanMultiplier: VARIATION_DEFAULTS.LEAN_MULTIPLIER,
  complexity: VARIATION_DEFAULTS.COMPLEXITY,
};

/**
 * Partial variation overrides - only specify fields that differ from defaults
 * This reduces redundancy from defining all 6 fields for each of 147 plant types
 */
type PartialVariation = Partial<PlantVariation>;

/**
 * Sparse variation overrides - only plants that differ from defaults need entries
 */
const variationOverrides: Map<PlantType, PartialVariation> = new Map([
  // === SIMPLE FLOWERS ===
  // SimpleFlower uses all defaults - no entry needed
  [PlantType.SimpleFlowerSmall, { sizeMultiplier: 0.7, heightMultiplier: 0.8, petalCountModifier: -1, thicknessMultiplier: 0.8, complexity: 0.3 }],
  [PlantType.SimpleFlowerLarge, { sizeMultiplier: 1.4, heightMultiplier: 1.1, petalCountModifier: 2, thicknessMultiplier: 1.2, leanMultiplier: 0.8, complexity: 0.7 }],
  [PlantType.SimpleFlowerTall, { sizeMultiplier: 0.9, heightMultiplier: 1.3, thicknessMultiplier: 0.9, leanMultiplier: 0.7 }],
  [PlantType.SimpleFlowerShort, { sizeMultiplier: 1.1, heightMultiplier: 0.7, petalCountModifier: 1, thicknessMultiplier: 1.1, leanMultiplier: 1.2, complexity: 0.4 }],
  [PlantType.SimpleFlowerWide, { sizeMultiplier: 1.3, heightMultiplier: 0.9, petalCountModifier: 3, complexity: 0.6 }],
  [PlantType.SimpleFlowerNarrow, { sizeMultiplier: 0.8, heightMultiplier: 1.1, petalCountModifier: -2, thicknessMultiplier: 0.8, leanMultiplier: 0.9, complexity: 0.4 }],
  [PlantType.SimpleFlowerDouble, { sizeMultiplier: 1.2, petalCountModifier: 5, thicknessMultiplier: 1.1, leanMultiplier: 0.9, complexity: 0.8 }],
  [PlantType.SimpleFlowerClustered, { sizeMultiplier: 0.6, heightMultiplier: 0.9, petalCountModifier: -1, thicknessMultiplier: 0.9, leanMultiplier: 1.3, complexity: 0.7 }],
  [PlantType.SimpleFlowerSpiral, { petalCountModifier: 2, leanMultiplier: 1.5, complexity: 0.9 }],

  // === TULIPS ===
  [PlantType.Tulip, { leanMultiplier: 0.5 }],
  [PlantType.TulipTall, { sizeMultiplier: 0.9, heightMultiplier: 1.3, thicknessMultiplier: 0.9, leanMultiplier: 0.4 }],
  [PlantType.TulipShort, { sizeMultiplier: 1.1, heightMultiplier: 0.7, thicknessMultiplier: 1.1, leanMultiplier: 0.6, complexity: 0.4 }],
  [PlantType.TulipDouble, { sizeMultiplier: 1.2, petalCountModifier: 3, thicknessMultiplier: 1.1, leanMultiplier: 0.5, complexity: 0.8 }],
  [PlantType.TulipFringed, { leanMultiplier: 0.5, complexity: 0.9 }],
  [PlantType.TulipParrot, { sizeMultiplier: 1.3, heightMultiplier: 0.95, petalCountModifier: 2, leanMultiplier: 0.7, complexity: 1.0 }],
  [PlantType.TulipLily, { sizeMultiplier: 1.1, heightMultiplier: 1.1, thicknessMultiplier: 0.9, leanMultiplier: 0.6, complexity: 0.6 }],
  [PlantType.TulipRembrandt, { leanMultiplier: 0.5, complexity: 0.7 }],
  [PlantType.TulipDarwin, { sizeMultiplier: 1.15, heightMultiplier: 1.2, leanMultiplier: 0.4 }],
  [PlantType.TulipTriumph, { sizeMultiplier: 1.05, heightMultiplier: 1.1, thicknessMultiplier: 1.05, leanMultiplier: 0.5 }],

  // === DAISIES ===
  // Daisy uses all defaults - no entry needed
  [PlantType.DaisySmall, { sizeMultiplier: 0.7, heightMultiplier: 0.8, petalCountModifier: -2, thicknessMultiplier: 0.8, complexity: 0.3 }],
  [PlantType.DaisyLarge, { sizeMultiplier: 1.4, heightMultiplier: 1.1, petalCountModifier: 4, thicknessMultiplier: 1.2, leanMultiplier: 0.8, complexity: 0.7 }],
  [PlantType.DaisyDouble, { sizeMultiplier: 1.2, petalCountModifier: 8, thicknessMultiplier: 1.1, leanMultiplier: 0.9, complexity: 0.9 }],
  [PlantType.DaisyGerbera, { sizeMultiplier: 1.5, petalCountModifier: 6, thicknessMultiplier: 1.3, leanMultiplier: 0.7, complexity: 0.8 }],
  [PlantType.DaisyShasta, { sizeMultiplier: 1.3, heightMultiplier: 1.15, petalCountModifier: 4, thicknessMultiplier: 1.1, leanMultiplier: 0.8, complexity: 0.6 }],
  [PlantType.DaisyAfrican, { sizeMultiplier: 1.1, heightMultiplier: 0.9, petalCountModifier: 2, complexity: 0.7 }],
  [PlantType.DaisyOxeye, { sizeMultiplier: 0.9, thicknessMultiplier: 0.9, leanMultiplier: 1.1, complexity: 0.4 }],
  [PlantType.DaisyPainted, { heightMultiplier: 0.95, petalCountModifier: 2, complexity: 0.8 }],
  [PlantType.DaisyMarguerite, { sizeMultiplier: 1.1, heightMultiplier: 1.05, petalCountModifier: 3, leanMultiplier: 0.9 }],

  // === WILDFLOWERS ===
  // Wildflower uses all defaults - no entry needed
  [PlantType.WildflowerClustered, { sizeMultiplier: 0.8, heightMultiplier: 0.9, petalCountModifier: 2, thicknessMultiplier: 0.9, leanMultiplier: 1.2, complexity: 0.7 }],
  [PlantType.WildflowerScattered, { sizeMultiplier: 0.7, petalCountModifier: -1, thicknessMultiplier: 0.8, leanMultiplier: 1.5, complexity: 0.6 }],
  [PlantType.WildflowerTall, { sizeMultiplier: 0.9, heightMultiplier: 1.4, thicknessMultiplier: 0.9, leanMultiplier: 0.8 }],
  [PlantType.WildflowerMeadow, { sizeMultiplier: 1.1, petalCountModifier: 1, leanMultiplier: 1.3, complexity: 0.6 }],
  [PlantType.WildflowerPrairie, { heightMultiplier: 1.2, thicknessMultiplier: 1.1 }],
  [PlantType.WildflowerAlpine, { sizeMultiplier: 0.6, heightMultiplier: 0.7, petalCountModifier: -1, thicknessMultiplier: 0.8, leanMultiplier: 0.8, complexity: 0.4 }],
  [PlantType.WildflowerWoodland, { sizeMultiplier: 0.9, heightMultiplier: 0.9, petalCountModifier: 1, thicknessMultiplier: 0.9, leanMultiplier: 1.1, complexity: 0.6 }],
  [PlantType.WildflowerCoastal, { sizeMultiplier: 0.8, heightMultiplier: 0.8, leanMultiplier: 1.4 }],
  [PlantType.WildflowerDesert, { sizeMultiplier: 0.7, heightMultiplier: 0.6, petalCountModifier: -1, thicknessMultiplier: 1.1, leanMultiplier: 0.9, complexity: 0.4 }],

  // === GRASSES ===
  [PlantType.Grass, { complexity: 0.3 }],
  [PlantType.GrassTall, { heightMultiplier: 1.5, petalCountModifier: 1, thicknessMultiplier: 0.9, leanMultiplier: 0.8, complexity: 0.4 }],
  [PlantType.GrassShort, { heightMultiplier: 0.6, thicknessMultiplier: 1.1, leanMultiplier: 1.2, complexity: 0.2 }],
  [PlantType.GrassWispy, { sizeMultiplier: 0.8, heightMultiplier: 1.2, petalCountModifier: 2, thicknessMultiplier: 0.6, leanMultiplier: 1.5 }],
  [PlantType.GrassThick, { sizeMultiplier: 1.2, heightMultiplier: 0.9, petalCountModifier: -1, thicknessMultiplier: 1.5, leanMultiplier: 0.7, complexity: 0.3 }],
  [PlantType.GrassPampas, { sizeMultiplier: 1.3, heightMultiplier: 1.8, petalCountModifier: 3, thicknessMultiplier: 1.2, complexity: 0.8 }],
  [PlantType.GrassFountain, { sizeMultiplier: 1.1, heightMultiplier: 1.3, petalCountModifier: 4, thicknessMultiplier: 0.8, leanMultiplier: 1.8, complexity: 0.7 }],
  [PlantType.GrassBlue, { sizeMultiplier: 0.9, heightMultiplier: 0.8, petalCountModifier: 1, complexity: 0.4 }],
  [PlantType.GrassFeather, { heightMultiplier: 1.4, petalCountModifier: 2, thicknessMultiplier: 0.7, leanMultiplier: 1.3, complexity: 0.6 }],
  [PlantType.GrassReed, { sizeMultiplier: 0.9, heightMultiplier: 1.6, thicknessMultiplier: 1.3, leanMultiplier: 0.5, complexity: 0.4 }],

  // === FERNS ===
  [PlantType.Fern, { complexity: 0.6 }],
  [PlantType.FernSmall, { sizeMultiplier: 0.6, heightMultiplier: 0.7, petalCountModifier: -2, thicknessMultiplier: 0.8, complexity: 0.4 }],
  [PlantType.FernLarge, { sizeMultiplier: 1.4, heightMultiplier: 1.3, petalCountModifier: 3, thicknessMultiplier: 1.2, leanMultiplier: 0.8, complexity: 0.8 }],
  [PlantType.FernCurly, { heightMultiplier: 0.9, petalCountModifier: 1, leanMultiplier: 1.8, complexity: 0.9 }],
  [PlantType.FernStraight, { sizeMultiplier: 0.9, heightMultiplier: 1.2, leanMultiplier: 0.3, complexity: 0.4 }],
  [PlantType.FernMaidenhair, { sizeMultiplier: 0.7, heightMultiplier: 0.8, petalCountModifier: 4, thicknessMultiplier: 0.6, leanMultiplier: 1.5, complexity: 0.9 }],
  [PlantType.FernBoston, { sizeMultiplier: 1.2, petalCountModifier: 2, leanMultiplier: 1.6, complexity: 0.7 }],
  [PlantType.FernStaghorn, { sizeMultiplier: 1.3, heightMultiplier: 0.9, thicknessMultiplier: 1.3, complexity: 0.8 }],
  [PlantType.FernBird, { sizeMultiplier: 1.1, heightMultiplier: 1.1, petalCountModifier: -1, thicknessMultiplier: 1.2, leanMultiplier: 0.7 }],
  [PlantType.FernTree, { sizeMultiplier: 1.5, heightMultiplier: 1.5, petalCountModifier: 4, thicknessMultiplier: 1.4, leanMultiplier: 0.5, complexity: 0.9 }],

  // === BUSHES ===
  [PlantType.Bush, { complexity: 0.6 }],
  [PlantType.BushSmall, { sizeMultiplier: 0.6, heightMultiplier: 0.7, petalCountModifier: -2, thicknessMultiplier: 0.9, complexity: 0.4 }],
  [PlantType.BushLarge, { sizeMultiplier: 1.5, heightMultiplier: 1.3, petalCountModifier: 3, thicknessMultiplier: 1.2, leanMultiplier: 0.8, complexity: 0.8 }],
  [PlantType.BushFlowering, { sizeMultiplier: 1.1, petalCountModifier: 4, complexity: 0.9 }],
  [PlantType.BushBerry, { sizeMultiplier: 0.9, heightMultiplier: 0.9, thicknessMultiplier: 1.1, leanMultiplier: 0.9, complexity: 0.7 }],
  [PlantType.BushRound, { sizeMultiplier: 1.2, heightMultiplier: 0.8, petalCountModifier: 2, thicknessMultiplier: 1.2, leanMultiplier: 0.5 }],
  [PlantType.BushSpreading, { sizeMultiplier: 1.3, heightMultiplier: 0.7, petalCountModifier: 1, leanMultiplier: 1.5, complexity: 0.6 }],
  [PlantType.BushCompact, { sizeMultiplier: 0.8, heightMultiplier: 0.8, thicknessMultiplier: 1.3, leanMultiplier: 0.7, complexity: 0.4 }],
  [PlantType.BushWild, { sizeMultiplier: 1.1, heightMultiplier: 1.1, petalCountModifier: 2, thicknessMultiplier: 0.9, leanMultiplier: 1.4, complexity: 0.8 }],
  [PlantType.BushOrnamental, { petalCountModifier: 3, leanMultiplier: 0.8, complexity: 0.7 }],

  // === ROSES ===
  [PlantType.Rose, { leanMultiplier: 0.8, complexity: 0.8 }],
  [PlantType.RoseClimbing, { sizeMultiplier: 0.9, heightMultiplier: 1.5, thicknessMultiplier: 0.9, leanMultiplier: 1.2, complexity: 0.7 }],
  [PlantType.RoseMiniature, { sizeMultiplier: 0.5, heightMultiplier: 0.6, petalCountModifier: -2, thicknessMultiplier: 0.7, leanMultiplier: 0.9, complexity: 0.6 }],
  [PlantType.RoseWild, { sizeMultiplier: 0.8, heightMultiplier: 1.1, petalCountModifier: -3, thicknessMultiplier: 0.8, leanMultiplier: 1.3 }],
  [PlantType.RoseDouble, { sizeMultiplier: 1.2, petalCountModifier: 8, thicknessMultiplier: 1.1, leanMultiplier: 0.7, complexity: 1.0 }],

  // === LILIES ===
  [PlantType.Lily, { leanMultiplier: 0.7, complexity: 0.7 }],
  [PlantType.LilyTiger, { sizeMultiplier: 1.1, heightMultiplier: 1.1, leanMultiplier: 0.8, complexity: 0.9 }],
  [PlantType.LilyCalla, { sizeMultiplier: 0.9, heightMultiplier: 1.2, petalCountModifier: -4, thicknessMultiplier: 1.1, leanMultiplier: 0.5, complexity: 0.6 }],
  [PlantType.LilyDaylily, { heightMultiplier: 0.9, thicknessMultiplier: 0.9 }],
  [PlantType.LilyStargazer, { sizeMultiplier: 1.2, leanMultiplier: 0.6, complexity: 0.8 }],

  // === ORCHIDS ===
  [PlantType.Orchid, { leanMultiplier: 0.6, complexity: 0.9 }],
  [PlantType.OrchidMoth, { sizeMultiplier: 1.1, heightMultiplier: 0.9, thicknessMultiplier: 0.9, leanMultiplier: 0.7, complexity: 0.8 }],
  [PlantType.OrchidDendrobium, { sizeMultiplier: 0.8, heightMultiplier: 1.2, petalCountModifier: 2, thicknessMultiplier: 0.8, leanMultiplier: 0.8, complexity: 0.9 }],
  [PlantType.OrchidCattleya, { sizeMultiplier: 1.3, heightMultiplier: 0.95, thicknessMultiplier: 1.1, leanMultiplier: 0.5, complexity: 1.0 }],
  [PlantType.OrchidVanda, { heightMultiplier: 1.1, petalCountModifier: 1, thicknessMultiplier: 0.9, leanMultiplier: 0.7, complexity: 0.85 }],

  // === SUCCULENTS ===
  [PlantType.Succulent, { thicknessMultiplier: 1.5, leanMultiplier: 0.3 }],
  [PlantType.SucculentRosette, { sizeMultiplier: 1.1, heightMultiplier: 0.6, petalCountModifier: 3, thicknessMultiplier: 1.4, leanMultiplier: 0.2, complexity: 0.7 }],
  [PlantType.SucculentSpiky, { sizeMultiplier: 0.9, heightMultiplier: 1.2, petalCountModifier: -2, thicknessMultiplier: 1.6, leanMultiplier: 0.4, complexity: 0.6 }],
  [PlantType.SucculentTrailing, { sizeMultiplier: 0.7, heightMultiplier: 0.5, petalCountModifier: 2, thicknessMultiplier: 1.3, leanMultiplier: 2.0, complexity: 0.6 }],
  [PlantType.SucculentFlowering, { heightMultiplier: 0.8, petalCountModifier: 4, thicknessMultiplier: 1.4, leanMultiplier: 0.3, complexity: 0.8 }],

  // === HERBS ===
  [PlantType.Lavender, { thicknessMultiplier: 0.8, leanMultiplier: 0.8, complexity: 0.7 }],
  [PlantType.LavenderTall, { sizeMultiplier: 0.9, heightMultiplier: 1.4, petalCountModifier: 2, thicknessMultiplier: 0.7, leanMultiplier: 0.6, complexity: 0.7 }],
  [PlantType.Sage, { sizeMultiplier: 1.1, heightMultiplier: 0.8, thicknessMultiplier: 1.1, leanMultiplier: 0.9 }],
  [PlantType.Thyme, { sizeMultiplier: 0.6, heightMultiplier: 0.5, petalCountModifier: -1, thicknessMultiplier: 0.7, leanMultiplier: 1.2, complexity: 0.4 }],
  [PlantType.Rosemary, { sizeMultiplier: 0.8, heightMultiplier: 1.1, thicknessMultiplier: 0.9, leanMultiplier: 0.7, complexity: 0.6 }],

  // === SPECIALTY ===
  [PlantType.Poppy, { petalCountModifier: -1, thicknessMultiplier: 0.8, leanMultiplier: 1.2, complexity: 0.6 }],
  [PlantType.Sunflower, { sizeMultiplier: 1.8, heightMultiplier: 1.6, petalCountModifier: 8, thicknessMultiplier: 1.5, leanMultiplier: 0.4, complexity: 0.7 }],
  [PlantType.Iris, { sizeMultiplier: 1.1, heightMultiplier: 1.2, leanMultiplier: 0.5, complexity: 0.8 }],
  [PlantType.Peony, { sizeMultiplier: 1.4, heightMultiplier: 0.9, petalCountModifier: 10, thicknessMultiplier: 1.3, leanMultiplier: 0.6, complexity: 1.0 }],
  [PlantType.Hydrangea, { sizeMultiplier: 1.5, heightMultiplier: 0.85, petalCountModifier: 15, thicknessMultiplier: 1.4, leanMultiplier: 0.5, complexity: 0.9 }],
  [PlantType.Dahlia, { sizeMultiplier: 1.3, petalCountModifier: 12, thicknessMultiplier: 1.2, leanMultiplier: 0.6, complexity: 0.95 }],

  // === TALL FLOWERS ===
  [PlantType.Hollyhock, { thicknessMultiplier: 1.2, leanMultiplier: 0.3, complexity: 0.7 }],
  [PlantType.HollyhockDouble, { sizeMultiplier: 1.2, heightMultiplier: 1.1, petalCountModifier: 5, thicknessMultiplier: 1.3, leanMultiplier: 0.2, complexity: 0.9 }],
  [PlantType.Delphinium, { sizeMultiplier: 0.8, heightMultiplier: 1.2, petalCountModifier: 2, leanMultiplier: 0.2, complexity: 0.8 }],
  [PlantType.DelphiniumTall, { sizeMultiplier: 0.7, heightMultiplier: 1.4, petalCountModifier: 3, thicknessMultiplier: 0.9, leanMultiplier: 0.15, complexity: 0.85 }],
  [PlantType.Foxglove, { sizeMultiplier: 0.9, heightMultiplier: 1.1, thicknessMultiplier: 1.1, leanMultiplier: 0.25, complexity: 0.75 }],
  [PlantType.FoxgloveTall, { sizeMultiplier: 0.85, heightMultiplier: 1.3, petalCountModifier: 2, leanMultiplier: 0.2, complexity: 0.8 }],
  [PlantType.Gladiolus, { sizeMultiplier: 1.1, heightMultiplier: 1.15, petalCountModifier: 1, thicknessMultiplier: 1.2, leanMultiplier: 0.2, complexity: 0.7 }],
  [PlantType.Lupine, { sizeMultiplier: 0.9, petalCountModifier: 4, leanMultiplier: 0.3, complexity: 0.75 }],

  // === GIANT GRASSES ===
  [PlantType.Bamboo, { thicknessMultiplier: 0.8, leanMultiplier: 0.15, complexity: 0.6 }],
  [PlantType.BambooTall, { sizeMultiplier: 0.9, heightMultiplier: 1.3, thicknessMultiplier: 0.7, leanMultiplier: 0.1, complexity: 0.65 }],
  [PlantType.BambooClump, { sizeMultiplier: 1.2, heightMultiplier: 0.9, petalCountModifier: 3, thicknessMultiplier: 0.9, leanMultiplier: 0.2, complexity: 0.7 }],
  [PlantType.GiantReed, { sizeMultiplier: 1.1, heightMultiplier: 1.1, leanMultiplier: 0.25 }],
  [PlantType.ElephantGrass, { sizeMultiplier: 1.3, heightMultiplier: 1.2, petalCountModifier: 2, thicknessMultiplier: 1.2, leanMultiplier: 0.3, complexity: 0.55 }],
  [PlantType.Miscanthus, { petalCountModifier: 1, thicknessMultiplier: 0.9, leanMultiplier: 0.35, complexity: 0.6 }],
  [PlantType.MiscanthusTall, { sizeMultiplier: 0.95, heightMultiplier: 1.25, petalCountModifier: 2, thicknessMultiplier: 0.85, leanMultiplier: 0.3, complexity: 0.65 }],
  [PlantType.Cortaderia, { sizeMultiplier: 1.4, heightMultiplier: 1.15, petalCountModifier: 3, thicknessMultiplier: 1.1, leanMultiplier: 0.4, complexity: 0.7 }],

  // === CLIMBERS ===
  [PlantType.Vine, { thicknessMultiplier: 0.6, leanMultiplier: 0.8, complexity: 0.6 }],
  [PlantType.VineFlowering, { sizeMultiplier: 1.2, petalCountModifier: 3, thicknessMultiplier: 0.7, leanMultiplier: 0.7, complexity: 0.75 }],
  [PlantType.VineIvy, { sizeMultiplier: 0.8, heightMultiplier: 1.1, thicknessMultiplier: 0.5, leanMultiplier: 0.9, complexity: 0.7 }],
  [PlantType.Wisteria, { sizeMultiplier: 1.3, heightMultiplier: 1.15, petalCountModifier: 5, thicknessMultiplier: 0.8, leanMultiplier: 0.6, complexity: 0.85 }],
  [PlantType.WisteriaCascade, { sizeMultiplier: 1.4, heightMultiplier: 1.25, petalCountModifier: 8, thicknessMultiplier: 0.9, leanMultiplier: 0.5, complexity: 0.9 }],
  [PlantType.Clematis, { sizeMultiplier: 1.1, petalCountModifier: 2, thicknessMultiplier: 0.6, leanMultiplier: 0.75, complexity: 0.7 }],
  [PlantType.ClematisLarge, { sizeMultiplier: 1.4, heightMultiplier: 1.1, petalCountModifier: 4, thicknessMultiplier: 0.7, leanMultiplier: 0.65, complexity: 0.8 }],
  [PlantType.MorningGlory, { sizeMultiplier: 1.2, heightMultiplier: 1.05, thicknessMultiplier: 0.55, leanMultiplier: 0.85, complexity: 0.65 }],

  // === SMALL TREES ===
  [PlantType.Sapling, { leanMultiplier: 0.1 }],
  [PlantType.SaplingOak, { sizeMultiplier: 1.2, heightMultiplier: 0.95, petalCountModifier: 2, thicknessMultiplier: 1.3, leanMultiplier: 0.08, complexity: 0.6 }],
  [PlantType.SaplingMaple, { sizeMultiplier: 1.1, petalCountModifier: 3, thicknessMultiplier: 1.1, leanMultiplier: 0.12, complexity: 0.65 }],
  [PlantType.SaplingBirch, { sizeMultiplier: 0.9, heightMultiplier: 1.15, petalCountModifier: 1, thicknessMultiplier: 0.8, leanMultiplier: 0.15, complexity: 0.55 }],
  [PlantType.TreeYoung, { sizeMultiplier: 1.15, heightMultiplier: 1.1, petalCountModifier: 2, thicknessMultiplier: 1.2, leanMultiplier: 0.1, complexity: 0.6 }],
  [PlantType.TreeOrnamental, { sizeMultiplier: 1.3, heightMultiplier: 0.9, petalCountModifier: 5, thicknessMultiplier: 1.1, leanMultiplier: 0.12, complexity: 0.75 }],
  [PlantType.Birch, { sizeMultiplier: 0.85, heightMultiplier: 1.2, thicknessMultiplier: 0.75, leanMultiplier: 0.18, complexity: 0.6 }],
  [PlantType.Willow, { sizeMultiplier: 1.2, petalCountModifier: 4, leanMultiplier: 0.2, complexity: 0.7 }],
  [PlantType.WillowWeeping, { sizeMultiplier: 1.4, heightMultiplier: 1.1, petalCountModifier: 6, thicknessMultiplier: 1.1, leanMultiplier: 0.15, complexity: 0.85 }],
  [PlantType.CherryBlossom, { sizeMultiplier: 1.3, heightMultiplier: 0.95, petalCountModifier: 8, leanMultiplier: 0.12, complexity: 0.9 }],

  // === TROPICAL ===
  [PlantType.PalmSmall, { leanMultiplier: 0.15, complexity: 0.6 }],
  [PlantType.PalmFan, { sizeMultiplier: 1.3, heightMultiplier: 0.9, petalCountModifier: 3, thicknessMultiplier: 1.2, leanMultiplier: 0.1, complexity: 0.7 }],
  [PlantType.BirdOfParadise, { sizeMultiplier: 1.1, thicknessMultiplier: 0.9, leanMultiplier: 0.2, complexity: 0.8 }],
  [PlantType.BirdOfParadiseTall, { heightMultiplier: 1.2, petalCountModifier: 1, thicknessMultiplier: 0.85, leanMultiplier: 0.18, complexity: 0.85 }],
  [PlantType.Banana, { sizeMultiplier: 1.4, heightMultiplier: 1.1, petalCountModifier: 2, thicknessMultiplier: 1.4, leanMultiplier: 0.12, complexity: 0.65 }],
  [PlantType.BananaSmall, { sizeMultiplier: 1.1, heightMultiplier: 0.85, petalCountModifier: 1, thicknessMultiplier: 1.2, leanMultiplier: 0.15, complexity: 0.6 }],

  // === CONIFERS ===
  [PlantType.Pine, { thicknessMultiplier: 1.2, leanMultiplier: 0.05, complexity: 0.6 }],
  [PlantType.PineYoung, { sizeMultiplier: 0.8, heightMultiplier: 0.85, petalCountModifier: -1, leanMultiplier: 0.08 }],
  [PlantType.Cypress, { sizeMultiplier: 0.7, heightMultiplier: 1.15, thicknessMultiplier: 0.9, leanMultiplier: 0.03, complexity: 0.55 }],
  [PlantType.CypressTall, { sizeMultiplier: 0.6, heightMultiplier: 1.3, thicknessMultiplier: 0.85, leanMultiplier: 0.02, complexity: 0.6 }],
  [PlantType.Juniper, { sizeMultiplier: 1.1, heightMultiplier: 0.9, petalCountModifier: 1, thicknessMultiplier: 1.1, leanMultiplier: 0.1, complexity: 0.55 }],
  [PlantType.JuniperTall, { sizeMultiplier: 0.9, heightMultiplier: 1.1, leanMultiplier: 0.07, complexity: 0.6 }],
]);

/**
 * Get variation for a plant type
 * Merges sparse overrides with defaults for complete variation
 */
export function getPlantVariation(type: PlantType): PlantVariation {
  const overrides = variationOverrides.get(type);
  if (!overrides) {
    return defaultVariation;
  }
  return { ...defaultVariation, ...overrides };
}
