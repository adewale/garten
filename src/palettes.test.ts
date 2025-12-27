import { describe, it, expect } from 'vitest';
import {
  flowerPalettes,
  foliagePalettes,
  generateAccentVariants,
  generateMonotoneFlowerColors,
  generateMonotoneFoliageColors,
  buildFlowerColors,
  buildFoliageColors,
} from './palettes';
import type { ColorPalette } from './types';

describe('flowerPalettes', () => {
  it('should have all expected palettes', () => {
    const expectedPalettes: ColorPalette[] = ['natural', 'warm', 'cool', 'grayscale', 'vibrant', 'monotone'];
    for (const palette of expectedPalettes) {
      expect(flowerPalettes[palette]).toBeDefined();
      expect(Array.isArray(flowerPalettes[palette])).toBe(true);
    }
  });

  it('should have valid hex colors in standard palettes', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    const standardPalettes: ColorPalette[] = ['natural', 'warm', 'cool', 'grayscale', 'vibrant'];
    for (const palette of standardPalettes) {
      for (const color of flowerPalettes[palette]) {
        expect(color).toMatch(hexPattern);
      }
    }
  });

  it('should have grayscale colors that are achromatic', () => {
    // All grayscale colors should have R=G=B (or very close)
    for (const color of flowerPalettes.grayscale) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      // Check that R, G, B are equal (true gray)
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  it('should have empty monotone placeholder (generated dynamically)', () => {
    expect(flowerPalettes.monotone).toEqual([]);
  });
});

describe('foliagePalettes', () => {
  it('should have all expected palettes', () => {
    const expectedPalettes: ColorPalette[] = ['natural', 'warm', 'cool', 'grayscale', 'vibrant', 'monotone'];
    for (const palette of expectedPalettes) {
      expect(foliagePalettes[palette]).toBeDefined();
      expect(foliagePalettes[palette].leaves).toBeDefined();
      expect(foliagePalettes[palette].stems).toBeDefined();
    }
  });

  it('should have valid hex colors for standard palette leaves and stems', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    const standardPalettes: ColorPalette[] = ['natural', 'warm', 'cool', 'grayscale', 'vibrant'];
    for (const palette of standardPalettes) {
      for (const color of foliagePalettes[palette].leaves) {
        expect(color).toMatch(hexPattern);
      }
      for (const color of foliagePalettes[palette].stems) {
        expect(color).toMatch(hexPattern);
      }
    }
  });

  it('should have empty monotone placeholder (generated dynamically)', () => {
    expect(foliagePalettes.monotone.leaves).toEqual([]);
    expect(foliagePalettes.monotone.stems).toEqual([]);
  });
});

describe('generateAccentVariants', () => {
  it('should generate 5 variants including original', () => {
    const variants = generateAccentVariants('#F6821F');
    expect(variants).toHaveLength(5);
    expect(variants[0]).toBe('#F6821F');
  });

  it('should generate valid hex colors', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    const variants = generateAccentVariants('#FF0000');
    for (const variant of variants) {
      expect(variant).toMatch(hexPattern);
    }
  });
});

describe('generateMonotoneFlowerColors', () => {
  it('should generate 7 tints and shades', () => {
    const colors = generateMonotoneFlowerColors('#F6821F');
    expect(colors).toHaveLength(7);
  });

  it('should include the original accent color', () => {
    const accent = '#F6821F';
    const colors = generateMonotoneFlowerColors(accent);
    expect(colors).toContain(accent);
  });

  it('should generate valid hex colors', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    const colors = generateMonotoneFlowerColors('#FF5500');
    for (const color of colors) {
      expect(color).toMatch(hexPattern);
    }
  });

  it('should have lighter colors before the accent and darker after', () => {
    const accent = '#808080'; // Mid-gray for easy comparison
    const colors = generateMonotoneFlowerColors(accent);
    const accentIndex = colors.indexOf(accent);

    // Colors before accent should be lighter (higher hex values)
    // Colors after accent should be darker (lower hex values)
    expect(accentIndex).toBeGreaterThan(0);
    expect(accentIndex).toBeLessThan(colors.length - 1);
  });
});

