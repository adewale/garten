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
import type { ColorPalette, ColorOptions } from './types';
import * as fc from 'fast-check';
import { Color, lightenColor, darkenColor } from './Color';

const ALL_PALETTES: ColorPalette[] = ['natural', 'warm', 'cool', 'grayscale', 'vibrant', 'monotone'];
const STANDARD_PALETTES: ColorPalette[] = ['natural', 'warm', 'cool', 'grayscale', 'vibrant'];

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

describe('flowerPalettes', () => {
  it('should have exactly the expected palettes, each standard one non-empty', () => {
    expect(Object.keys(flowerPalettes).sort()).toEqual([...ALL_PALETTES].sort());
    for (const palette of STANDARD_PALETTES) {
      expect(flowerPalettes[palette].length, palette).toBeGreaterThanOrEqual(3);
      // Duplicates would silently skew the color weighting
      expect(new Set(flowerPalettes[palette]).size, palette).toBe(flowerPalettes[palette].length);
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
  it('should have exactly the expected palettes, each standard one with leaves and stems', () => {
    expect(Object.keys(foliagePalettes).sort()).toEqual([...ALL_PALETTES].sort());
    for (const palette of STANDARD_PALETTES) {
      expect(Object.keys(foliagePalettes[palette]).sort(), palette).toEqual(['leaves', 'stems']);
      expect(foliagePalettes[palette].leaves.length, palette).toBeGreaterThan(0);
      expect(foliagePalettes[palette].stems.length, palette).toBeGreaterThan(0);
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

  it('should have grayscale leaves and stems that are achromatic', () => {
    for (const color of [...foliagePalettes.grayscale.leaves, ...foliagePalettes.grayscale.stems]) {
      const [r, g, b] = rgb(color);
      expect(r, color).toBe(g);
      expect(g, color).toBe(b);
    }
  });

  it('should have empty monotone placeholder (generated dynamically)', () => {
    expect(foliagePalettes.monotone.leaves).toEqual([]);
    expect(foliagePalettes.monotone.stems).toEqual([]);
  });
});

// ==================== ARBITRARIES ====================

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

/** Any 3- or 6-digit accent, mixed case, as users write them */
const accentArb = fc
  .tuple(fc.integer({ min: 0, max: 0xffffff }), fc.boolean(), fc.boolean())
  .map(([n, short, upper]) => {
    let hex = short
      ? [n & 0xf, (n >> 4) & 0xf, (n >> 8) & 0xf].map((d) => d.toString(16)).join('')
      : n.toString(16).padStart(6, '0');
    if (upper) hex = hex.toUpperCase();
    return '#' + hex;
  });
const hex6Arb = fc.integer({ min: 0, max: 0xffffff }).map((n) => '#' + n.toString(16).padStart(6, '0').toUpperCase());
const paletteArb = fc.constantFrom(...ALL_PALETTES);
const standardArb = fc.constantFrom<ColorPalette>('natural', 'warm', 'cool', 'vibrant');
/**
 * accentWeight over its whole domain: uniform reals in [0, 1] (fc.double
 * alone is dominated by tiny values), plus every double for the hostile end
 */
const weightArb = fc.oneof(
  fc.integer({ min: 0, max: 2 ** 20 }).map((i) => i / 2 ** 20),
  fc.double()
);
const customArb = fc.option(fc.array(hex6Arb, { maxLength: 6 }), { nil: undefined });

const optionsArb = fc.record({
  accent: accentArb,
  palette: paletteArb,
  flowerColors: customArb,
  foliageColors: customArb,
  accentWeight: weightArb,
}) as fc.Arbitrary<Required<ColorOptions>>;

function channels(hex: string): [number, number, number] {
  const c = Color.fromHex(hex)!;
  return [c.r, c.g, c.b];
}

/** a <= b in every channel */
function noLighter(a: string, b: string): boolean {
  const [x, y] = [channels(a), channels(b)];
  return x.every((v, i) => v <= y[i]);
}

/** Split a standard-palette result into the accent prefix and the base suffix */
function split(result: string[], palette: ColorPalette): { accent: string[]; base: string[] } {
  const B = flowerPalettes[palette].length;
  return { accent: result.slice(0, result.length - B), base: result.slice(result.length - B) };
}

// ==================== GENERATORS OF DERIVED COLORS ====================

describe('Property: accent variants and monotone colors are tints and shades of the accent', () => {
  it('generateAccentVariants is [accent, +15%, -15%, +30%, -8%] in per-channel lightness order', () => {
    fc.assert(
      fc.property(accentArb, (accent) => {
        const v = generateAccentVariants(accent);
        expect(v).toHaveLength(5);
        expect(v[0]).toBe(accent);
        for (const c of v.slice(1)) expect(c).toMatch(HEX6);
        // lighten .3 >= lighten .15 >= accent >= darken .08 >= darken .15, channel by channel
        expect(noLighter(v[1], v[3]) && noLighter(v[0], v[1]) && noLighter(v[4], v[0]) && noLighter(v[2], v[4])).toBe(true);
        expect(v[1]).toBe(lightenColor(accent, 0.15));
        expect(v[2]).toBe(darkenColor(accent, 0.15));
      }),
      { numRuns: 2000 }
    );
  });

  it('generateMonotoneFlowerColors runs from lightest tint to darkest shade with the accent in the middle', () => {
    fc.assert(
      fc.property(accentArb, (accent) => {
        const colors = generateMonotoneFlowerColors(accent);
        expect(colors).toHaveLength(7);
        expect(colors[3]).toBe(accent);
        for (let i = 1; i < colors.length; i++) {
          expect(noLighter(colors[i], colors[i - 1]), `${colors[i - 1]} -> ${colors[i]}`).toBe(true);
        }
      }),
      { numRuns: 2000 }
    );
  });

  it('generateMonotoneFoliageColors: 5 leaves and 4 stems, all shades of the accent, every stem no lighter than any leaf', () => {
    fc.assert(
      fc.property(accentArb, (accent) => {
        const { leaves, stems } = generateMonotoneFoliageColors(accent);
        expect([leaves.length, stems.length]).toEqual([5, 4]);
        for (const c of [...leaves, ...stems]) {
          expect(c).toMatch(HEX6);
          expect(noLighter(c, accent)).toBe(true);
        }
        for (const s of stems) for (const l of leaves) expect(noLighter(s, l), `${s} vs ${l}`).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });
});

// ==================== buildFlowerColors ====================

describe('Property: buildFlowerColors over the full ColorOptions domain', () => {
  it('non-empty custom flowerColors win over every other option, unchanged', () => {
    fc.assert(
      fc.property(optionsArb, fc.array(hex6Arb, { minLength: 1, maxLength: 6 }), (opts, custom) => {
        expect(buildFlowerColors({ ...opts, flowerColors: custom })).toEqual(custom);
      }),
      { numRuns: 1000 }
    );
  });

  it('grayscale (no custom colors) is exactly the achromatic base palette, whatever the accent and weight', () => {
    fc.assert(
      fc.property(optionsArb, fc.constantFrom<string[] | undefined>([], undefined), (opts, none) => {
        const result = buildFlowerColors({ ...opts, palette: 'grayscale', flowerColors: none as string[] });
        expect(result).toEqual(flowerPalettes.grayscale);
        for (const c of result) {
          const [r, g, b] = channels(c);
          expect(r === g && g === b).toBe(true);
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('monotone (no custom colors) is derived from the accent alone', () => {
    fc.assert(
      fc.property(optionsArb, fc.constantFrom<string[] | undefined>([], undefined), (opts, none) => {
        const result = buildFlowerColors({ ...opts, palette: 'monotone', flowerColors: none as string[] });
        expect(result).toEqual(generateMonotoneFlowerColors(opts.accent));
      }),
      { numRuns: 1000 }
    );
  });

  it('standard palettes: every base color is reachable, in order, after a prefix of cycled accent variants', () => {
    fc.assert(
      fc.property(optionsArb, standardArb, (opts, palette) => {
        const w = opts.accentWeight;
        const result = buildFlowerColors({ ...opts, palette, flowerColors: [] });
        const variants = generateAccentVariants(opts.accent);
        if (w >= 1) {
          expect(result).toEqual(variants);
          return;
        }
        const { accent, base } = split(result, palette);
        expect(base).toEqual(flowerPalettes[palette]);
        accent.forEach((c, i) => expect(c).toBe(variants[i % variants.length]));
        if (!(w > 0)) expect(accent).toEqual([]); // 0, negative and NaN mean no accent
        else expect(accent.length).toBeGreaterThan(0);
      }),
      { numRuns: 1000 }
    );
  });

  it('accent share tracks accentWeight: within 1/B below 0.9, saturating at 0.9, monotone in the weight', () => {
    const inside = fc.integer({ min: 1, max: 2 ** 20 - 1 }).map((i) => i / 2 ** 20);
    fc.assert(
      fc.property(standardArb, accentArb, inside, inside, (palette, accent, w1, w2) => {
        const B = flowerPalettes[palette].length;
        const share = (w: number) => {
          const a = split(buildFlowerColors({ accent, palette, flowerColors: [], foliageColors: [], accentWeight: w }), palette).accent.length;
          return { a, f: a / (a + B) };
        };
        const [lo, hi] = w1 <= w2 ? [w1, w2] : [w2, w1];
        const s1 = share(lo), s2 = share(hi);
        expect(s1.a).toBeLessThanOrEqual(s2.a);
        for (const [w, s] of [[lo, s1], [hi, s2]] as const) {
          if (w <= 0.9) expect(Math.abs(s.f - w), `w=${w} share=${s.f}`).toBeLessThanOrEqual(1 / B);
          else expect(s.f).toBeLessThanOrEqual(0.9);
        }
      }),
      { numRuns: 1000, examples: [['natural', '#F6821F', 0.4, 0.9]] }
    );
  });

  it('out-of-range weights clamp: below 0 behaves as 0 and above 1 as 1', () => {
    fc.assert(
      fc.property(optionsArb, standardArb, fc.double({ noNaN: true }), (opts, palette, w) => {
        const base = { ...opts, palette, flowerColors: [] };
        const clamped = Math.max(0, Math.min(1, w));
        expect(buildFlowerColors({ ...base, accentWeight: w })).toEqual(buildFlowerColors({ ...base, accentWeight: clamped }));
      }),
      { numRuns: 1000 }
    );
  });

  it('every built color is a well-formed hex color (custom colors pass through)', () => {
    fc.assert(
      fc.property(optionsArb, (opts) => {
        const result = buildFlowerColors(opts);
        expect(result.length).toBeGreaterThan(0);
        for (const c of result) expect(Color.fromHex(c), c).not.toBeNull();
      }),
      { numRuns: 2000 }
    );
  });
});

// ==================== buildFoliageColors ====================

describe('Property: buildFoliageColors over the full ColorOptions domain', () => {
  it('non-empty custom foliage: leaves are the custom colors, each stem the 20% shade of its leaf', () => {
    fc.assert(
      fc.property(optionsArb, fc.array(hex6Arb, { minLength: 1, maxLength: 6 }), (opts, custom) => {
        const { leaves, stems } = buildFoliageColors({ ...opts, foliageColors: custom });
        expect(leaves).toEqual(custom);
        expect(stems).toEqual(custom.map((c) => darkenColor(c, 0.2)));
        stems.forEach((s, i) => expect(noLighter(s, custom[i])).toBe(true));
      }),
      { numRuns: 1000 }
    );
  });

  it('without custom foliage: monotone derives from the accent, every other palette is its fixed foliage', () => {
    fc.assert(
      fc.property(optionsArb, fc.constantFrom<string[] | undefined>([], undefined), (opts, none) => {
        const result = buildFoliageColors({ ...opts, foliageColors: none as string[] });
        expect(result).toEqual(
          opts.palette === 'monotone' ? generateMonotoneFoliageColors(opts.accent) : foliagePalettes[opts.palette]
        );
      }),
      { numRuns: 2000 }
    );
  });

  it('foliage never depends on flowerColors or accentWeight', () => {
    fc.assert(
      fc.property(optionsArb, customArb, weightArb, (opts, flowers, w) => {
        expect(buildFoliageColors({ ...opts, flowerColors: flowers as string[], accentWeight: w })).toEqual(buildFoliageColors(opts));
      }),
      { numRuns: 1000 }
    );
  });
});
