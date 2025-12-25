import { describe, it, expect } from 'vitest';
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
  densityPreset,
  speedPreset,
} from './presets';

describe('themes', () => {
  it('should have natural theme', () => {
    expect(themes.natural).toBeDefined();
    expect(themes.natural.palette).toBe('natural');
  });

  it('should have multiple themes', () => {
    expect(Object.keys(themes).length).toBeGreaterThan(5);
  });

  it('should have required properties on all themes', () => {
    for (const [name, theme] of Object.entries(themes)) {
      expect(theme.name).toBeDefined();
      expect(theme.palette).toBeDefined();
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

  it('should have required properties on all presets', () => {
    for (const [name, preset] of Object.entries(presets)) {
      expect(preset.name).toBeDefined();
      expect(preset.options).toBeDefined();
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
    expect(options.colors).toBeDefined();
  });

  it('should accept theme object', () => {
    const customTheme = { name: 'Custom', palette: 'vibrant' as const };
    const options = applyTheme(customTheme);
    expect(options.colors!.palette).toBe('vibrant');
  });

  it('should handle unknown theme', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const options = applyTheme('unknown-theme');
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
    const options = applyPreset('unknown-preset');
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

describe('densityPreset', () => {
  it('should return options for each density level', () => {
    expect(densityPreset('sparse').density).toBe('sparse');
    expect(densityPreset('normal').density).toBe('normal');
    expect(densityPreset('dense').density).toBe('dense');
    expect(densityPreset('lush').density).toBe('lush');
  });

  it('should adjust generations with density', () => {
    const sparse = densityPreset('sparse');
    const lush = densityPreset('lush');
    expect(sparse.generations!).toBeLessThan(lush.generations!);
  });
});

describe('speedPreset', () => {
  it('should return options for each speed level', () => {
    const slow = speedPreset('slow');
    const fast = speedPreset('fast');

    expect(slow.speed).toBeLessThan(fast.speed!);
    expect(slow.duration).toBeGreaterThan(fast.duration!);
  });

  it('should have instant option', () => {
    const instant = speedPreset('instant');
    expect(instant.speed).toBeGreaterThan(5);
  });
});

// Need to import vi for vitest
import { vi } from 'vitest';
