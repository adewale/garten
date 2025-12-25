import type { ColorPalette, ColorOptions } from './types';
import { lightenColor, darkenColor } from './utils';

/**
 * Flower color palettes by theme
 */
export const flowerPalettes: Record<ColorPalette, string[]> = {
  natural: [
    // Reds/pinks
    '#E85D75', '#D64550', '#F4A4B0', '#C71585',
    // Yellows
    '#F4D03F', '#FFDB58', '#FFE135', '#DAA520',
    // Purples/blues
    '#9B72AA', '#7B68EE', '#6A5ACD', '#8A2BE2',
    // Whites/creams
    '#FFFEF0', '#FFF8DC', '#FFEFD5', '#FAF0E6',
  ],
  warm: [
    '#FF6B6B', '#FFA07A', '#FFD93D', '#FF8C42',
    '#E85D75', '#F4A4B0', '#FFDB58', '#FFE135',
    '#FFF8DC', '#FFEFD5',
  ],
  cool: [
    '#7B68EE', '#6A5ACD', '#9B72AA', '#8A2BE2',
    '#87CEEB', '#B0E0E6', '#ADD8E6', '#E6E6FA',
    '#FFFEF0', '#F0F8FF',
  ],
  monochrome: [
    '#FFFFFF', '#F5F5F5', '#E8E8E8', '#DCDCDC',
    '#D3D3D3', '#C0C0C0', '#A9A9A9', '#989898',
  ],
  vibrant: [
    '#FF1493', '#FF4500', '#FFD700', '#32CD32',
    '#00CED1', '#1E90FF', '#9400D3', '#FF69B4',
    '#FFA500', '#ADFF2F',
  ],
};

/**
 * Foliage (leaf/stem) color palettes
 */
export const foliagePalettes: Record<ColorPalette, { leaves: string[]; stems: string[] }> = {
  natural: {
    leaves: ['#228B22', '#2E8B57', '#3CB371', '#6B8E23', '#556B2F', '#8FBC8F'],
    stems: ['#2D5A27', '#3D6B37', '#4A7C40', '#5D8A52'],
  },
  warm: {
    leaves: ['#6B8E23', '#808000', '#9ACD32', '#7CFC00', '#556B2F'],
    stems: ['#5D5A27', '#6D6B37', '#5A6C40', '#7D8A52'],
  },
  cool: {
    leaves: ['#2E8B57', '#20B2AA', '#3CB371', '#00FA9A', '#66CDAA'],
    stems: ['#2D5A47', '#3D6B57', '#4A7C60', '#5D8A72'],
  },
  monochrome: {
    leaves: ['#696969', '#808080', '#A9A9A9', '#778899', '#708090'],
    stems: ['#4D4D4D', '#5D5D5D', '#6A6A6A', '#7D7D7D'],
  },
  vibrant: {
    leaves: ['#00FF00', '#32CD32', '#00FA9A', '#7FFF00', '#ADFF2F'],
    stems: ['#228B22', '#008000', '#006400', '#2E8B57'],
  },
};

/**
 * Generate accent color variants
 */
export function generateAccentVariants(accent: string): string[] {
  return [
    accent,
    lightenColor(accent, 0.15),
    darkenColor(accent, 0.15),
    lightenColor(accent, 0.3),
    darkenColor(accent, 0.08),
  ];
}

/**
 * Build flower color array with accent weighting
 */
export function buildFlowerColors(options: Required<ColorOptions>): string[] {
  // Use custom colors if provided
  if (options.flowerColors.length > 0) {
    return options.flowerColors;
  }

  const baseColors = flowerPalettes[options.palette];
  const accentVariants = generateAccentVariants(options.accent);

  // Calculate how many accent colors to include based on weight
  const totalColors = baseColors.length + accentVariants.length;
  const accentCount = Math.round(totalColors * options.accentWeight);
  const baseCount = totalColors - accentCount;

  // Build weighted array
  const result: string[] = [];

  // Add accent colors (repeated based on weight)
  for (let i = 0; i < accentCount; i++) {
    result.push(accentVariants[i % accentVariants.length]);
  }

  // Add base palette colors
  for (let i = 0; i < baseCount; i++) {
    result.push(baseColors[i % baseColors.length]);
  }

  return result;
}

/**
 * Build foliage colors
 */
export function buildFoliageColors(
  options: Required<ColorOptions>
): { leaves: string[]; stems: string[] } {
  if (options.foliageColors.length > 0) {
    // Use custom colors for both
    return {
      leaves: options.foliageColors,
      stems: options.foliageColors.map((c) => darkenColor(c, 0.2)),
    };
  }

  return foliagePalettes[options.palette];
}
