# Garten

An animated canvas garden that grows over time. Add a living, breathing background to any webpage with zero dependencies.

## What it does

Garten renders an animated garden of flowers, grasses, and foliage that gradually fills the bottom of a container. Plants grow in waves called "generations" — each wave adds new plants that sprout, grow stems, and bloom with flowers. The animation runs for a configurable duration (default 10 minutes) and can loop continuously.

**147 plant types** across 19 categories: simple flowers, tulips, daisies, wildflowers, grasses, ferns, bushes, roses, lilies, orchids, succulents, herbs, specialty flowers, tall flowers (hollyhocks, delphiniums, foxgloves), giant grasses (bamboo, miscanthus), climbers (wisteria, clematis), small trees (birch, willow, cherry blossom), tropical plants (palms, bird of paradise), and conifers (pine, cypress, juniper).

Take a look at an interactive demo: https://adewale.github.io/garten/

![Garten interactive demo showing plant categories, scene presets, and configuration options](assets/demo-screenshot.png)

## Install

```bash
npm install garten
```

Or use the CDN:

```html
<script src="https://unpkg.com/garten/dist/index.global.js"></script>
```

## Quick Start

```typescript
import { Garten } from 'garten';

const garden = new Garten({
  container: '#my-container'
});
```

That's it. The garden starts growing automatically.

## Full Example

```typescript
import { Garten } from 'garten';

const garden = new Garten({
  container: '#garden',

  // Timing
  duration: 300,           // 5 minutes total
  generations: 30,         // 30 waves of growth
  speed: 1,                // Playback speed (2 = double speed)
  timingCurve: 'ease-out', // Fast start, slow finish

  // Appearance
  maxHeight: 0.4,          // Plants fill bottom 40% of container
  density: 'dense',        // 'sparse' | 'normal' | 'dense' | 'lush'

  // Colors
  colors: {
    accent: '#F6821F',     // Cloudflare orange (default)
    palette: 'natural',    // 'natural' | 'warm' | 'cool' | 'vibrant' | 'grayscale' | 'monotone'
    accentWeight: 0.4,     // 40% of flowers use accent color
  },

  // Behavior
  autoplay: true,
  loop: false,
  seed: 12345,             // Deterministic garden (omit for random)

  // Callbacks
  events: {
    onProgress: (progress) => console.log(`${(progress * 100).toFixed(0)}%`),
    onComplete: () => console.log('Garden complete'),
  }
});
```

## API

### Constructor Options

Only `container` is required. Everything else has sensible defaults.

**Required:**

| Option | Type | Description |
|--------|------|-------------|
| `container` | `string \| HTMLElement` | CSS selector or element |

**Common options** you might want to customize:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `duration` | `number` | `600` | Total animation time in seconds (10 min) |
| `maxHeight` | `number` | `0.35` | Max plant (stem) height as a fraction of container height (0.05-1). Higher values unlock taller categories (see below) |
| `density` | `'sparse'` \| `'normal'` \| `'dense'` \| `'lush'` | `'normal'` | How many plants |
| `colors.accent` | `string` | `'#F6821F'` | Primary accent color (hex) |
| `colors.palette` | `'natural'` \| `'warm'` \| `'cool'` \| `'vibrant'` \| `'grayscale'` \| `'monotone'` | `'natural'` | Color palette |
| `categories` | `string[]` | all | Filter to specific plant categories (e.g., `['rose', 'tulip']`; case-insensitive) |
| `speed` | `number` | `1` | Playback speed multiplier |
| `loop` | `boolean` | `false` | Restart when complete |
| `seed` | `number` | random | Fixed seed for reproducible gardens (wrapped into [0, 1e9)) |

<details>
<summary><strong>All options</strong> (click to expand)</summary>

**Timing:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `duration` | `number` | `600` | Total animation time in seconds |
| `generations` | `number` | `47` | Number of plant waves |
| `speed` | `number` | `1` | Playback speed multiplier |
| `timingCurve` | `string \| number` | `'linear'` | `'linear'` \| `'ease-out'` \| `'ease-in'` \| `'ease-in-out'` \| custom exponent |
| `autoplay` | `boolean` | `true` | Start automatically |
| `loop` | `boolean` | `false` | Restart when complete |

