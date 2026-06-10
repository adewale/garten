# Garten Architecture

This document explains how Garten works conceptually, from data structures to rendering.

## Overview

Garten is a **time-based canvas animation** that renders a garden of plants growing from the bottom of a container. The key architectural principle is **stateless rendering**: plants are defined as immutable data objects, and their visual appearance at any moment is derived purely from elapsed time.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Architecture                              │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Options    │───▶│  Generator   │───▶│  PlantData[] │      │
│  │  (config)    │    │              │    │  (immutable) │      │
│  └──────────────┘    └──────────────┘    └──────┬───────┘      │
│                                                  │               │
│                                                  ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Animation   │───▶│   Renderer   │───▶│    Canvas    │      │
│  │    Loop      │    │              │    │              │      │
│  │  (time)      │    │  (drawing)   │    │  (pixels)    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Stateless Rendering

Unlike traditional animation where objects update their own state each frame, Garten uses **pure functions** of time:

```
visual_state = f(plant_data, elapsed_time)
```

A plant at time=5s looks exactly the same every time you render it at time=5s. This enables:
- **Seeking**: Jump to any point instantly
- **Determinism**: Same seed = same garden
- **Simplicity**: No state synchronization bugs

### 2. Generation Waves

Plants appear in waves called "generations." Each generation is a group of plants that start growing at approximately the same time:

```
Time: 0 ────────────────────────────────────────────▶ duration

Gen 0: ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Gen 1: ░░░░████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Gen 2: ░░░░░░░░████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Gen 3: ░░░░░░░░░░░░████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
...
Gen N: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████

       ████ = plants growing
       ░░░░ = plants fully grown (or not started)
```

### 3. Timing Curves

The `timingCurve` option warps how time is distributed across generations:

```
Linear (default):         Ease-out (fast start):
Gen │                     Gen │
 N  │        ●             N  │                  ●
    │      ●                  │               ●
    │    ●                    │            ●
    │  ●                      │        ●
 0  │●                      0 │●●●●
    └──────────▶              └──────────▶
         Time                      Time
```

Implementation uses time warping:
```typescript
warpedStart = applyTimingCurve(gen, totalGens, curve);
warpedEnd = applyTimingCurve(gen + 1, totalGens, curve);
genDelay = warpedStart * duration;
genDuration = (warpedEnd - warpedStart) * duration;
```

## Data Structures

### PlantData (Immutable)

Each plant is represented by a plain object with all properties set at generation time:

```typescript
interface PlantData {
  // Identity
  id: number;              // Unique identifier
  type: PlantType;         // One of 147 plant types
  generation: number;      // Which wave (0 to N-1)

  // Position
  x: number;               // Horizontal position (0-1)

  // Sizing
  maxHeight: number;       // Target height as fraction of canvas
  scale: number;           // Size multiplier (0.7-1.2)

  // Appearance
  flowerColor: string;     // Hex color for petals
  stemColor: string;       // Hex color for stem
  leafColor: string;       // Hex color for leaves
  petals: number;          // Number of petals (5-8)
  lean: number;            // Stem curve direction (-0.15 to 0.15)

  // Timing
  delay: number;           // Seconds before growth starts
  growDuration: number;    // Seconds to fully grow

  // Determinism
  seed: number;            // Per-plant RNG seed (collision-free strides)

  // Cached for O(1) render dispatch
  category?: PlantCategory;
  variation?: PlantVariation;
}
```

### Plant Type Hierarchy

147 plant types are organized into 19 categories:

```
PlantCategory (19)              PlantType (147)
─────────────────               ───────────────
SimpleFlower ──────────────────▶ SimpleFlower, SimpleFlowerSmall, ...Large, ...Tall (10)
Tulip ─────────────────────────▶ Tulip, TulipTall, TulipDouble, TulipParrot, ... (10)
Daisy ─────────────────────────▶ Daisy, DaisySmall, DaisyGerbera, DaisyShasta, ... (10)
Wildflower ────────────────────▶ Wildflower, WildflowerMeadow, WildflowerAlpine, ... (10)
Grass ─────────────────────────▶ Grass, GrassTall, GrassPampas, GrassFountain, ... (10)
Fern ──────────────────────────▶ Fern, FernSmall, FernCurly, FernMaidenhair, ... (10)
Bush ──────────────────────────▶ Bush, BushSmall, BushFlowering, BushBerry, ... (10)
Rose ──────────────────────────▶ Rose, RoseClimbing, RoseMiniature, RoseWild, ... (5)
Lily ──────────────────────────▶ Lily, LilyTiger, LilyCalla, LilyStargazer, ... (5)
Orchid ────────────────────────▶ Orchid, OrchidMoth, OrchidDendrobium, ... (5)
Succulent ─────────────────────▶ Succulent, SucculentRosette, SucculentSpiky, ... (5)
Herb ──────────────────────────▶ Lavender, LavenderTall, Sage, Thyme, Rosemary (5)
Specialty ─────────────────────▶ Poppy, Sunflower, Iris, Peony, Hydrangea, Dahlia (6)
TallFlower ────────────────────▶ Hollyhock, Delphinium, Foxglove, Gladiolus, Lupine, ... (8)
GiantGrass ────────────────────▶ Bamboo, GiantReed, Miscanthus, Cortaderia, ... (8)
Climber ───────────────────────▶ Vine, Wisteria, Clematis, MorningGlory, ... (8)
SmallTree ─────────────────────▶ Sapling, Birch, Willow, CherryBlossom, ... (10)
Tropical ──────────────────────▶ PalmSmall, PalmFan, BirdOfParadise, Banana, ... (6)
Conifer ───────────────────────▶ Pine, PineYoung, Cypress, Juniper, ... (6)
```

