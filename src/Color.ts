/**
 * Color Value Object - Encapsulates color operations and manipulation
 * Provides immutable color representation with utility methods
 */

/**
 * RGB color components
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * HSL color components
 */
export interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Color value object with comprehensive color manipulation utilities
 * Immutable - all operations return new Color instances
 */
export class Color {
  private readonly _r: number;
  private readonly _g: number;
  private readonly _b: number;
  private readonly _a: number;
  private _hexCache: string | null = null;

  /**
   * Create a Color from RGB values
   * @param r Red component (0-255)
   * @param g Green component (0-255)
   * @param b Blue component (0-255)
   * @param a Alpha component (0-1), defaults to 1
   */
  constructor(r: number, g: number, b: number, a: number = 1) {
    this._r = Math.round(Math.max(0, Math.min(255, r)));
    this._g = Math.round(Math.max(0, Math.min(255, g)));
    this._b = Math.round(Math.max(0, Math.min(255, b)));
    this._a = Math.max(0, Math.min(1, a));
  }

  // ==================== GETTERS ====================

  get r(): number {
    return this._r;
  }

  get g(): number {
    return this._g;
  }

  get b(): number {
    return this._b;
  }

  get a(): number {
    return this._a;
  }

  get rgb(): RGB {
    return { r: this._r, g: this._g, b: this._b };
  }

  // ==================== STATIC FACTORIES ====================

  /**
   * Create a Color from a hex string
   * Supports #RGB, #RRGGBB, and #RRGGBBAA formats
   */
  static fromHex(hex: string): Color | null {
    const cleaned = hex.replace('#', '');

    let r: number, g: number, b: number, a: number = 255;

    if (cleaned.length === 3) {
      // #RGB format
      r = parseInt(cleaned[0] + cleaned[0], 16);
      g = parseInt(cleaned[1] + cleaned[1], 16);
      b = parseInt(cleaned[2] + cleaned[2], 16);
    } else if (cleaned.length === 6) {
      // #RRGGBB format
      r = parseInt(cleaned.substring(0, 2), 16);
      g = parseInt(cleaned.substring(2, 4), 16);
      b = parseInt(cleaned.substring(4, 6), 16);
    } else if (cleaned.length === 8) {
      // #RRGGBBAA format
      r = parseInt(cleaned.substring(0, 2), 16);
      g = parseInt(cleaned.substring(2, 4), 16);
      b = parseInt(cleaned.substring(4, 6), 16);
      a = parseInt(cleaned.substring(6, 8), 16);
    } else {
      return null;
    }

    if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) {
      return null;
    }