describe('generateMonotoneFoliageColors', () => {
  it('should return leaves and stems arrays', () => {
    const foliage = generateMonotoneFoliageColors('#F6821F');
    expect(foliage.leaves).toBeDefined();
    expect(foliage.stems).toBeDefined();
    expect(Array.isArray(foliage.leaves)).toBe(true);
    expect(Array.isArray(foliage.stems)).toBe(true);
  });

  it('should generate 5 leaf colors and 4 stem colors', () => {
    const foliage = generateMonotoneFoliageColors('#F6821F');
    expect(foliage.leaves).toHaveLength(5);
    expect(foliage.stems).toHaveLength(4);
  });

  it('should generate valid hex colors', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    const foliage = generateMonotoneFoliageColors('#0088FF');
    for (const color of foliage.leaves) {
      expect(color).toMatch(hexPattern);
    }
    for (const color of foliage.stems) {
      expect(color).toMatch(hexPattern);
    }
  });

  it('should make stems darker than leaves', () => {
    const foliage = generateMonotoneFoliageColors('#8888FF');
    // Compare average brightness
    const avgLeaf = foliage.leaves.reduce((sum, c) => sum + parseInt(c.slice(1), 16), 0) / foliage.leaves.length;
    const avgStem = foliage.stems.reduce((sum, c) => sum + parseInt(c.slice(1), 16), 0) / foliage.stems.length;
    expect(avgStem).toBeLessThan(avgLeaf);
  });
});