**Appearance:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxHeight` | `number` | `0.35` | Max plant (stem) height as a fraction of container height (0.05-1). Higher values unlock taller categories (see below) |
| `density` | `string` | `'normal'` | `'sparse'` \| `'normal'` \| `'dense'` \| `'lush'` |
| `categories` | `string[]` | all | Filter to specific plant categories (case-insensitive; unknown names are ignored, with a warning outside production) |
| `colors` | `object` | — | Color configuration (sub-options below) |
| `colors.accent` | `string` | `'#F6821F'` | Primary accent color |
| `colors.palette` | `string` | `'natural'` | Color palette preset |
| `colors.accentWeight` | `number` | `0.4` | Fraction of plants using accent color (0-1) |
| `colors.flowerColors` | `string[]` | `[]` | Custom flower colors (overrides palette) |
| `colors.foliageColors` | `string[]` | `[]` | Custom leaf/stem colors (overrides palette) |
| `background` | `string` | `'transparent'` | Canvas background. Any CSS color, or `'transparent'` to let the page show through (works on dark pages) |
| `opacity` | `number` | `1` | Global opacity (0-1) |
| `zIndex` | `number` | `-1` | CSS z-index for canvas |
| `fadeHeight` | `number` | `0` | Height of the fade zone as a fraction of container height (0-1), measured down from the `maxHeight` line |
| `fadeColor` | `string` | `'#ffffff'` | Hex, named, `rgb()`/`rgba()` or `hsl()`/`hsla()` color the plants blend into at the top of the fade zone; `'transparent'` fades plants out instead |

**Performance:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `targetFPS` | `number` | `30` | Frame rate limit |
| `maxPixelRatio` | `number` | `2` | Device pixel ratio limit |
| `respectReducedMotion` | `boolean` | `true` | Honor `prefers-reduced-motion` |

**Determinism:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `seed` | `number` | random | RNG seed for reproducible gardens |

The generator uses integer hashing (no floating-point transcendentals), so
the same seed produces the same garden in every browser and JS engine.
Seeds are wrapped modulo 1e9 into [0, 1e9), so negative seeds work, and
seeds that differ by a multiple of 1e9 (for example `-1` and `999999999`)
produce the same garden. A missing or non-finite seed gets a random one.

**Height and categories:** `maxHeight` caps each plant's stem height (after
its type's height multiplier); flower heads, spikes and plumes can still rise
somewhat above that line. Each
category has a natural height range and appears only when `maxHeight` is at
least the bottom of that range: tall flowers at 0.30 (so the default 0.35
includes them), giant grasses at 0.40, climbers and tropical plants at 0.50,
conifers at 0.55, small trees at 0.60. Higher values also give tall
categories more weight.

**Fade:** with `fadeHeight > 0`, the top `fadeHeight` of the plant area
(measured down from the `maxHeight` line) blends plants into `fadeColor`:
fully `fadeColor` at the `maxHeight` line, no effect at the bottom of the
zone. Only drawn pixels are tinted, so a transparent canvas stays
transparent. `fadeColor` accepts hex, named, `rgb()`/`rgba()` and
`hsl()`/`hsla()` colors. Wide-gamut `color()`, `lab()` and `oklch()` syntax
is not supported. A fully transparent color such as `'transparent'` fades
plants out to transparent instead, which works best with the default
transparent background. An unparseable `fadeColor` logs one warning and
disables the fade.

**Accessibility:** when `respectReducedMotion` is enabled (the default) and the
user prefers reduced motion, the garden renders fully grown as a static image.
An explicit `play()` call still animates — a direct user action is treated as
consent to motion.

</details>

### Methods

```typescript
garden.play()              // Start, or resume from pause()/seek() position
garden.pause()             // Pause animation
garden.stop()              // Stop and reset to beginning
garden.seek(seconds)       // Jump to specific time (then play() resumes there)
garden.setSpeed(2)         // Change playback speed (positive finite, clamped to 0.01-100)
garden.setOptions({...})   // Update options (regenerates plants if needed)
garden.regenerate()        // Rebuild plants from current options (same seed, same garden)
garden.destroy()           // Clean up and remove canvas (all later calls are no-ops)
```

Note: `container` cannot be changed via `setOptions()` — destroy the instance
and create a new one instead. For a different garden, pass a new seed:
`garden.setOptions({ seed: Math.floor(Math.random() * 1e9) })`.

### Getters

```typescript
garden.getState()          // 'idle' | 'playing' | 'paused' | 'complete'
garden.getProgress()       // 0 to 1
garden.getElapsedTime()    // Seconds elapsed
```

### Events

Two ways to observe the garden. The `events` option takes four constructor
callbacks:

```typescript
events: {
  onStateChange: (state: PlaybackState) => void,
  onProgress: (progress: number, elapsed: number) => void,
  onGenerationComplete: (generation: number, total: number) => void,
  onComplete: () => void,
}
```

`on()`/`once()`/`off()` subscribe and unsubscribe at any time and cover
nine events, a superset of the four callbacks:

```typescript
const off = garden.on('generationComplete', ({ generation, totalGenerations }) => {
  console.log(`${generation}/${totalGenerations}`);
});
garden.once('complete', () => console.log('done'));
garden.on('stateChange', ({ state }) => console.log(state));
off(); // unsubscribe

