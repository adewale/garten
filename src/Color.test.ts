import { describe, it, expect } from 'vitest';
import { Color, hexToRgb, rgbToHex, lightenColor, darkenColor } from './Color';

describe('Color', () => {
  describe('constructor', () => {
    it('should create a color with RGB values', () => {
      const color = new Color(255, 128, 64);
      expect(color.r).toBe(255);
      expect(color.g).toBe(128);
      expect(color.b).toBe(64);
      expect(color.a).toBe(1);
    });

    it('should clamp values to valid ranges', () => {
      const color = new Color(300, -10, 128, 2);
      expect(color.r).toBe(255);
      expect(color.g).toBe(0);
      expect(color.b).toBe(128);
      expect(color.a).toBe(1);
    });

    it('should round RGB values', () => {
      const color = new Color(100.7, 50.3, 200.9);
      expect(color.r).toBe(101);
      expect(color.g).toBe(50);
      expect(color.b).toBe(201);
    });
  });

  describe('fromHex', () => {
    it('should parse 6-digit hex', () => {
      const color = Color.fromHex('#FF8040');
      expect(color).not.toBeNull();
      expect(color!.r).toBe(255);
      expect(color!.g).toBe(128);
      expect(color!.b).toBe(64);
    });

    it('should parse 3-digit hex', () => {
      const color = Color.fromHex('#F84');
      expect(color).not.toBeNull();
      expect(color!.r).toBe(255);
      expect(color!.g).toBe(136);
      expect(color!.b).toBe(68);
    });

    it('should parse 8-digit hex with alpha', () => {
      const color = Color.fromHex('#FF804080');
      expect(color).not.toBeNull();
      expect(color!.r).toBe(255);
      expect(color!.g).toBe(128);
      expect(color!.b).toBe(64);
      expect(color!.a).toBeCloseTo(0.502, 2);
    });

    it('should handle hex without #', () => {
      const color = Color.fromHex('FF8040');
      expect(color).not.toBeNull();
      expect(color!.r).toBe(255);
    });

    it('should return null for invalid hex', () => {
      expect(Color.fromHex('invalid')).toBeNull();
      expect(Color.fromHex('#GGG')).toBeNull();
    });
  });

  describe('fromHSL', () => {
    it('should create red from HSL', () => {
      const color = Color.fromHSL(0, 100, 50);
      expect(color.r).toBe(255);
      expect(color.g).toBe(0);
      expect(color.b).toBe(0);
    });

    it('should create green from HSL', () => {
      const color = Color.fromHSL(120, 100, 50);
      expect(color.r).toBe(0);
      expect(color.g).toBe(255);
      expect(color.b).toBe(0);
    });

    it('should create blue from HSL', () => {
      const color = Color.fromHSL(240, 100, 50);
      expect(color.r).toBe(0);
      expect(color.g).toBe(0);
      expect(color.b).toBe(255);
    });

    it('should handle grayscale (0 saturation)', () => {
      const color = Color.fromHSL(0, 0, 50);
      expect(color.r).toBe(128);
      expect(color.g).toBe(128);
      expect(color.b).toBe(128);
    });
  });

  describe('parse', () => {
    it('should parse hex strings', () => {
      const color = Color.parse('#FF0000');
      expect(color).not.toBeNull();
      expect(color!.r).toBe(255);
    });

    it('should parse rgb() strings', () => {
      const color = Color.parse('rgb(255, 128, 64)');
      expect(color).not.toBeNull();
      expect(color!.r).toBe(255);
      expect(color!.g).toBe(128);
      expect(color!.b).toBe(64);
    });

    it('should parse rgba() strings', () => {
      const color = Color.parse('rgba(255, 128, 64, 0.5)');
      expect(color).not.toBeNull();
      expect(color!.a).toBe(0.5);
    });

    it('should parse hsl() strings', () => {
      const color = Color.parse('hsl(0, 100, 50)');
      expect(color).not.toBeNull();
      expect(color!.r).toBe(255);
    });
  });

  describe('toHex', () => {
    it('should convert to hex string', () => {
      const color = new Color(255, 128, 64);
      expect(color.toHex()).toBe('#ff8040');
    });

    it('should include alpha when requested', () => {
      const color = new Color(255, 128, 64, 0.5);
      expect(color.toHex(true)).toBe('#ff804080');
    });
  });

  describe('toRGBString', () => {
    it('should output rgb() for opaque colors', () => {
      const color = new Color(255, 128, 64);
      expect(color.toRGBString()).toBe('rgb(255, 128, 64)');
    });

    it('should output rgba() for transparent colors', () => {
      const color = new Color(255, 128, 64, 0.5);
      expect(color.toRGBString()).toBe('rgba(255, 128, 64, 0.5)');
    });
  });

  describe('toHSL', () => {
    it('should convert red to HSL', () => {
      const color = new Color(255, 0, 0);
      const hsl = color.toHSL();
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    it('should convert gray to HSL', () => {
      const color = new Color(128, 128, 128);
      const hsl = color.toHSL();
      expect(hsl.s).toBe(0);
    });
  });

  describe('manipulation methods', () => {
    it('should lighten a color', () => {
      const color = new Color(100, 100, 100);
      const lighter = color.lighten(0.5);
      expect(lighter.r).toBeGreaterThan(100);
      expect(lighter.g).toBeGreaterThan(100);
      expect(lighter.b).toBeGreaterThan(100);
    });

    it('should darken a color', () => {
      const color = new Color(200, 200, 200);
      const darker = color.darken(0.5);
      expect(darker.r).toBeLessThan(200);
      expect(darker.g).toBeLessThan(200);
      expect(darker.b).toBeLessThan(200);
    });

    it('should set alpha', () => {
      const color = new Color(255, 0, 0);
      const transparent = color.withAlpha(0.5);
      expect(transparent.a).toBe(0.5);
      expect(transparent.r).toBe(255); // Original values preserved
    });

    it('should mix colors', () => {
      const red = new Color(255, 0, 0);
      const blue = new Color(0, 0, 255);
      const purple = red.mix(blue, 0.5);
      expect(purple.r).toBe(128);
      expect(purple.b).toBe(128);
    });

    it('should get complement', () => {
      const red = new Color(255, 0, 0);
      const complement = red.complement();
      expect(complement.r).toBe(0);
      expect(complement.g).toBe(255);
      expect(complement.b).toBe(255);
    });
  });

  describe('luminance and contrast', () => {
    it('should calculate luminance', () => {
      const white = new Color(255, 255, 255);
      const black = new Color(0, 0, 0);
      expect(white.luminance()).toBeCloseTo(1, 2);
      expect(black.luminance()).toBe(0);
    });

    it('should calculate contrast ratio', () => {
      const white = new Color(255, 255, 255);
      const black = new Color(0, 0, 0);
      expect(white.contrastWith(black)).toBeCloseTo(21, 0);
    });

    it('should detect light and dark colors', () => {
      const white = new Color(255, 255, 255);
      const black = new Color(0, 0, 0);
      expect(white.isLight()).toBe(true);
      expect(black.isDark()).toBe(true);
    });
  });

  describe('equals', () => {
    it('should return true for equal colors', () => {
      const a = new Color(255, 128, 64);
      const b = new Color(255, 128, 64);
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different colors', () => {
      const a = new Color(255, 128, 64);
      const b = new Color(255, 128, 65);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('static constants', () => {
    it('should have correct WHITE', () => {
      expect(Color.WHITE.r).toBe(255);
      expect(Color.WHITE.g).toBe(255);
      expect(Color.WHITE.b).toBe(255);
    });

    it('should have correct BLACK', () => {
      expect(Color.BLACK.r).toBe(0);
      expect(Color.BLACK.g).toBe(0);
      expect(Color.BLACK.b).toBe(0);
    });
  });
});

describe('Utility functions', () => {
  describe('hexToRgb', () => {
    it('should convert hex to RGB', () => {
      const rgb = hexToRgb('#FF8040');
      expect(rgb).toEqual({ r: 255, g: 128, b: 64 });
    });

    it('should return null for invalid hex', () => {
      expect(hexToRgb('invalid')).toBeNull();
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex', () => {
      expect(rgbToHex(255, 128, 64)).toBe('#ff8040');
    });
  });

  describe('lightenColor', () => {
    it('should lighten a hex color', () => {
      const result = lightenColor('#808080', 0.5);
      expect(result).not.toBe('#808080');
    });
  });

  describe('darkenColor', () => {
    it('should darken a hex color', () => {
      const result = darkenColor('#808080', 0.5);
      expect(result).not.toBe('#808080');
    });
  });
});