    return new Color(r, g, b, a / 255);
  }

  /**
   * Create a Color from RGB object
   */
  static fromRGB(rgb: RGB, alpha: number = 1): Color {
    return new Color(rgb.r, rgb.g, rgb.b, alpha);
  }

  /**
   * Create a Color from HSL values
   * @param h Hue (0-360)
   * @param s Saturation (0-100)
   * @param l Lightness (0-100)
   * @param a Alpha (0-1)
   */
  static fromHSL(h: number, s: number, l: number, a: number = 1): Color {
    const sNorm = s / 100;
    const lNorm = l / 100;

    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lNorm - c / 2;

    let r = 0, g = 0, b = 0;

    if (h < 60) {
      r = c; g = x; b = 0;
    } else if (h < 120) {
      r = x; g = c; b = 0;
    } else if (h < 180) {
      r = 0; g = c; b = x;
    } else if (h < 240) {
      r = 0; g = x; b = c;
    } else if (h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    return new Color(
      (r + m) * 255,
      (g + m) * 255,
      (b + m) * 255,
      a
    );
  }

  /**
   * Parse a color string (hex, rgb, rgba, hsl, hsla)
   */
  static parse(str: string): Color | null {
    str = str.trim().toLowerCase();

    // Hex format
    if (str.startsWith('#')) {
      return Color.fromHex(str);
    }

    // RGB/RGBA format
    const rgbMatch = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (rgbMatch) {
      return new Color(
        parseInt(rgbMatch[1]),
        parseInt(rgbMatch[2]),
        parseInt(rgbMatch[3]),
        rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
      );
    }

    // HSL/HSLA format
    const hslMatch = str.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*(?:,\s*([\d.]+))?\s*\)/);
    if (hslMatch) {
      return Color.fromHSL(
        parseInt(hslMatch[1]),
        parseInt(hslMatch[2]),
        parseInt(hslMatch[3]),
        hslMatch[4] ? parseFloat(hslMatch[4]) : 1
      );
    }

    return null;
  }

  // ==================== CONVERSION METHODS ====================

  /**
   * Convert to hex string (#RRGGBB or #RRGGBBAA)
   */
  toHex(includeAlpha: boolean = false): string {
    if (!includeAlpha && this._hexCache) {
      return this._hexCache;
    }

    const hex = '#' +
      this._r.toString(16).padStart(2, '0') +
      this._g.toString(16).padStart(2, '0') +
      this._b.toString(16).padStart(2, '0') +
      (includeAlpha ? Math.round(this._a * 255).toString(16).padStart(2, '0') : '');

    if (!includeAlpha) {
      this._hexCache = hex;
    }

    return hex;
  }

  /**
   * Convert to rgb() or rgba() CSS string
   */
  toRGBString(forceAlpha: boolean = false): string {
    if (this._a < 1 || forceAlpha) {
      return `rgba(${this._r}, ${this._g}, ${this._b}, ${this._a})`;
    }
    return `rgb(${this._r}, ${this._g}, ${this._b})`;
  }

  /**
   * Convert to HSL object
   */
  toHSL(): HSL {
    const r = this._r / 255;
    const g = this._g / 255;
    const b = this._b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
      return { h: 0, s: 0, l: l * 100 };
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h = 0;
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }

    return {
      h: h * 360,
      s: s * 100,
      l: l * 100,
    };
  }

  // ==================== MANIPULATION METHODS ====================

  /**
   * Lighten the color by a given amount
   * @param amount Amount to lighten (0-1)
   */
  lighten(amount: number): Color {
    return new Color(
      this._r + (255 - this._r) * amount,
      this._g + (255 - this._g) * amount,
      this._b + (255 - this._b) * amount,
      this._a
    );
  }

  /**
   * Darken the color by a given amount
   * @param amount Amount to darken (0-1)
   */
  darken(amount: number): Color {
    return new Color(
      this._r * (1 - amount),
      this._g * (1 - amount),
      this._b * (1 - amount),
      this._a
    );
  }

  /**
   * Set the alpha value
   * @param alpha New alpha value (0-1)
   */
  withAlpha(alpha: number): Color {
    return new Color(this._r, this._g, this._b, alpha);
  }

  /**
   * Mix with another color
   * @param other The color to mix with
   * @param amount Mix ratio (0 = this, 1 = other)
   */
  mix(other: Color, amount: number = 0.5): Color {
    const t = Math.max(0, Math.min(1, amount));
    return new Color(
      this._r + (other._r - this._r) * t,
      this._g + (other._g - this._g) * t,
      this._b + (other._b - this._b) * t,
      this._a + (other._a - this._a) * t
    );
  }

  /**
   * Get the complementary color
   */
  complement(): Color {
    return new Color(255 - this._r, 255 - this._g, 255 - this._b, this._a);
  }

  /**
   * Saturate the color
   * @param amount Amount to saturate (0-1)
   */
  saturate(amount: number): Color {
    const hsl = this.toHSL();
    hsl.s = Math.min(100, hsl.s + amount * 100);
    return Color.fromHSL(hsl.h, hsl.s, hsl.l, this._a);
  }

  /**
   * Desaturate the color
   * @param amount Amount to desaturate (0-1)
   */
  desaturate(amount: number): Color {
    const hsl = this.toHSL();
    hsl.s = Math.max(0, hsl.s - amount * 100);
    return Color.fromHSL(hsl.h, hsl.s, hsl.l, this._a);
  }

  /**
   * Rotate the hue
   * @param degrees Degrees to rotate
   */
  rotateHue(degrees: number): Color {
    const hsl = this.toHSL();
    hsl.h = (hsl.h + degrees) % 360;
    if (hsl.h < 0) hsl.h += 360;
    return Color.fromHSL(hsl.h, hsl.s, hsl.l, this._a);
  }

  /**
   * Get the perceived luminance (for contrast calculations)
   * Uses the WCAG formula
   */
  luminance(): number {
    const rsRGB = this._r / 255;
    const gsRGB = this._g / 255;
    const bsRGB = this._b / 255;

    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Calculate contrast ratio with another color
   * Returns a value between 1 (no contrast) and 21 (maximum contrast)
   */
  contrastWith(other: Color): number {
    const l1 = this.luminance();
    const l2 = other.luminance();
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Determine if the color is light
   */
  isLight(): boolean {
    return this.luminance() > 0.5;
  }

  /**
   * Determine if the color is dark
   */
  isDark(): boolean {
    return this.luminance() <= 0.5;
  }

  // ==================== COMPARISON METHODS ====================

  /**
   * Check if this color equals another
   */
  equals(other: Color): boolean {
    return (
      this._r === other._r &&
      this._g === other._g &&
      this._b === other._b &&
      this._a === other._a
    );
  }

  /**
   * Get a string representation
   */
  toString(): string {
    return this.toHex(this._a < 1);
  }

  // ==================== STATIC COLOR CONSTANTS ====================

  static readonly WHITE = new Color(255, 255, 255);
  static readonly BLACK = new Color(0, 0, 0);
  static readonly TRANSPARENT = new Color(0, 0, 0, 0);
  static readonly RED = new Color(255, 0, 0);
  static readonly GREEN = new Color(0, 255, 0);
  static readonly BLUE = new Color(0, 0, 255);
}

/**
 * Utility function for backward compatibility with existing code
 * Parses hex to RGB
 */
export function hexToRgb(hex: string): RGB | null {
  const color = Color.fromHex(hex);
  return color ? color.rgb : null;
}

/**
 * Utility function for backward compatibility
 * Converts RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return new Color(r, g, b).toHex();
}

/**
 * Utility function for backward compatibility
 * Lightens a hex color
 */
export function lightenColor(hex: string, amount: number): string {
  const color = Color.fromHex(hex);
  if (!color) return hex;
  return color.lighten(amount).toHex();
}

/**
 * Utility function for backward compatibility
 * Darkens a hex color
 */
export function darkenColor(hex: string, amount: number): string {
  const color = Color.fromHex(hex);
  if (!color) return hex;
  return color.darken(amount).toHex();
}
