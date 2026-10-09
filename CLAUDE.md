# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build      # Build ESM, CJS, and IIFE bundles with tsup
npm run dev        # Watch mode for development
npm run typecheck  # Type check without emitting
npm test           # Vitest in watch mode
npm run test:run   # Run the test suite once
npm run test:coverage  # Test suite once with v8 coverage
npm run verify     # typecheck + tests + build + dist syntax gate (pre-publish)
npm run check:dist # es-check: dist bundles parse at the documented ES2018 level (needs a build)
npm run test:e2e   # Build, then real-pixel + canvas-contract tests in Chromium (needs `npx playwright install chromium`)
npm run test:visual    # Playwright visual project only (uses the existing dist build)
npm run test:contract  # Playwright canvas-contract project only
npm run test:probes    # Apply each defect-reintroduction probe and require the suite to kill it (~2 min)
npm run test:mutation       # Stryker mutation testing over all of src/ (slow; on demand)
npm run test:mutation:core  # Stryker mutation testing on the core boundary files (slow; not part of verify)
npm run clean      # Remove dist directory
```

Testing conventions and the boundary-coverage approach are documented in
`TESTING.md` — read it before adding or modifying tests.

## Architecture

This is a TypeScript canvas animation library that renders an animated garden with multiple plant types. The library is published as an npm package with ESM, CJS, and IIFE (CDN) formats.

### Core Components

- **`src/Garden.ts`** - Main `Garten` class implementing `GardenController`. Manages animation loop, playback state (idle/playing/paused/complete), and coordinates between renderer and plant generation.

- **`src/Renderer.ts`** - Canvas rendering layer. Handles canvas setup, pixel ratio, ResizeObserver, and delegates plant drawing to renderers.

- **`src/plants/generator.ts`** - Plant generation logic. Creates `PlantData` objects distributed across generations with randomized properties.

- **`src/plants/renderers.ts`** - Drawing functions for 147 plant types across 19 categories. Uses category-based dispatch with parametric variations for efficiency.

- **`src/types.ts`** - All TypeScript interfaces and types including `GardenOptions`, `PlantData`, `GardenController`.

- **`src/defaults.ts`** - Default option values and `resolveOptions()` function that normalizes user input.

- **`src/palettes.ts`** - Color palette definitions (natural, warm, cool, grayscale, vibrant, monotone) for flowers and foliage. For color manipulation, see `Color.ts`.

- **`src/utils.ts`** - Utility functions and re-exports from `SeededRandom.ts` (`createRandom`, `seededRandom`).

- **`src/Color.ts`** - Color manipulation value object (`fromHex`, `lighten`, `darken`, `mix`, etc.). The single hex-parsing implementation; `utils.ts` re-exports it.

- **`src/Vec2.ts`** - 2D vector value object for spatial calculations.

- **`src/GrowthProgress.ts`** - Growth phase calculation value object (stem, leaf, flower progress).

- **`src/GrowthProgressPool.ts`** - Object pool for zero-allocation growth calculations during rendering.

- **`src/SeededRandom.ts`** - Seeded pseudo-random number generator (splitmix32-style integer hash; deterministic across JS engines).

- **`src/CanvasHelper.ts`** - Fluent API for canvas drawing operations. Also hosts the single canonical `drawStem`/`drawLeaf` implementations used by all plant renderers (re-exported from `plants/renderers.ts`).

- **`src/EventEmitter.ts`** - Type-safe event emitter. Wired into `Garten`, which exposes `on()/once()/off()` and emits all `GardenEventType` events alongside the legacy `options.events` callbacks.

- **`src/Environment.ts`** - Browser capability detection (`prefersReducedMotion`, `getPixelRatio`, etc.).

- **`src/constants.ts`** - Centralized constants and magic numbers (timing, sizing, variation defaults).

- **`src/plants/variations.ts`** - Plant variation parameter definitions. Sparse `variationOverrides` map merged with defaults.

- **`src/plants/index.ts`** - Re-exports from the `plants/` modules (generator, renderers, variations).

- **`src/presets.ts`** - Built-in `themes` and `presets`, plus `applyTheme`, `applyPreset`, `createConfig`, `createTheme`, `createPreset` and the name getters.

- **`src/index.ts`** - Public entry point. Defines everything the package exports.

- **`src/test-ambient.d.ts`** - Test-only ambient declarations for the `node:fs`/`node:path` builtins the doc-sync tests use (the project omits `@types/node`).

### Animation Flow

1. Constructor resolves options and generates all plants upfront via `generatePlants()`
2. Each plant has a `generation` (0 to N-1), `delay`, and `growDuration`
3. Animation loop in `tick()` calculates elapsed time and passes it to `Renderer.render()`
4. Renderer calculates each plant's growth progress based on timing and calls appropriate plant renderer
5. Plants grow from stems first, then bloom with flowers/petals

### Key Design Patterns

- Options use a `ResolvedOptions` pattern - user-facing `GardenOptions` with optional fields are normalized to `ResolvedOptions` with all required fields
- Plant rendering is time-based: each plant's visibility/growth state is calculated from elapsed time, not stored as mutable state
- Seeded RNG (`createRandom()`) enables deterministic gardens when `seed` option is provided (integer-hash based, so results match across browsers)
- Canvas background is transparent by default; the `background` option fills a solid color
- Plants are sorted tallest-first so shorter plants draw later and stay visible in front (painter's algorithm)
- Per-plant RNG seeds are derived with non-overlapping strides (`GEN_SEED_STRIDE`/`PLANT_SEED_STRIDE` in `generator.ts`) so no two plants share a generation-time random stream. Render-time decoration RNG in `renderers.ts` (e.g. `seededRandom(seed + i * 10)`) can overlap between plants; that only affects cosmetic details

### Plant Type Architecture

147 plant types are organized into 19 categories (SimpleFlower, Tulip, Daisy, Wildflower, Grass, Fern, Bush, Rose, Lily, Orchid, Succulent, Herb, Specialty, TallFlower, GiantGrass, Climber, SmallTree, Tropical, Conifer). Each category shares a base renderer with parametric variations controlling size, height, petal count, thickness, and lean. This design minimizes code duplication while maintaining visual diversity.

### Timing Curve System

The `timingCurve` option controls how generations are spread over the duration. The fraction of generations that have started by time `t` follows the named easing curve (the same meaning as `GrowthProgress.eased`). `applyTimingCurve()` in `utils.ts` therefore returns the curve's inverse applied to `g/N`, which is generation `g`'s start time as a fraction of the duration:

- `'linear'` (default): Even pacing; start = `g/N`
- `'ease-out'`: Fast start, generations arrive quickly and then slow down; start = `1 - (1 - g/N)^(1/2)` (ease-out of power 2)
- `'ease-in'`: Slow start, speeding up; start = `(g/N)^0.5` (ease-in of power 2)
- `'ease-in-out'`: Slow start and end, fast middle; start = inverse of `eased('ease-in-out')`: `sqrt(x/2)` for `x <= 0.5`, mirrored (`1 - sqrt((1-x)/2)`) above
- `number` `e` (clamped to 0.1-10): `e > 1` is ease-out of power `e` (start = `1 - (1 - g/N)^(1/e)`); `e < 1` is ease-in of power `1/e` (start = `(g/N)^e`)

`generationComplete` fires from the plants' actual end times (`getGenerationEndTimes()` in `generator.ts`), so it follows the curve too.

### Performance Optimizations

- Category-based rendering with O(1) lookup via local `categoryRenderers` Record in `src/plants/renderers.ts`
- `variationOverrides` Map (in `src/plants/variations.ts`) built at module load for instant variation lookup
- `plantTypeToCategory` Map for O(1) type-to-category resolution
