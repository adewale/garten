/**
 * Presets and Themes - Pre-configured garden setups
 * Provides ready-to-use configurations for common use cases
 */

import type { GardenOptions, GardenPreset, GardenTheme, ColorOptions, Density } from './types';
import { COLORS } from './constants';

// ==================== THEMES ====================

/**
 * Built-in themes for garden visual styling
 */
export const themes: Record<string, GardenTheme> = {
  /**
   * Natural garden with balanced, realistic colors
   */
  natural: {
    name: 'Natural',
    palette: 'natural',
    accent: COLORS.DEFAULT_ACCENT,
  },

  /**
   * Warm sunset garden with oranges, reds, and yellows
   */
  sunset: {
    name: 'Sunset',
    palette: 'warm',
    accent: '#FF6B35',
    fadeColor: '#FFF5EB',
  },

  /**
   * Cool ocean-inspired garden with blues and greens
   */
  ocean: {
    name: 'Ocean',
    palette: 'cool',
    accent: '#0077B6',
    fadeColor: '#F0F8FF',
  },

  /**
   * Elegant monochrome garden
   */
  monochrome: {
    name: 'Monochrome',
    palette: 'monochrome',
    accent: '#666666',
    fadeColor: '#F5F5F5',
  },

  /**
   * Vibrant, high-saturation garden
   */
  vibrant: {
    name: 'Vibrant',
    palette: 'vibrant',
    accent: '#FF1493',
  },

  /**
   * Cherry blossom inspired pink garden
   */
  sakura: {
    name: 'Sakura',
    palette: 'natural',
    accent: '#FFB7C5',
    flowerColors: ['#FFB7C5', '#FFDCE5', '#FFC0CB', '#FF69B4', '#FFFFFF'],
    fadeColor: '#FFF5F7',
  },

  /**
   * Lavender field inspired garden
   */
  lavender: {
    name: 'Lavender',
    palette: 'cool',
    accent: '#9370DB',
    flowerColors: ['#9370DB', '#E6E6FA', '#DDA0DD', '#BA55D3', '#8B008B'],
    foliageColors: ['#556B2F', '#6B8E23', '#808000'],
    fadeColor: '#F5F0FF',
  },

  /**
   * Autumn-inspired garden with warm earth tones
   */
  autumn: {
    name: 'Autumn',
    palette: 'warm',
    accent: '#D2691E',
    flowerColors: ['#D2691E', '#CD853F', '#DAA520', '#B8860B', '#8B4513', '#FF8C00'],
    foliageColors: ['#8B4513', '#A0522D', '#CD853F', '#D2691E'],
    fadeColor: '#FFF8DC',
  },

  /**
   * Night garden with deep, cool colors
   */
  midnight: {
    name: 'Midnight',
    palette: 'cool',
    accent: '#4169E1',
    flowerColors: ['#4169E1', '#6A5ACD', '#9932CC', '#8A2BE2', '#483D8B'],
    foliageColors: ['#2F4F4F', '#006400', '#228B22'],
    fadeColor: '#1A1A2E',
  },

  /**
   * Tropical paradise garden
   */
  tropical: {
    name: 'Tropical',
    palette: 'vibrant',
    accent: '#FF4500',
    flowerColors: ['#FF4500', '#FF6347', '#FFD700', '#00CED1', '#FF1493', '#32CD32'],
    foliageColors: ['#006400', '#228B22', '#32CD32'],
  },

  /**
   * Minimalist zen garden
   */
  zen: {
    name: 'Zen',
    palette: 'monochrome',
    accent: '#8B8B83',
    flowerColors: ['#FFFFFF', '#F5F5F5', '#E8E8E8', '#98FB98'],
    foliageColors: ['#556B2F', '#6B8E23'],
    fadeColor: '#FAFAFA',
  },
};

// ==================== PRESETS ====================

/**
 * Built-in presets for common garden configurations
 */
