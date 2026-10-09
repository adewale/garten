import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  themes,
  presets,
  applyTheme,
  applyPreset,
  createConfig,
  getThemeNames,
  getPresetNames,
  createTheme,
  createPreset,
} from './presets';
import { resolveOptions } from './defaults';
import { generatePlants } from './plants/generator';
import { buildFlowerColors, buildFoliageColors } from './palettes';
import type { ColorOptions, GardenOptions, GardenTheme, GardenPreset } from './types';

// ==================== ARBITRARIES ====================

const PALETTES = ['natural', 'warm', 'cool', 'grayscale', 'vibrant', 'monotone'] as const;
const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => '#' + n.toString(16).padStart(6, '0'));
/** A field that is absent, explicitly undefined, or set */
const maybe = <T>(arb: fc.Arbitrary<T>) => fc.option(arb, { nil: undefined });

const COLOR_KEYS = ['palette', 'accent', 'flowerColors', 'foliageColors', 'accentWeight'] as const;
const colorsArb: fc.Arbitrary<ColorOptions> = fc.record(
  {
    palette: maybe(fc.constantFrom(...PALETTES)),
    accent: maybe(hex),
    flowerColors: maybe(fc.array(hex, { maxLength: 4 })),
    foliageColors: maybe(fc.array(hex, { maxLength: 4 })),
    accentWeight: maybe(fc.double({ min: 0, max: 1, noNaN: true })),
  },
  { requiredKeys: [] }
);

const SCALAR_KEYS = [
  'duration', 'generations', 'density', 'maxHeight', 'speed', 'loop', 'opacity', 'fadeHeight', 'targetFPS', 'categories',
] as const;
const optionsArb: fc.Arbitrary<Partial<GardenOptions>> = fc.record(
  {
    duration: maybe(fc.integer({ min: 1, max: 5000 })),
    generations: maybe(fc.integer({ min: 1, max: 200 })),
    density: maybe(fc.constantFrom('sparse' as const, 'normal' as const, 'dense' as const, 'lush' as const)),
    maxHeight: maybe(fc.double({ min: 0.05, max: 1, noNaN: true })),
    speed: maybe(fc.double({ min: 0.01, max: 100, noNaN: true })),
    loop: maybe(fc.boolean()),
    opacity: maybe(fc.double({ min: 0, max: 1, noNaN: true })),
    fadeHeight: maybe(fc.double({ min: 0, max: 1, noNaN: true })),
    targetFPS: maybe(fc.integer({ min: 1, max: 120 })),
    categories: maybe(fc.subarray(['rose', 'tulip', 'grass', 'fern', 'conifer'], { minLength: 1 })),
    fadeColor: maybe(hex),
    colors: maybe(colorsArb),
  },
  { requiredKeys: [] }
);

const customThemeArb: fc.Arbitrary<GardenTheme> = fc.record(
  {
    name: fc.string({ minLength: 1, maxLength: 10 }),
    palette: fc.constantFrom(...PALETTES),
    accent: hex,
    flowerColors: fc.array(hex, { minLength: 1, maxLength: 4 }),
    foliageColors: fc.array(hex, { minLength: 1, maxLength: 4 }),
    fadeColor: hex,
  },
  { requiredKeys: ['name', 'palette'] }
);
const themeArb = fc.oneof(fc.constantFrom(...Object.values(themes)), customThemeArb);
const presetArb: fc.Arbitrary<GardenPreset> = fc.oneof(
  fc.constantFrom(...Object.values(presets)),
  fc.record({ name: fc.string({ maxLength: 10 }), options: optionsArb })
);

/** Drop explicitly-undefined keys, recursing into colors */
function stripUndefined(opts: Partial<GardenOptions>): Partial<GardenOptions> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(opts)) {
    if (v === undefined) continue;
    out[k] = k === 'colors' ? Object.fromEntries(Object.entries(v as object).filter(([, c]) => c !== undefined)) : v;
  }
  return out as Partial<GardenOptions>;
}

const container = document.createElement('div');
/** What a merged config means to the library: its resolved options */
function resolved(opts: Partial<GardenOptions>) {
  const { container: _c, events: _e, ...rest } = resolveOptions({ ...opts, container, seed: 42 } as GardenOptions);
  return rest;
}

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

// ==================== applyTheme ====================