Categories enable:
1. **Weighted selection**: Common plants (grass, simple flowers) appear more often
2. **Shared rendering**: All tulips use the same draw function with variations
3. **Height ranges**: Each category has appropriate min/max heights

### PlantVariation (Parametric Differences)

Instead of 147 separate render functions, variations modify shared renderers:

```typescript
interface PlantVariation {
  sizeMultiplier: number;      // Flower/head size
  heightMultiplier: number;    // Stem height
  petalCountModifier: number;  // Added to base petal count
  thicknessMultiplier: number; // Stem thickness
  leanMultiplier: number;      // How much stem curves
  complexity: number;          // Detail level (0-1)
}
```

Example: `TulipParrot` vs `TulipShort`:
```typescript
TulipParrot: { sizeMultiplier: 1.3, heightMultiplier: 0.95, complexity: 1.0 }
TulipShort:  { sizeMultiplier: 1.1, heightMultiplier: 0.7,  complexity: 0.4 }
```

## Generation Pipeline

### Step 1: Option Resolution

User options are merged with defaults to create `ResolvedOptions`:

```typescript
// User provides partial options
{ container: '#garden', duration: 300, density: 'lush' }

// Resolved to complete options
{
  container: HTMLElement,
  duration: 300,
  generations: 47,
  maxHeight: 0.35,
  density: 'lush',
  speed: 1,
  timingCurve: 'linear',
  colors: { accent: '#F6821F', palette: 'natural', accentWeight: 0.4 },
  // ... all other options with defaults
}
```

### Step 2: Plant Generation

`generatePlants()` creates all plants upfront:

```
┌─────────────────────────────────────────────────────────────────┐
│  For each generation g in [0, generations):                      │
│    │                                                            │
│    ├─▶ Calculate timing via timingCurve                         │
│    │     warpedStart = applyTimingCurve(g, total, curve)        │
│    │     genDelay = warpedStart * duration                      │
│    │                                                            │
│    ├─▶ Determine plant count (based on density)                 │
│    │     sparse: 4-6, normal: 8-13, dense: 14-20, lush: 22-30   │
│    │                                                            │
│    └─▶ For each plant p in generation:                          │
│          │                                                      │
│          ├─▶ Select category (weighted random)                  │
│          │     SimpleFlower: 15%, Grass: 12%, Orchid: 4%, ...   │
│          │                                                      │
│          ├─▶ Select type within category (uniform random)       │
│          │                                                      │
│          ├─▶ Assign position, height, colors, timing            │
│          │                                                      │
│          └─▶ Create PlantData object                            │
│                                                                 │
│  Sort plants tallest-first (shorter draw later, stay in front)  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3: Color Selection

The accent color system ensures brand colors appear prominently:

```
Input: accent=#F6821F, palette=natural, accentWeight=0.4

