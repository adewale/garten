import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Color, hexToRgb, rgbToHex, lightenColor, darkenColor } from './Color';
import * as utils from './utils';

// ==================== ARBITRARIES ====================

const channel = fc.integer({ min: 0, max: 255 });
const unit = fc.double({ min: 0, max: 1, noNaN: true });
/** Every double, including NaN, ±Infinity, -0 and subnormals */
const anyDouble = fc.double();
const colorArb = fc
  .tuple(channel, channel, channel, unit)
  .map(([r, g, b, a]) => new Color(r, g, b, a));
const opaqueArb = fc.tuple(channel, channel, channel).map(([r, g, b]) => new Color(r, g, b));

const HEX_DIGITS = '0123456789abcdefABCDEF'.split('');
const hexDigits = (n: number) =>
  fc.array(fc.constantFrom(...HEX_DIGITS), { minLength: n, maxLength: n }).map((d) => d.join(''));
/** Well-formed hex in all three documented lengths, with or without '#' */
const validHex = fc
  .tuple(fc.constantFrom(3, 6, 8), fc.boolean())
  .chain(([n, hash]) => hexDigits(n).map((d) => (hash ? '#' : '') + d));

/**
 * Characters that are not hex digits but that parseInt(_, 16) or
 * String.replace('#', '') might still tolerate
 */
const HOSTILE = ['g', 'G', 'x', 'X', 'z', '#', ' ', '\t', '\n', '\0', '-', '+', '.', 'é', '٣'];

/** Near-valid strings: a valid hex with one character replaced, inserted or deleted */
const nearValidHex = fc
  .tuple(validHex, fc.nat(), fc.constantFrom(...HOSTILE), fc.constantFrom('replace', 'insert', 'delete'))
  .map(([hex, pos, ch, op]) => {
    const i = pos % (hex.length + 1);
    if (op === 'replace') return hex.slice(0, i) + ch + hex.slice(i + 1);
    if (op === 'insert') return hex.slice(0, i) + ch + hex.slice(i);
    return hex.slice(0, i) + hex.slice(i + 1);
  });

/** Arbitrary short strings over hex digits plus hostile characters, any length 0..10 */
const hexishString = fc
  .array(fc.constantFrom(...HEX_DIGITS, ...HOSTILE), { maxLength: 10 })
  .map((cs) => cs.join(''));