// Available events: 'play' | 'pause' | 'stop' | 'complete' | 'progress'
//   | 'generationComplete' | 'stateChange' | 'regenerate' | 'optionsChange'
```

`generationComplete` (and `onGenerationComplete`) for generation `g` fires
once every plant in generations 1 to `g` has finished growing, so it follows
the timing curve and never fires while that generation is still growing. It
fires once per generation, in order, even when several generations finish
between frames (e.g. a background tab catching up); the last one fires at
the end of the duration. `seek()` does not fire events for the boundaries it
jumps across.

### Cleanup (Important for SPAs)

Always call `destroy()` when removing the garden from the DOM to prevent memory leaks:

```typescript
// React
useEffect(() => {
  const garden = new Garten({ container: containerRef.current });
  return () => garden.destroy();
}, []);

// Vue
onUnmounted(() => garden.destroy());

// Vanilla JS (page navigation)
window.addEventListener('beforeunload', () => garden.destroy());
```

## Timing Curves

Control how generations are paced. The curve describes the fraction of
generations that have started by each point in the animation:

| Curve | Effect |
|-------|--------|
| `'linear'` | Even pacing throughout |
| `'ease-out'` | Fast start: new generations arrive quickly at first, then slow down toward the end |
| `'ease-in'` | Slow start, speeding up toward the end |
| `'ease-in-out'` | Slow start and end, fast middle |
| `2.5` | Custom exponent `e`: >1 = ease-out of power `e`, <1 = ease-in of power `1/e` (clamped to 0.1-10) |

## Presets

Pre-configured garden setups for common use cases:

```typescript
import { applyPreset, Garten } from 'garten';

const garden = new Garten({
  container: '#garden',
  ...applyPreset('forest'),
});
```

| Preset | Description |
|--------|-------------|
| `default` | Balanced garden with moderate density |
| `demo` | Fast 30-second animation for demos |
| `subtle` | Sparse, semi-transparent website background |
| `lush` | Lush density, 60 generations, plants up to 45% of the height (sets no colors) |
| `forest` | Tall plants: trees, climbers, giant grasses |
| `meadow` | Low wildflower meadow with grasses |
| `roseGarden` | Elegant rose-focused garden |
| `tropical` | Palms and exotic flowers |
| `herbs` | Fragrant herb garden |
| `succulent` | Low-maintenance succulents |
| `ambient` | 1-hour looping background animation |
| `performance` | Optimized for lower-end devices |

## Themes

Visual styling presets that control colors:

```typescript
import { applyTheme, Garten } from 'garten';