describe('Property: applyTheme merge laws', () => {
  it('explicit user colors win; theme colors fill only what the user left undefined', () => {
    fc.assert(
      fc.property(themeArb, optionsArb, (theme, opts) => {
        const colors = applyTheme(theme, opts).colors!;
        for (const k of COLOR_KEYS) {
          const user = opts.colors?.[k];
          const fromTheme = k === 'accentWeight' ? undefined : theme[k];
          const expected = user !== undefined ? user : fromTheme;
          expect(colors[k], k).toBe(expected);
          // Never an explicit-undefined key: it would clobber resolveOptions defaults downstream
          if (expected === undefined) expect(k in colors, `${k} present as undefined`).toBe(false);
        }
      }),
      { numRuns: 5 }
    );
  });

  it('fadeColor is the user value when defined, else the theme value', () => {
    fc.assert(
      fc.property(themeArb, optionsArb, (theme, opts) => {
        expect(applyTheme(theme, opts).fadeColor).toBe(opts.fadeColor ?? theme.fadeColor);
      }),
      { numRuns: 5 }
    );
  });

  it('every non-color option passes through unchanged', () => {
    fc.assert(
      fc.property(themeArb, optionsArb, (theme, opts) => {
        const result = applyTheme(theme, opts);
        for (const k of SCALAR_KEYS) expect(result[k], k).toBe(opts[k]);
      }),
      { numRuns: 5 }
    );
  });

  it('explicit undefined behaves exactly like an absent key', () => {
    fc.assert(
      fc.property(themeArb, optionsArb, (theme, opts) => {
        expect(resolved(applyTheme(theme, opts))).toEqual(resolved(applyTheme(theme, stripUndefined(opts))));
      }),
      { numRuns: 5 }
    );
  });

  it('reject: an unknown theme name warns and falls back to natural', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }).filter((n) => !(n in themes)), optionsArb, (name, opts) => {
        warnSpy.mockClear();
        expect(applyTheme(name, opts)).toEqual(applyTheme('natural', opts));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
      }),
      { numRuns: 5 }
    );
  });
});

// ==================== applyPreset ====================

describe('Property: applyPreset merge laws', () => {
  it('every scalar is the user value when defined, else the preset value', () => {
    // Explicit undefined in the user options must not erase a preset value
    fc.assert(
      fc.property(presetArb, optionsArb, (preset, opts) => {
        const result = applyPreset(preset, opts);
        for (const k of [...SCALAR_KEYS, 'fadeColor'] as const) {
          expect(result[k], k).toBe(opts[k] !== undefined ? opts[k] : preset.options[k]);
        }
      }),
      { numRuns: 5, examples: [[presets.lush, { generations: undefined }]] }
    );
  });

  it('colors deep-merge: defined user color fields win, preset color fields fill the rest', () => {
    fc.assert(
      fc.property(presetArb, optionsArb, (preset, opts) => {
        const colors = applyPreset(preset, opts).colors;
        for (const k of COLOR_KEYS) {
          const user = opts.colors?.[k];
          expect(colors?.[k], k).toBe(user !== undefined ? user : preset.options.colors?.[k]);
        }
      }),
      { numRuns: 5 }
    );
  });

  it('explicit undefined behaves exactly like an absent key', () => {
    fc.assert(
      fc.property(presetArb, optionsArb, (preset, opts) => {
        expect(resolved(applyPreset(preset, opts))).toEqual(resolved(applyPreset(preset, stripUndefined(opts))));
      }),
      { numRuns: 5, examples: [[presets.lush, { generations: undefined }]] }
    );
  });

  it('reject: an unknown preset name warns and falls back to default', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }).filter((n) => !(n in presets)), optionsArb, (name, opts) => {
        warnSpy.mockClear();
        expect(applyPreset(name, opts)).toEqual(applyPreset('default', opts));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
      }),
      { numRuns: 5 }
    );
  });
});

// ==================== createConfig ====================