/** The documented grammar: optional '#', then exactly 3, 6 or 8 hex digits */
const HEX_GRAMMAR = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Reference parser for the grammar above */
function referenceParse(hex: string): { r: number; g: number; b: number; a: number } | null {
  if (!HEX_GRAMMAR.test(hex)) return null;
  let d = hex.replace(/^#/, '');
  if (d.length === 3) d = d.split('').map((c) => c + c).join('');
  const byte = (i: number) => parseInt(d.slice(i, i + 2), 16);
  return { r: byte(0), g: byte(2), b: byte(4), a: d.length === 8 ? byte(6) / 255 : 1 };
}

const channels = (c: Color) => [c.r, c.g, c.b, c.a];

// ==================== EXAMPLES (documentation and pinned regressions) ====================

describe('Color', () => {
  describe('constructor', () => {
    it('should create a color with RGB values and opaque default alpha', () => {
      const color = new Color(255, 128, 64);
      expect(channels(color)).toEqual([255, 128, 64, 1]);
    });
  });

  describe('fromHex', () => {
    it('should parse the three documented formats', () => {
      expect(channels(Color.fromHex('#FF8040')!)).toEqual([255, 128, 64, 1]);
      expect(channels(Color.fromHex('#F84')!)).toEqual([255, 136, 68, 1]);
      expect(channels(Color.fromHex('#FF804080')!)).toEqual([255, 128, 64, 128 / 255]);
      expect(channels(Color.fromHex('FF8040')!)).toEqual([255, 128, 64, 1]);
    });
  });

  describe('fromHSL', () => {
    it('should create primaries and gray from HSL', () => {
      expect(Color.fromHSL(0, 100, 50).toHex()).toBe('#ff0000');
      expect(Color.fromHSL(120, 100, 50).toHex()).toBe('#00ff00');
      expect(Color.fromHSL(240, 100, 50).toHex()).toBe('#0000ff');
      expect(Color.fromHSL(0, 0, 50).toHex()).toBe('#808080');
    });
  });

  describe('parse', () => {
    it('should parse hex, rgb(), rgba() and hsl() strings', () => {
      expect(Color.parse('#FF0000')!.toHex()).toBe('#ff0000');
      expect(channels(Color.parse('rgb(255, 128, 64)')!)).toEqual([255, 128, 64, 1]);
      expect(Color.parse('rgba(255, 128, 64, 0.5)')!.a).toBe(0.5);
      expect(Color.parse('hsl(0, 100, 50)')!.toHex()).toBe('#ff0000');
    });
  });

  describe('string output', () => {
    it('should format hex and CSS strings', () => {
      expect(new Color(255, 128, 64).toHex()).toBe('#ff8040');
      expect(new Color(255, 128, 64, 0.5).toHex(true)).toBe('#ff804080');
      expect(new Color(255, 128, 64).toRGBString()).toBe('rgb(255, 128, 64)');
      expect(new Color(255, 128, 64, 0.5).toRGBString()).toBe('rgba(255, 128, 64, 0.5)');
    });
  });

  describe('luminance and contrast', () => {
    it('should give black/white their WCAG extremes', () => {
      expect(Color.WHITE.luminance()).toBeCloseTo(1, 12);
      expect(Color.BLACK.luminance()).toBe(0);
      expect(Color.WHITE.contrastWith(Color.BLACK)).toBeCloseTo(21, 10);
    });
  });

  describe('static constants', () => {
    it('should have the documented channel values', () => {
      expect(channels(Color.WHITE)).toEqual([255, 255, 255, 1]);
      expect(channels(Color.BLACK)).toEqual([0, 0, 0, 1]);
      expect(channels(Color.TRANSPARENT)).toEqual([0, 0, 0, 0]);
      expect(channels(Color.RED)).toEqual([255, 0, 0, 1]);
      expect(channels(Color.GREEN)).toEqual([0, 255, 0, 1]);
      expect(channels(Color.BLUE)).toEqual([0, 0, 255, 1]);
    });
  });
});

// ==================== PROPERTIES ====================

describe('Property: constructor clamps every input into the value-object invariant', () => {
  // r, g, b are integers in [0, 255] and a is in [0, 1], for any numeric
  // input. NaN is part of the domain: a NaN channel breaks equals()
  // reflexivity and serializes as "#NaN...".
  it('channels are integers in [0, 255] and alpha in [0, 1]', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, anyDouble, anyDouble, (r, g, b, a) => {
        const c = new Color(r, g, b, a);
        for (const v of [c.r, c.g, c.b]) {
          expect(Number.isInteger(v) && v >= 0 && v <= 255, `channel ${v}`).toBe(true);
        }
        expect(c.a >= 0 && c.a <= 1, `alpha ${c.a}`).toBe(true);
      }),
      { numRuns: 5, examples: [[NaN, 0, 0, 1], [0, 0, 0, NaN]] }
    );
  });

  it('in-range inputs round to the nearest integer channel exactly', () => {
    const inRange = fc.double({ min: 0, max: 255, noNaN: true });
    fc.assert(
      fc.property(inRange, inRange, inRange, unit, (r, g, b, a) => {
        expect(channels(new Color(r, g, b, a))).toEqual([Math.round(r), Math.round(g), Math.round(b), a]);
      }),
      { numRuns: 5 }
    );
  });
});