export const presets: Record<string, GardenPreset> = {
  /**
   * Default balanced garden
   */
  default: {
    name: 'Default',
    description: 'Balanced garden with moderate density and natural colors',
    options: {
      duration: 600,
      generations: 47,
      density: 'normal',
      maxHeight: 0.35,
    },
  },

  /**
   * Quick demo garden (faster animation)
   */
  demo: {
    name: 'Demo',
    description: 'Fast 30-second animation for demonstrations',
    options: {
      duration: 30,
      generations: 10,
      density: 'normal',
      maxHeight: 0.35,
      speed: 1,
    },
  },

  /**
   * Subtle background garden
   */
  subtle: {
    name: 'Subtle',
    description: 'Sparse, low-opacity garden for website backgrounds',
    options: {
      duration: 900,
      generations: 30,
      density: 'sparse',
      maxHeight: 0.25,
      opacity: 0.6,
      fadeHeight: 0.15,
    },
  },

  /**
   * Lush full garden
   */
  lush: {
    name: 'Lush',
    description: 'Dense, vibrant garden with maximum plant coverage',
    options: {
      duration: 600,
      generations: 60,
      density: 'lush',
      maxHeight: 0.45,
    },
  },

  /**
   * Forest garden with tall plants
   */
  forest: {
    name: 'Forest',
    description: 'Tall garden with trees, climbers, and tall flowers',
    options: {
      duration: 900,
      generations: 50,
      density: 'dense',
      maxHeight: 0.8,
      categories: ['small-tree', 'conifer', 'climber', 'giant-grass', 'fern', 'bush'],
    },
  },

  /**
   * Meadow garden (only ground flowers)
   */
  meadow: {
    name: 'Meadow',
    description: 'Low wildflower meadow with grasses',
    options: {
      duration: 600,
      generations: 50,
      density: 'dense',
      maxHeight: 0.25,
      categories: ['wildflower', 'daisy', 'grass', 'simple-flower'],
    },
  },

  /**
   * Rose garden
   */
  roseGarden: {
    name: 'Rose Garden',
    description: 'Elegant garden focused on roses',
    options: {
      duration: 600,
      generations: 40,
      density: 'normal',
      maxHeight: 0.35,
      categories: ['rose', 'bush', 'fern'],
    },
  },

  /**
   * Tropical paradise
   */
  tropical: {
    name: 'Tropical',
    description: 'Lush tropical garden with palms and exotic flowers',
    options: {
      duration: 600,
      generations: 40,
      density: 'dense',
      maxHeight: 0.7,
      categories: ['tropical', 'orchid', 'lily', 'bird-of-paradise', 'fern'],
    },
  },

  /**
   * Herb garden
   */
  herbs: {
    name: 'Herb Garden',
    description: 'Fragrant herb garden with lavender and sage',
    options: {
      duration: 600,
      generations: 35,
      density: 'normal',
      maxHeight: 0.25,
      categories: ['herb', 'bush', 'grass'],
    },
  },

  /**
   * Succulent garden
   */
  succulent: {
    name: 'Succulent Garden',
    description: 'Low-maintenance succulent arrangement',
    options: {
      duration: 300,
      generations: 25,
      density: 'dense',
      maxHeight: 0.15,
      categories: ['succulent'],
    },
  },

  /**
   * Long ambient animation
   */
  ambient: {
    name: 'Ambient',
    description: 'Very slow, continuous background animation',
    options: {
      duration: 3600, // 1 hour
      generations: 100,
      density: 'sparse',
      maxHeight: 0.3,
      loop: true,
      opacity: 0.5,
      fadeHeight: 0.1,
    },
  },

  /**
   * Performance-optimized preset
   */
  performance: {
    name: 'Performance',
    description: 'Optimized for lower-end devices',
    options: {
      duration: 600,
      generations: 30,
      density: 'sparse',
      maxHeight: 0.3,
      targetFPS: 24,
      maxPixelRatio: 1,
    },
  },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Apply a theme to garden options
 * @param theme Theme name or GardenTheme object
 * @param options Base options to merge with
 */
export function applyTheme(
  theme: string | GardenTheme,
  options: Partial<GardenOptions> = {}
): Partial<GardenOptions> {
  const themeConfig = typeof theme === 'string' ? themes[theme] : theme;

  if (!themeConfig) {
    console.warn(`Theme "${theme}" not found, using natural`);
    return options;
  }

  const colors: ColorOptions = {
    palette: themeConfig.palette,
    accent: themeConfig.accent,
    flowerColors: themeConfig.flowerColors,
    foliageColors: themeConfig.foliageColors,
    ...options.colors,
  };

  return {
    ...options,
    colors,
    fadeColor: themeConfig.fadeColor ?? options.fadeColor,
  };
}

/**
 * Apply a preset to garden options
 * @param preset Preset name or GardenPreset object
 * @param options Additional options to merge
 */
export function applyPreset(
  preset: string | GardenPreset,
  options: Partial<GardenOptions> = {}
): Partial<GardenOptions> {
  const presetConfig = typeof preset === 'string' ? presets[preset] : preset;

  if (!presetConfig) {
    console.warn(`Preset "${preset}" not found, using default`);
    return options;
  }

  return {
    ...presetConfig.options,
    ...options,
  };
}

/**
 * Combine a preset and theme
 * @param presetName Preset to apply
 * @param themeName Theme to apply
 * @param options Additional options
 */
export function createConfig(
  presetName: string,
  themeName: string = 'natural',
  options: Partial<GardenOptions> = {}
): Partial<GardenOptions> {
  const presetOptions = applyPreset(presetName, {});
  const themedOptions = applyTheme(themeName, presetOptions);
  return {
    ...themedOptions,
    ...options,
  };
}

/**
 * Get list of available theme names
 */
export function getThemeNames(): string[] {
  return Object.keys(themes);
}

/**
 * Get list of available preset names
 */
export function getPresetNames(): string[] {
  return Object.keys(presets);
}

/**
 * Create a custom theme
 */
export function createTheme(
  name: string,
  config: Omit<GardenTheme, 'name'>
): GardenTheme {
  return { name, ...config };
}

/**
 * Create a custom preset
 */
export function createPreset(
  name: string,
  options: Partial<GardenOptions>,
  description?: string
): GardenPreset {
  return { name, options, description };
}

/**
 * Preset for specific density levels
 */
export function densityPreset(density: Density): Partial<GardenOptions> {
  const configs: Record<Density, Partial<GardenOptions>> = {
    sparse: { density: 'sparse', generations: 30 },
    normal: { density: 'normal', generations: 47 },
    dense: { density: 'dense', generations: 55 },
    lush: { density: 'lush', generations: 65 },
  };
  return configs[density];
}

/**
 * Speed presets for different animation tempos
 */
export function speedPreset(speed: 'slow' | 'normal' | 'fast' | 'instant'): Partial<GardenOptions> {
  const configs: Record<string, Partial<GardenOptions>> = {
    slow: { speed: 0.5, duration: 1200 },
    normal: { speed: 1, duration: 600 },
    fast: { speed: 2, duration: 300 },
    instant: { speed: 10, duration: 60 },
  };
  return configs[speed];
}