const garden = new Garten({
  container: '#garden',
  ...applyTheme('sakura'),
});
```

| Theme | Description |
|-------|-------------|
| `natural` | Balanced, realistic colors (default) |
| `sunset` | Warm oranges, reds, yellows |
| `ocean` | Cool blues and greens |
| `grayscale` | White and gray flowers, gray foliage |
| `vibrant` | High-saturation colors |
| `sakura` | Cherry blossom pinks |
| `lavender` | Purple lavender field |
| `autumn` | Warm earth tones |
| `midnight` | Deep, cool night colors |
| `tropical` | Bright tropical colors |
| `zen` | Minimalist, muted tones |

### Combining Presets and Themes

```typescript
import { createConfig, Garten } from 'garten';

// Forest preset with autumn theme
const garden = new Garten({
  container: '#garden',
  ...createConfig('forest', 'autumn'),
});
```

## CSS Setup

The canvas is positioned absolutely. Your container needs positioning:

```css
#garden {
  position: relative;  /* or fixed/absolute */
  height: 400px;       /* needs explicit height */
}
```

For a full-page background:

```css
#garden {
  position: fixed;
  inset: 0;
  z-index: -1;
}
```

## CDN Usage

```html
<div id="garden" style="position: fixed; inset: 0; z-index: -1;"></div>
<script src="https://unpkg.com/garten/dist/index.global.js"></script>
<script>
  new Garten.Garten({ container: '#garden' });
</script>
```

## TypeScript

```typescript
// Core types
import type {
  GardenOptions,
  GardenController,
  GardenEvents,
  PlaybackState,
  ColorOptions,
  ColorPalette,
  Density,
  TimingCurve,
} from 'garten';

// Preset and theme types
import type { GardenPreset, GardenTheme } from 'garten';

// Enums
import { PlantType, PlantCategory } from 'garten';

// Helper functions
import {
  applyPreset,
  applyTheme,
  createConfig,
  getPresetNames,
  getThemeNames,
  createPreset,
  createTheme,
} from 'garten';

// Constants
import { PLANT_CATEGORIES } from 'garten';
```

The package also exports lower-level utilities for advanced use: the
`themes`/`presets` records, `GARDEN_EVENT_TYPES`, RNG helpers
(`seededRandom`, `createRandom`, `SeededRandom`), palettes
(`flowerPalettes`, `foliagePalettes`), plant lookups (`getPlantCategory`,
`getPlantVariation`), value objects (`Color`, `Vec2`, `GrowthProgress`,
`GrowthProgressPool`), drawing helpers (`CanvasHelper`, `drawStem`,
`drawLeaf`), `EventEmitter`, `Environment` detection helpers, and every
constant in `constants.ts`. See `src/index.ts` for the full list.

### Helper Functions

| Function | Description |
|----------|-------------|
| `applyPreset(name, options?)` | Apply a preset to options |
| `applyTheme(name, options?)` | Apply a theme to options |
| `createConfig(preset, theme, options?)` | Combine preset + theme |
| `getPresetNames()` | List available preset names |
| `getThemeNames()` | List available theme names |
| `createPreset(name, options, description?)` | Create custom preset |
| `createTheme(name, config)` | Create custom theme |

### Category Filtering

```typescript
import { PLANT_CATEGORIES } from 'garten';

// Filter to specific plant categories
const garden = new Garten({
  container: '#garden',
  categories: ['rose', 'tulip', 'daisy'], // string names, case-insensitive
});

// Available categories (19 total):
// 'simple-flower', 'tulip', 'daisy', 'wildflower', 'grass', 'fern',
// 'bush', 'rose', 'lily', 'orchid', 'succulent', 'herb', 'specialty',
// 'tall-flower', 'giant-grass', 'climber', 'small-tree', 'tropical', 'conifer'
```

## Browser Support

Chrome 64+, Firefox 69+, Safari 12+, Edge 79+

## License

MIT