describe('Property: fromHex accepts exactly the documented grammar', () => {
  it('accept: every well-formed 3/6/8-digit hex parses to the reference value', () => {
    fc.assert(
      fc.property(validHex, (hex) => {
        const c = Color.fromHex(hex);
        const ref = referenceParse(hex)!;
        expect(c).not.toBeNull();
        expect(channels(c!)).toEqual([ref.r, ref.g, ref.b, ref.a]);
      }),
      { numRuns: 5 }
    );
  });

  it('reject: near-valid strings (one hostile edit) parse iff they still match the grammar', () => {
    // parseInt('1g', 16) === 1 and ' 1' / '+1' / '-1' parse too, so a
    // per-pair parseInt check lets invalid digits through.
    fc.assert(
      fc.property(nearValidHex, (s) => {
        expect(Color.fromHex(s) === null, JSON.stringify(s)).toBe(referenceParse(s) === null);
      }),
      {
        numRuns: 5,
        examples: [['#1g2233'], ['#-12233'], ['#+12233'], ['# 12233'], ['#ff 000'], ['ab#cdef'], ['#GGG'], ['']],
      }
    );
  });

  it('reject: arbitrary hex-ish strings of any length parse iff they match the grammar', () => {
    fc.assert(
      fc.property(fc.boolean(), hexishString, (hash, body) => {
        const s = (hash ? '#' : '') + body;
        expect(Color.fromHex(s) === null, JSON.stringify(s)).toBe(referenceParse(s) === null);
      }),
      { numRuns: 5, examples: [[false, 'invalid'], [true, ''], [false, '1g1g1g1g']] }
    );
  });
});

