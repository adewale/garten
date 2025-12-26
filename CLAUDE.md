# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build      # Build ESM, CJS, and IIFE bundles with tsup
npm run dev        # Watch mode for development
npm run typecheck  # Type check without emitting
npm run clean      # Remove dist directory
```

## Architecture

This is a TypeScript canvas animation library that renders an animated garden with multiple plant types. The library is published as an npm package with ESM, CJS, and IIFE (CDN) formats.

### Core Components

- **`src/Garden.ts`** - Main `Garten` class implementing `GardenController`. Manages animation loop, playback state (idle/playing/paused/complete), and coordinates between renderer and plant generation.

- **`src/Renderer.ts`** - Canvas rendering layer. Handles canvas setup, pixel ratio, ResizeObserver, and delegates plant drawing to renderers.

- **`src/plants/generator.ts`** - Plant generation logic. Creates `PlantData` objects distributed across generations with randomized properties.

- **`src/plants/renderers.ts`** - Drawing functions for 100 plant types across 13 categories. Uses category-based dispatch with parametric variations for efficiency.

- **`src/types.ts`** - All TypeScript interfaces and types including `GardenOptions`, `PlantData`, `GardenController`.

- **`src/defaults.ts`** - Default option values and `resolveOptions()` function that normalizes user input.

- **`src/palettes.ts`** - Color palette definitions (natural, warm, cool, monochrome, vibrant) for flowers and foliage. For color manipulation, see `Color.ts`.

- **`src/utils.ts`** - Seeded random number generator and utility functions like `prefersReducedMotion()`.

### Animation Flow

1. Constructor resolves options and generates all plants upfront via `generatePlants()`
2. Each plant has a `generation` (0 to N-1), `delay`, and `growDuration`
3. Animation loop in `tick()` calculates elapsed time and passes it to `Renderer.render()`
4. Renderer calculates each plant's growth progress based on timing and calls appropriate plant renderer
5. Plants grow from stems first, then bloom with flowers/petals

### Key Design Patterns

- Options use a `ResolvedOptions` pattern - user-facing `GardenOptions` with optional fields are normalized to `ResolvedOptions` with all required fields
- Plant rendering is time-based: each plant's visibility/growth state is calculated from elapsed time, not stored as mutable state
- Seeded RNG (`createRandom()`) enables deterministic gardens when `seed` option is provided

### Plant Type Architecture

101 plant types are organized into 13 categories (SimpleFlower, Tulip, Daisy, Wildflower, Grass, Fern, Bush, Rose, Lily, Orchid, Succulent, Herb, Specialty). Each category shares a base renderer with parametric variations controlling size, height, petal count, thickness, and lean. This design minimizes code duplication while maintaining visual diversity.

### Timing Curve System

The `timingCurve` option controls how time is distributed across generations. Implemented via `applyTimingCurve()` in `defaults.ts`, it warps generation start times:

- `'linear'` (default): Equal time per generation
- `'ease-out'`: Early generations complete quickly, later ones slow down
- `'ease-in'`: Slow start, accelerating finish
- `'ease-in-out'`: Smooth S-curve (smoothstep)
- `number`: Custom exponent (>1 = ease-out, <1 = ease-in)

### Performance Optimizations

- Category-based rendering with O(1) lookup via `categoryRenderers` Record
- `plantVariations` Map built at module load for instant variation lookup
- Pre-allocated arrays in `generatePlants()` to reduce memory fragmentation
- `plantTypeToCategory` Map for O(1) type-to-category resolution