1. Generate accent variants:
   [#F6821F, #F89B4B, #D16E1A, #FAB478, #E07A1C]  (5 colors)

2. Get base palette:
   [#E85D75, #D64550, ..., #FAF0E6]  (16 colors)

3. Build weighted array: ALL 16 base colors are always included, plus
   accent variants repeated so that
   accentCount / (accentCount + 16) ≈ accentWeight
   (0.4 → 11 accent entries + 16 base = 27 entries)

4. Plants pick randomly from this array
   → ~40% get accent color variants
   → every documented palette color remains reachable
```

## Rendering Pipeline

### Animation Loop

The `Garden` class manages the animation loop:

```typescript
class Garten {
  private tick = (timestamp: number): void => {
    if (this.state !== 'playing') return;

    // Throttle to targetFPS
    if (timestamp - this.lastFrameTime < this.frameInterval) {
      this.animationId = requestAnimationFrame(this.tick);
      return;
    }
    this.lastFrameTime = timestamp;

    try {
      // Elapsed time derives from startTime (never delta accumulation),
      // so seek()/setSpeed() stay exact and background tabs catch up
      this.elapsedTime = (timestamp - this.startTime) * this.speed / 1000;

      // Fire one event per generation boundary crossed since last frame
      this.emitGenerationEvents();

      this.renderer.render(this.plants, Math.min(this.elapsedTime, this.duration));

      if (this.elapsedTime >= this.duration) {
        if (this.loop) { /* reset startTime and continue */ }
        else { this.state = 'complete'; /* emit 'complete' */ return; }
      }
    } catch (error) {
      // A throwing frame pauses recoverably instead of stranding 'playing'
      this.handleFrameError(error);
      return;
    }

    this.animationId = requestAnimationFrame(this.tick);
  };
}
```

### Per-Plant Rendering

For each plant, the renderer calculates growth progress:

```typescript
function drawPlant(ctx, plant, width, height, time, pool) {
  // Cached at generation time; falls back to map lookups
  const category = plant.category ?? getPlantCategory(plant.type);
  const variation = plant.variation ?? getPlantVariation(plant.type);

  // Growth phases come from a frame-scoped object pool (zero allocation);
  // each category renderer converts plant.x / plant.maxHeight to pixels
  categoryRenderers[category](ctx, plant, width, height, time, variation, pool);
}
```

### Growth Animation

Growth progresses through phases:

```
growth:  0.0 ─────────────────────────────────────────▶ 1.0

Stem:    |══════════════════════════════|░░░░░░░░░░░░░|
         0%                           ~67%
         (rate 1.5x: reaches full height at ~67% progress)

Leaves:  |░░░░░░░░░░░░|══════════════════════|░░░░░░░░|
                     30%                    80%
                     (rate 2x from LEAF_START)

Flower:  |░░░░░░░░░░░░░░░░░░░░░|═══════════════════════|
                              50%                   100%
                              (rate 2x from FLOWER_START)
```

Implementation (constants in `GROWTH_PHASES`, computed by
`MutableGrowthProgress.calculateMut` via the per-frame object pool):

```typescript
const stem   = Math.min(1, progress * 1.5);                  // STEM_GROWTH_RATE
const leaf   = Math.max(0, Math.min(1, (progress - 0.3) * 2)); // LEAF_START/RATE
const flower = Math.max(0, Math.min(1, (progress - 0.5) * 2)); // FLOWER_START/RATE
```

### Category Renderers

Each category has a specialized renderer:

```typescript
const categoryRenderers: Record<PlantCategory, RenderFunction> = {
  [PlantCategory.SimpleFlower]: drawSimpleFlower,
  [PlantCategory.Tulip]: drawTulip,
  [PlantCategory.Daisy]: drawDaisy,
  [PlantCategory.Grass]: drawGrass,
  [PlantCategory.Fern]: drawFern,
  [PlantCategory.Bush]: drawBush,
  [PlantCategory.Rose]: drawRose,
  // ... etc
};
```

Within each renderer, `PlantVariation` parameters modify the output:

```typescript
function drawTulip(ctx, plant, x, y, height, growth) {
  const variation = getVariation(plant.type);

  // Apply variation multipliers
  const actualHeight = height * variation.heightMultiplier;
  const flowerSize = baseSize * variation.sizeMultiplier;
  const stemThickness = baseThickness * variation.thicknessMultiplier;
  const petalCount = basePetals + variation.petalCountModifier;

  // Draw with modified parameters...
}
```

## Performance Optimizations

### 1. Pre-allocation

Arrays are pre-allocated to avoid repeated resizing:

```typescript
const estimatedTotal = Math.ceil(generations * avgPlantsPerGen * 1.1);
const plants: PlantData[] = [];
plants.length = estimatedTotal;  // Pre-allocate

// Fill array...

plants.length = actualCount;  // Trim to actual size
```

### 2. O(1) Lookups

Maps are built at module load time:

```typescript
// Type → Category lookup
const plantTypeToCategory: Map<PlantType, PlantCategory> = new Map();

// Type → Variation lookup
const plantVariations: Map<PlantType, PlantVariation> = new Map();

// Category → Renderer lookup
const categoryRenderers: Record<PlantCategory, RenderFunction> = { ... };
```

### 3. Seeded Random

Per-plant seeds enable deterministic rendering without storing random values.
The strides are chosen so no two plants can ever share an RNG stream — the
generation stride (100,000) exceeds the largest possible per-plant offset,
and the per-generation count RNG sits at +50,000, clear of all plant streams
(an invariant pinned by `src/constants.test.ts`):

```typescript
// GEN_SEED_STRIDE = 100_000, PLANT_SEED_STRIDE = 137
plant.seed = baseSeed + gen * 100_000 + p * 137;

// During rendering, recreate the same random sequence
const rand = createRandom(plant.seed);
const wobble = rand() * 0.1;  // Same value every frame
```

### 4. Sorted Rendering

Plants are sorted tallest-first, so shorter plants draw later and stay
visible in the foreground (painter's algorithm — no depth buffer needed):

```typescript
plants.sort((a, b) => b.maxHeight - a.maxHeight);
```

### 5. Frame Rate Limiting

Canvas updates are limited to target FPS to reduce CPU usage:

```typescript
const frameInterval = 1000 / targetFPS;
if (timestamp - lastFrame < frameInterval) {
  requestAnimationFrame(tick);
  return;
}
```

## Determinism

Given the same `seed` option, the garden is fully reproducible:

```
seed: 12345
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  Generation 0:                                            │
│    Plant 0: seed = 12345 + 0*100000 + 0*137 = 12345      │
│    Plant 1: seed = 12345 + 0*100000 + 1*137 = 12482      │
│    ...                                                    │
│  Generation 1:                                            │
│    Plant 0: seed = 12345 + 1*100000 + 0*137 = 112345     │
│    ...                                                    │
└──────────────────────────────────────────────────────────┘
```

`seededRandom` hashes each seed value with a splitmix32-style integer
avalanche; `createRandom` wraps it with an incrementing seed. Because the
hash uses only exactly-specified integer/IEEE-754 operations (no
`Math.sin`), the same seed produces the same garden in every JavaScript
engine:

```typescript
function hashSeed(seed: number): number {
  const i = Math.floor(seed);
  const f = seed - i;
  let h = (i >>> 0) ^ Math.imul(Math.floor(f * 0x40000000), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return ((h ^ (h >>> 15)) >>> 0) / 0x100000000;
}
```

Cross-page-load determinism is verified at the pixel level: the Playwright
visual suite asserts byte-identical bitmaps for the same seed.

## Public API Surface

### Constructor

```typescript
const garden = new Garten(options: GardenOptions);
```

### Playback Control

```typescript
garden.play()           // Start or resume
garden.pause()          // Pause at current position
garden.stop()           // Reset to beginning
garden.seek(seconds)    // Jump to specific time
garden.setSpeed(n)      // Change playback speed
```

### State Inspection

```typescript
garden.getState()       // 'idle' | 'playing' | 'paused' | 'complete'
garden.getProgress()    // 0 to 1
garden.getElapsedTime() // Seconds
```

### Dynamic Updates

```typescript
garden.setOptions({...})  // Update options (may regenerate plants)
garden.regenerate()       // Force new random garden
garden.destroy()          // Clean up and remove canvas
```

### Events

Constructor callbacks and a subscription API are equivalent; both are fed by
the same lifecycle points (`generationComplete` fires once per boundary, in
order, even when several elapse in one frame):

```typescript
events: {
  onStateChange: (state) => { },
  onProgress: (progress, elapsed) => { },
  onGenerationComplete: (gen, total) => { },
  onComplete: () => { },
}

const off = garden.on('generationComplete', ({ generation }) => { });
garden.once('complete', () => { });
off();
// 'play' | 'pause' | 'stop' | 'complete' | 'progress'
// | 'generationComplete' | 'stateChange' | 'regenerate' | 'optionsChange'
```

## File Organization

```
src/
├── index.ts              # Public exports
├── Garden.ts             # Main class, animation loop, events, playback
├── Renderer.ts           # Canvas setup, background, resize-with-repaint
├── types.ts              # Interfaces, enums, GARDEN_EVENT_TYPES
├── defaults.ts           # Option resolution: sanitize, clamp, validate
├── constants.ts          # Centralized constants and bounds
├── palettes.ts           # Color palettes, accent weighting
├── presets.ts            # Themes, presets, createConfig
├── utils.ts              # omitUndefined, timing curves, re-exports
├── Color.ts              # Color value object (single hex implementation)
├── Vec2.ts               # 2D vector value object
├── SeededRandom.ts       # splitmix32-style hash PRNG
├── GrowthProgress.ts     # Growth phase value object
├── GrowthProgressPool.ts # Frame-scoped object pool
├── CanvasHelper.ts       # Canonical drawStem/drawLeaf + fluent helper
├── EventEmitter.ts       # Type-safe emitter behind garden.on/once/off
├── Environment.ts        # Browser capability detection
└── plants/
    ├── index.ts          # Re-exports
    ├── generator.ts      # Plant generation, seed strides, sorting
    ├── variations.ts     # Sparse per-type variation overrides
    └── renderers.ts      # Category renderers for all plant types
```

## Canvas Background

The canvas is transparent by default (`clearRect` each frame), so the page
shows through — the `background` option fills a solid color instead. Resize
wipes a canvas bitmap by spec, so the renderer retains the last
`(plants, time)` and repaints after every (debounced) resize.
