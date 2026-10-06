import { describe, it, expect, vi } from 'vitest';
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

describe('themes', () => {
  it('should have natural theme', () => {
    expect(themes.natural).toBeDefined();
    expect(themes.natural.palette).toBe('natural');
  });

  it('should have multiple themes', () => {
    expect(Object.keys(themes).length).toBeGreaterThan(5);
  });

  it('should have a name and a known palette on all themes', () => {
    const palettes = ['natural', 'warm', 'cool', 'grayscale', 'vibrant', 'monotone'];
    for (const theme of Object.values(themes)) {
      expect(theme.name).toMatch(/\S/);
      expect(palettes).toContain(theme.palette);
    }
  });
});

describe('presets', () => {
  it('should have default preset', () => {
    expect(presets.default).toBeDefined();
    expect(presets.default.options.duration).toBe(600);
  });

  it('should have demo preset with shorter duration', () => {
    expect(presets.demo).toBeDefined();
    expect(presets.demo.options.duration).toBeLessThan(presets.default.options.duration!);
  });

  it('should have multiple presets', () => {
    expect(Object.keys(presets).length).toBeGreaterThan(5);
  });

  it('should have a name and at least one option on all presets', () => {
    for (const preset of Object.values(presets)) {
      expect(preset.name).toMatch(/\S/);
      expect(Object.keys(preset.options).length).toBeGreaterThan(0);
    }
  });
});

describe('applyTheme', () => {
  it('should apply theme colors to options', () => {
    const options = applyTheme('sunset');
    expect(options.colors).toBeDefined();
    expect(options.colors!.palette).toBe('warm');
  });

  it('should merge with existing options', () => {
    const options = applyTheme('natural', { duration: 300 });
    expect(options.duration).toBe(300);
    expect(options.colors!.palette).toBe(themes.natural.palette);
  });

  it('carries every color field the theme defines', () => {
    for (const theme of Object.values(themes)) {
      const options = applyTheme(theme);
      expect(options.colors!.palette).toBe(theme.palette);
      expect(options.colors!.accent).toBe(theme.accent);
      expect(options.colors!.flowerColors).toBe(theme.flowerColors);
      expect(options.colors!.foliageColors).toBe(theme.foliageColors);
      expect(options.fadeColor).toBe(theme.fadeColor);
    }
  });

  it('lets explicit options win over the theme, fadeColor included', () => {
    const options = applyTheme('midnight', {
      fadeColor: '#123456',
      colors: { accent: '#00FF00' },
    });
    expect(themes.midnight.fadeColor).toBeDefined();
    expect(options.fadeColor).toBe('#123456');
    expect(options.colors!.accent).toBe('#00FF00');
  });

  it('should accept theme object', () => {
    const customTheme = { name: 'Custom', palette: 'vibrant' as const };
    const options = applyTheme(customTheme);
    expect(options.colors!.palette).toBe('vibrant');
  });

  it('should handle unknown theme', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    applyTheme('unknown-theme');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('applyPreset', () => {
  it('should apply preset options', () => {
    const options = applyPreset('demo');
    expect(options.duration).toBe(30);
    expect(options.generations).toBe(10);
  });

  it('should merge with additional options', () => {
    const options = applyPreset('demo', { speed: 2 });
    expect(options.duration).toBe(30);
    expect(options.speed).toBe(2);
  });

  it('should accept preset object', () => {
    const customPreset = {
      name: 'Custom',
      options: { duration: 100 },
    };
    const options = applyPreset(customPreset);
    expect(options.duration).toBe(100);
  });

  it('should handle unknown preset', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    applyPreset('unknown-preset');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('createConfig', () => {
  it('should combine preset and theme', () => {
    const config = createConfig('demo', 'sunset');
    expect(config.duration).toBe(30); // From demo preset
    expect(config.colors!.palette).toBe('warm'); // From sunset theme
  });

  it('should allow additional overrides', () => {
    const config = createConfig('demo', 'natural', { speed: 2 });
    expect(config.speed).toBe(2);
  });
});

describe('getThemeNames', () => {
  it('should return list of theme names', () => {
    const names = getThemeNames();
    expect(names).toContain('natural');
    expect(names).toContain('sunset');
  });
});

describe('getPresetNames', () => {
  it('should return list of preset names', () => {
    const names = getPresetNames();
    expect(names).toContain('default');
    expect(names).toContain('demo');
  });
});

describe('createTheme', () => {
  it('should create custom theme object', () => {
    const theme = createTheme('MyTheme', {
      palette: 'vibrant',
      accent: '#FF0000',
    });
    expect(theme.name).toBe('MyTheme');
    expect(theme.palette).toBe('vibrant');
    expect(theme.accent).toBe('#FF0000');
  });
});

describe('createPreset', () => {
  it('should create custom preset object', () => {
    const preset = createPreset('MyPreset', { duration: 100 }, 'A fast preset');
    expect(preset.name).toBe('MyPreset');
    expect(preset.options.duration).toBe(100);
    expect(preset.description).toBe('A fast preset');
  });
});