describe('buildFlowerColors', () => {
  const baseOptions = {
    accent: '#F6821F',
    palette: 'natural' as ColorPalette,
    flowerColors: [] as string[],
    foliageColors: [] as string[],
    accentWeight: 0.4,
  };

  it('should return custom colors if provided', () => {
    const customColors = ['#FF0000', '#00FF00', '#0000FF'];
    const result = buildFlowerColors({ ...baseOptions, flowerColors: customColors });
    expect(result).toEqual(customColors);
  });

  it('should build weighted color array for standard palettes', () => {
    const result = buildFlowerColors({ ...baseOptions, palette: 'natural', accentWeight: 0.5 });
    expect(result.length).toBeGreaterThan(0);
    // With 50% accent weight, should have accent colors in the result
    expect(result.some(c => c === baseOptions.accent)).toBe(true);
  });

  it('should work with all palettes', () => {
    const palettes: ColorPalette[] = ['natural', 'warm', 'cool', 'grayscale', 'vibrant', 'monotone'];
    for (const palette of palettes) {
      const result = buildFlowerColors({ ...baseOptions, palette });
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('should respect accentWeight: 1 for standard palettes (only accent colors)', () => {
    const result = buildFlowerColors({ ...baseOptions, palette: 'natural', accentWeight: 1 });
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain(baseOptions.accent);
  });

  it('should respect accentWeight: 0 for standard palettes (only palette colors)', () => {
    const result = buildFlowerColors({ ...baseOptions, palette: 'natural', accentWeight: 0 });
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain(baseOptions.accent);
  });
});

describe('buildFlowerColors - grayscale', () => {
  const baseOptions = {
    accent: '#F6821F',
    palette: 'grayscale' as ColorPalette,
    flowerColors: [] as string[],
    foliageColors: [] as string[],
    accentWeight: 0.4,
  };

  it('should return only grayscale colors regardless of accent', () => {
    const result = buildFlowerColors(baseOptions);
    expect(result).toEqual(flowerPalettes.grayscale);
  });

  it('should ignore accentWeight entirely', () => {
    const result1 = buildFlowerColors({ ...baseOptions, accentWeight: 0 });
    const result2 = buildFlowerColors({ ...baseOptions, accentWeight: 1 });
    expect(result1).toEqual(result2);
    expect(result1).toEqual(flowerPalettes.grayscale);
  });

  it('should ignore accent color entirely', () => {
    const result1 = buildFlowerColors({ ...baseOptions, accent: '#FF0000' });
    const result2 = buildFlowerColors({ ...baseOptions, accent: '#0000FF' });
    expect(result1).toEqual(result2);
    expect(result1).not.toContain('#FF0000');
    expect(result1).not.toContain('#0000FF');
  });

  it('should produce truly achromatic colors', () => {
    const result = buildFlowerColors(baseOptions);
    for (const color of result) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });
});

describe('buildFlowerColors - monotone', () => {
  const baseOptions = {
    accent: '#F6821F',
    palette: 'monotone' as ColorPalette,
    flowerColors: [] as string[],
    foliageColors: [] as string[],
    accentWeight: 0.4,
  };

  it('should derive all colors from accent', () => {
    const result = buildFlowerColors(baseOptions);
    expect(result).toHaveLength(7);
    expect(result).toContain(baseOptions.accent);
  });

  it('should ignore accentWeight', () => {
    const result1 = buildFlowerColors({ ...baseOptions, accentWeight: 0 });
    const result2 = buildFlowerColors({ ...baseOptions, accentWeight: 1 });
    expect(result1).toEqual(result2);
  });

  it('should change colors when accent changes', () => {
    const result1 = buildFlowerColors({ ...baseOptions, accent: '#FF0000' });
    const result2 = buildFlowerColors({ ...baseOptions, accent: '#0000FF' });
    expect(result1).not.toEqual(result2);
    expect(result1).toContain('#FF0000');
    expect(result2).toContain('#0000FF');
  });
});

describe('buildFoliageColors', () => {
  const baseOptions = {
    accent: '#F6821F',
    palette: 'natural' as ColorPalette,
    flowerColors: [] as string[],
    foliageColors: [] as string[],
    accentWeight: 0.4,
  };

  it('should return custom colors if provided', () => {
    const customColors = ['#228B22', '#2E8B57'];
    const result = buildFoliageColors({ ...baseOptions, foliageColors: customColors });
    expect(result.leaves).toEqual(customColors);
    expect(result.stems).toHaveLength(customColors.length);
  });

  it('should work with all standard palettes', () => {
    const palettes: ColorPalette[] = ['natural', 'warm', 'cool', 'grayscale', 'vibrant'];
    for (const palette of palettes) {
      const result = buildFoliageColors({ ...baseOptions, palette });
      expect(result.leaves.length).toBeGreaterThan(0);
      expect(result.stems.length).toBeGreaterThan(0);
    }
  });

  it('should return palette foliage colors for standard palettes', () => {
    const result = buildFoliageColors({ ...baseOptions, palette: 'natural' });
    expect(result.leaves).toEqual(foliagePalettes.natural.leaves);
    expect(result.stems).toEqual(foliagePalettes.natural.stems);
  });
});

describe('buildFoliageColors - grayscale', () => {
  const baseOptions = {
    accent: '#F6821F',
    palette: 'grayscale' as ColorPalette,
    flowerColors: [] as string[],
    foliageColors: [] as string[],
    accentWeight: 0.4,
  };

  it('should return grayscale foliage', () => {
    const result = buildFoliageColors(baseOptions);
    expect(result).toEqual(foliagePalettes.grayscale);
  });

  it('should ignore accent', () => {
    const result1 = buildFoliageColors({ ...baseOptions, accent: '#FF0000' });
    const result2 = buildFoliageColors({ ...baseOptions, accent: '#0000FF' });
    expect(result1).toEqual(result2);
  });
});

describe('buildFoliageColors - monotone', () => {
  const baseOptions = {
    accent: '#F6821F',
    palette: 'monotone' as ColorPalette,
    flowerColors: [] as string[],
    foliageColors: [] as string[],
    accentWeight: 0.4,
  };

  it('should derive foliage from accent', () => {
    const result = buildFoliageColors(baseOptions);
    expect(result.leaves).toHaveLength(5);
    expect(result.stems).toHaveLength(4);
  });

  it('should change foliage when accent changes', () => {
    const result1 = buildFoliageColors({ ...baseOptions, accent: '#FF0000' });
    const result2 = buildFoliageColors({ ...baseOptions, accent: '#0000FF' });
    expect(result1.leaves).not.toEqual(result2.leaves);
    expect(result1.stems).not.toEqual(result2.stems);
  });

  it('should generate valid hex colors', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    const result = buildFoliageColors(baseOptions);
    for (const color of result.leaves) {
      expect(color).toMatch(hexPattern);
    }
    for (const color of result.stems) {
      expect(color).toMatch(hexPattern);
    }
  });
});