describe('Property: hex round-trips', () => {
  it('toHex(true) -> fromHex is the identity on every color with alpha in k/255', () => {
    // Exact: alpha is stored as k/255 and serialized as round(a * 255)
    fc.assert(
      fc.property(channel, channel, channel, channel, (r, g, b, k) => {
        const c = new Color(r, g, b, k / 255);
        expect(Color.fromHex(c.toHex(true))!.equals(c)).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('fromHex -> toHex reproduces any 6/8-digit input in lowercase, and 3-digit input expanded', () => {
    fc.assert(
      fc.property(validHex, (hex) => {
        const digits = hex.replace(/^#/, '').toLowerCase();
        const c = Color.fromHex(hex)!;
        if (digits.length === 8) {
          expect(c.toHex(true)).toBe('#' + digits);
        } else {
          const six = digits.length === 3 ? digits.split('').map((d) => d + d).join('') : digits;
          expect(c.toHex()).toBe('#' + six);
        }
      }),
      { numRuns: 5 }
    );
  });

  it('toHex() is stable across calls and unaffected by toHex(true) (cache)', () => {
    fc.assert(
      fc.property(colorArb, fc.array(fc.boolean(), { maxLength: 6 }), (c, calls) => {
        const expected =
          '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('');
        for (const withAlpha of calls) c.toHex(withAlpha);
        expect(c.toHex()).toBe(expected);
        expect(c.toHex(false)).toBe(expected);
      }),
      { numRuns: 5 }
    );
  });

  it('toString() is the hex form, with alpha exactly when translucent', () => {
    fc.assert(
      fc.property(colorArb, (c) => {
        expect(c.toString()).toBe(c.a < 1 ? c.toHex(true) : c.toHex());
      }),
      { numRuns: 5 }
    );
  });
});

describe('Property: RGB <-> HSL', () => {
  // Exact contract: every 8-bit RGB color survives toHSL -> fromHSL with
  // identical integer channels (the HSL values are floats; the final
  // rounding in the constructor absorbs their error). Verified exhaustively
  // over a third of the cube while writing this test.
  it('fromHSL(toHSL(c)) equals c exactly, alpha included', () => {
    fc.assert(
      fc.property(colorArb, (c) => {
        const { h, s, l } = c.toHSL();
        expect(Color.fromHSL(h, s, l, c.a).equals(c)).toBe(true);
      }),
      { numRuns: 5, examples: [[new Color(0, 0, 0)], [new Color(255, 255, 255)], [new Color(255, 0, 1)]] }
    );
  });

  it('toHSL stays in its documented ranges: h in [0, 360), s and l in [0, 100]', () => {
    fc.assert(
      fc.property(colorArb, (c) => {
        const { h, s, l } = c.toHSL();
        expect(h >= 0 && h < 360, `h=${h}`).toBe(true);
        expect(s >= 0 && s <= 100, `s=${s}`).toBe(true);
        expect(l >= 0 && l <= 100, `l=${l}`).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('achromatic colors (r = g = b) have zero saturation and hue', () => {
    fc.assert(
      fc.property(channel, (v) => {
        const { h, s } = new Color(v, v, v).toHSL();
        expect([h, s]).toEqual([0, 0]);
      }),
      { numRuns: 5 }
    );
  });

  it('fromHSL produces a valid color for the whole documented HSL domain', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 360, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (h, s, l) => {
          const c = Color.fromHSL(h, s, l);
          for (const v of [c.r, c.g, c.b]) expect(Number.isInteger(v) && v >= 0 && v <= 255).toBe(true);
        }
      ),
      { numRuns: 5 }
    );
  });
});

describe('Property: parse', () => {
  it('parse of a #-prefixed string agrees with fromHex (after trim/lowercase)', () => {
    fc.assert(
      fc.property(fc.oneof(validHex, nearValidHex, hexishString), (body) => {
        const s = '#' + body.replace(/^#/, '');
        const parsed = Color.parse(s);
        const direct = Color.fromHex(s.trim().toLowerCase());
        expect(parsed === null ? null : channels(parsed)).toEqual(direct === null ? null : channels(direct));
      }),
      { numRuns: 5 }
    );
  });

  it('parse(c.toRGBString(force)) round-trips every color it serializes', () => {
    // Exact: channels are integers and alpha is printed with full precision
    fc.assert(
      fc.property(colorArb, fc.boolean(), (c, force) => {
        const back = Color.parse(c.toRGBString(force));
        expect(back, c.toRGBString(force)).not.toBeNull();
        expect(back!.equals(c)).toBe(true);
      }),
      { numRuns: 5, examples: [[new Color(1, 2, 3, 1e-7), false]] }
    );
  });

  it('reject: trailing or leading garbage around rgb()/hsl() is not a color', () => {
    expect(Color.parse('rgba(1, 2, 3, .)')).toBeNull();
    expect(Color.parse('rgba(1, 2, 3, 0.1.2)')).toBeNull();
    expect(Color.parse('hsla(1, 2, 3, .)')).toBeNull();
    fc.assert(
      fc.property(
        opaqueArb,
        fc.constantFrom('x', 'garbage', ';', ')', '(', 'rgb'),
        fc.boolean(),
        (c, junk, before) => {
          const css = c.toRGBString();
          expect(Color.parse(before ? junk + css : css + junk)).toBeNull();
        }
      ),
      { numRuns: 5, examples: [[new Color(1, 2, 3), 'garbage', false]] }
    );
  });
});

describe('Property: lighten/darken laws', () => {
  it('endpoints are exact: amount 0 is identity, lighten(1) is white, darken(1) is black, alpha kept', () => {
    fc.assert(
      fc.property(colorArb, (c) => {
        expect(c.lighten(0).equals(c)).toBe(true);
        expect(c.darken(0).equals(c)).toBe(true);
        expect(c.lighten(1).equals(Color.WHITE.withAlpha(c.a))).toBe(true);
        expect(c.darken(1).equals(Color.BLACK.withAlpha(c.a))).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('lighten never lowers and darken never raises any channel, monotonically in amount', () => {
    fc.assert(
      fc.property(colorArb, unit, unit, (c, t1, t2) => {
        const [lo, hi] = t1 <= t2 ? [t1, t2] : [t2, t1];
        const l1 = c.lighten(lo), l2 = c.lighten(hi);
        const d1 = c.darken(lo), d2 = c.darken(hi);
        for (const k of ['r', 'g', 'b'] as const) {
          expect(c[k] <= l1[k] && l1[k] <= l2[k]).toBe(true);
          expect(c[k] >= d1[k] && d1[k] >= d2[k]).toBe(true);
        }
      }),
      { numRuns: 5 }
    );
  });

  it('any amount, including out-of-range and non-finite, yields a valid color', () => {
    fc.assert(
      fc.property(colorArb, anyDouble, (c, t) => {
        for (const out of [c.lighten(t), c.darken(t)]) {
          for (const v of [out.r, out.g, out.b]) {
            expect(Number.isInteger(v) && v >= 0 && v <= 255, `${t} -> ${v}`).toBe(true);
          }
        }
      }),
      { numRuns: 5, examples: [[new Color(1, 2, 3), NaN]] }
    );
  });
});

describe('Property: mix laws', () => {
  it('endpoints are exact: mix(o, 0) is this and mix(o, 1) is other, alpha included', () => {
    fc.assert(
      fc.property(colorArb, colorArb, (a, b) => {
        expect(a.mix(b, 0).equals(a)).toBe(true);
        expect(a.mix(b, 1).equals(b)).toBe(true);
      }),
      // Shrunk counterexample: a + (b - a) * 1 rounds 0.3 + (1e-17 - 0.3) to 0
      { numRuns: 5, examples: [[new Color(0, 0, 0, 0.3), new Color(0, 0, 0, 1e-17)]] }
    );
  });

  it('amount is clamped: below 0 behaves as 0, above 1 as 1', () => {
    fc.assert(
      fc.property(colorArb, colorArb, fc.double({ noNaN: true }), (a, b, t) => {
        const clamped = Math.max(0, Math.min(1, t));
        expect(a.mix(b, t).equals(a.mix(b, clamped))).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('every mixed channel lies between the endpoint channels; default amount is 0.5', () => {
    fc.assert(
      fc.property(colorArb, colorArb, unit, (a, b, t) => {
        const m = a.mix(b, t);
        for (const k of ['r', 'g', 'b', 'a'] as const) {
          expect(m[k] >= Math.min(a[k], b[k]) && m[k] <= Math.max(a[k], b[k])).toBe(true);
        }
        expect(a.mix(b).equals(a.mix(b, 0.5))).toBe(true);
      }),
      { numRuns: 5, examples: [[new Color(0, 0, 0, 0.3), new Color(0, 0, 0, 1e-17), 1]] }
    );
  });
});

describe('Property: other manipulations', () => {
  it('withAlpha replaces alpha (clamped) and keeps rgb', () => {
    fc.assert(
      fc.property(colorArb, fc.double({ noNaN: true }), (c, a) => {
        const w = c.withAlpha(a);
        expect([w.r, w.g, w.b, w.a]).toEqual([c.r, c.g, c.b, Math.max(0, Math.min(1, a))]);
      }),
      { numRuns: 5 }
    );
  });

  it('complement is an exact involution and channels sum to 255', () => {
    fc.assert(
      fc.property(colorArb, (c) => {
        const k = c.complement();
        expect([c.r + k.r, c.g + k.g, c.b + k.b, k.a]).toEqual([255, 255, 255, c.a]);
        expect(k.complement().equals(c)).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('saturate(0), desaturate(0), rotateHue(0) and rotateHue(±360) are exact identities', () => {
    fc.assert(
      fc.property(colorArb, (c) => {
        for (const out of [c.saturate(0), c.desaturate(0), c.rotateHue(0), c.rotateHue(360), c.rotateHue(-360)]) {
          expect(out.equals(c)).toBe(true);
        }
      }),
      { numRuns: 5 }
    );
  });

  it('desaturate(1) is achromatic; saturate/desaturate keep alpha and stay valid', () => {
    fc.assert(
      fc.property(colorArb, unit, (c, t) => {
        const gray = c.desaturate(1);
        expect(gray.r === gray.g && gray.g === gray.b).toBe(true);
        for (const out of [c.saturate(t), c.desaturate(t)]) {
          expect(out.a).toBe(c.a);
          for (const v of [out.r, out.g, out.b]) expect(Number.isInteger(v) && v >= 0 && v <= 255).toBe(true);
        }
      }),
      { numRuns: 5 }
    );
  });

  it('rotating an achromatic color by any finite angle returns the identical gray', () => {
    // Gray has no hue, so rotating it must return the identical gray
    fc.assert(
      fc.property(channel, fc.double({ min: -1e6, max: 1e6, noNaN: true }), (v, deg) => {
        const gray = new Color(v, v, v);
        expect(gray.rotateHue(deg).equals(gray)).toBe(true);
      }),
      { numRuns: 5 }
    );
  });
});

describe('Property: luminance and contrast', () => {
  it('luminance is in [0, 1] and monotone in each channel', () => {
    fc.assert(
      fc.property(opaqueArb, fc.constantFrom('r', 'g', 'b'), channel, (c, k, v) => {
        const raised = new Color(
          k === 'r' ? Math.max(c.r, v) : c.r,
          k === 'g' ? Math.max(c.g, v) : c.g,
          k === 'b' ? Math.max(c.b, v) : c.b
        );
        expect(c.luminance() >= 0 && c.luminance() <= 1).toBe(true);
        expect(raised.luminance()).toBeGreaterThanOrEqual(c.luminance());
      }),
      { numRuns: 5 }
    );
  });

  it('contrastWith is symmetric, exactly 1 against itself, and within [1, 21]', () => {
    fc.assert(
      fc.property(colorArb, colorArb, (a, b) => {
        expect(a.contrastWith(b)).toBe(b.contrastWith(a));
        expect(a.contrastWith(a)).toBe(1);
        const ratio = a.contrastWith(b);
        expect(ratio >= 1 && ratio <= 21 + 1e-9).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('isLight is exactly the negation of isDark, split at luminance 0.5', () => {
    fc.assert(
      fc.property(colorArb, (c) => {
        expect(c.isLight()).toBe(!c.isDark());
        expect(c.isLight()).toBe(c.luminance() > 0.5);
      }),
      { numRuns: 5 }
    );
  });
});

describe('Property: equality', () => {
  it('equals holds iff all four components are equal; clone is equal but distinct', () => {
    fc.assert(
      fc.property(colorArb, colorArb, (a, b) => {
        expect(a.equals(b)).toBe(a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a);
        const copy = a.clone();
        expect(copy).not.toBe(a);
        expect(copy.equals(a)).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('approximatelyEquals(o, tol) is the per-channel tolerance test (alpha scaled by 1/255)', () => {
    fc.assert(
      fc.property(colorArb, colorArb, fc.integer({ min: 0, max: 255 }), (a, b, tol) => {
        const expected =
          Math.abs(a.r - b.r) <= tol &&
          Math.abs(a.g - b.g) <= tol &&
          Math.abs(a.b - b.b) <= tol &&
          Math.abs(a.a - b.a) <= tol / 255;
        expect(a.approximatelyEquals(b, tol)).toBe(expected);
        expect(a.approximatelyEquals(a, 0)).toBe(true);
      }),
      { numRuns: 5 }
    );
  });
});

// ==================== SIBLING FUNCTIONS ====================

describe('Property: legacy helpers agree with the Color methods', () => {
  it('utils re-exports the same implementations (one hex parser)', () => {
    expect(utils.hexToRgb).toBe(hexToRgb);
    expect(utils.rgbToHex).toBe(rgbToHex);
    expect(utils.lightenColor).toBe(lightenColor);
    expect(utils.darkenColor).toBe(darkenColor);
  });

  it('hexToRgb(s) is Color.fromHex(s)?.rgb for every string, valid or not', () => {
    fc.assert(
      fc.property(fc.oneof(validHex, nearValidHex, hexishString), (s) => {
        const c = Color.fromHex(s);
        expect(hexToRgb(s)).toEqual(c ? c.rgb : null);
      }),
      { numRuns: 5, examples: [['invalid']] }
    );
  });

  it('rgbToHex(r, g, b) is new Color(r, g, b).toHex() for any numbers', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true }), fc.double({ noNaN: true }), fc.double({ noNaN: true }), (r, g, b) => {
        expect(rgbToHex(r, g, b)).toBe(new Color(r, g, b).toHex());
      }),
      { numRuns: 5 }
    );
  });

  it('lightenColor/darkenColor equal the Color methods on valid hex and echo invalid input', () => {
    fc.assert(
      fc.property(fc.oneof(validHex, hexishString), unit, (hex, t) => {
        const c = Color.fromHex(hex);
        expect(lightenColor(hex, t)).toBe(c ? c.lighten(t).toHex() : hex);
        expect(darkenColor(hex, t)).toBe(c ? c.darken(t).toHex() : hex);
      }),
      { numRuns: 5 }
    );
  });

  it('fromRGB(rgb, a) equals the constructor', () => {
    fc.assert(
      fc.property(colorArb, (c) => {
        expect(Color.fromRGB(c.rgb, c.a).equals(c)).toBe(true);
      }),
      { numRuns: 5 }
    );
  });
});