describe('Property: createConfig merge laws', () => {
  const presetName = fc.constantFrom(...Object.keys(presets));
  const themeName = fc.constantFrom(...Object.keys(themes));

  it('scalars: user value when defined, else the preset value; fadeColor: user, else theme', () => {
    fc.assert(
      fc.property(presetName, themeName, optionsArb, (p, t, opts) => {
        const result = createConfig(p, t, opts);
        for (const k of SCALAR_KEYS) {
          expect(result[k], k).toBe(opts[k] !== undefined ? opts[k] : presets[p].options[k]);
        }
        expect(result.fadeColor, 'fadeColor').toBe(opts.fadeColor ?? themes[t].fadeColor);
      }),
      { numRuns: 5, examples: [['lush', 'midnight', { generations: undefined, fadeColor: undefined }]] }
    );
  });

  it('colors: defined user fields win, theme fields fill the rest', () => {
    fc.assert(
      fc.property(presetName, themeName, optionsArb, (p, t, opts) => {
        const colors = createConfig(p, t, opts).colors!;
        for (const k of COLOR_KEYS) {
          const user = opts.colors?.[k];
          const fromTheme = k === 'accentWeight' ? undefined : themes[t][k];
          expect(colors[k], k).toBe(user !== undefined ? user : fromTheme);
        }
      }),
      { numRuns: 5 }
    );
  });

  it('explicit undefined behaves exactly like an absent key', () => {
    fc.assert(
      fc.property(presetName, themeName, optionsArb, (p, t, opts) => {
        expect(resolved(createConfig(p, t, opts))).toEqual(resolved(createConfig(p, t, stripUndefined(opts))));
      }),
      { numRuns: 5, examples: [['lush', 'midnight', { generations: undefined, fadeColor: undefined }]] }
    );
  });
});

// ==================== EXHAUSTIVE ====================

describe('Exhaustive: every built-in preset x theme resolves to its preset and theme and generates', () => {
  it.each(Object.keys(presets))('preset %s with every theme', (p) => {
    for (const t of Object.keys(themes)) {
      const label = `${p} + ${t}`;
      const r = resolveOptions({ ...createConfig(p, t, {}), container, seed: 42 } as GardenOptions);
      for (const [k, v] of Object.entries(presets[p].options)) {
        expect(r[k as keyof typeof r], `${label}: ${k}`).toEqual(v);
      }
      const theme = themes[t];
      expect(r.colors.palette, label).toBe(theme.palette);
      if (theme.accent) expect(r.colors.accent, label).toBe(theme.accent);
      expect(r.colors.flowerColors, label).toEqual(theme.flowerColors ?? []);
      expect(r.colors.foliageColors, label).toEqual(theme.foliageColors ?? []);
      if (theme.fadeColor) expect(r.fadeColor, label).toBe(theme.fadeColor);

      // Generation: cap the generation count to keep the 132-way sweep cheap
      const plants = generatePlants({ ...r, generations: Math.min(r.generations, 4) });
      expect(plants.length, label).toBeGreaterThan(0);
      const flowers = new Set(buildFlowerColors(r.colors));
      const leaves = new Set(buildFoliageColors(r.colors).leaves);
      for (const plant of plants) {
        expect(flowers.has(plant.flowerColor), `${label}: ${plant.flowerColor}`).toBe(true);
        expect(leaves.has(plant.leafColor), `${label}: ${plant.leafColor}`).toBe(true);
      }
    }
  });
});

// ==================== CATALOG AND CONSTRUCTORS ====================

describe('Catalog', () => {
  it('name getters list exactly the built-in keys', () => {
    expect(getThemeNames()).toEqual(Object.keys(themes));
    expect(getPresetNames()).toEqual(Object.keys(presets));
  });

  it('every theme has a name and a known palette; every preset a name and options', () => {
    for (const theme of Object.values(themes)) {
      expect(theme.name).toMatch(/\S/);
      expect(PALETTES).toContain(theme.palette);
    }
    for (const preset of Object.values(presets)) {
      expect(preset.name).toMatch(/\S/);
      expect(Object.keys(preset.options).length).toBeGreaterThan(0);
    }
  });
});

describe('Property: createTheme/createPreset build exactly the literal objects', () => {
  it('createTheme(name, config) is { name, ...config } and applies like the literal', () => {
    fc.assert(
      fc.property(customThemeArb, optionsArb, ({ name, ...config }, opts) => {
        const theme = createTheme(name, config);
        expect(theme).toEqual({ name, ...config });
        expect(applyTheme(theme, opts)).toEqual(applyTheme({ name, ...config }, opts));
      }),
      { numRuns: 5 }
    );
  });

  it('createPreset(name, options, description) is { name, options, description }', () => {
    fc.assert(
      fc.property(fc.string(), optionsArb, maybe(fc.string()), (name, options, description) => {
        expect(createPreset(name, options, description)).toEqual({ name, options, description });
      }),
      { numRuns: 5 }
    );
  });
});
