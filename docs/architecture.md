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
  type: PlantType;         // One of 101 plant types
  generation: number;      // Which wave (0 to N-1)

  // Position
  x: number;               // Horizontal position (0-1)
  baseY: number;           // Vertical anchor (always 0)

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
  seed: number;            // Per-plant RNG seed
}
```

### Plant Type Hierarchy

101 plant types are organized into 13 categories:

```
PlantCategory (13)              PlantType (101)
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
```

Categories enable:
1. **Weighted selection**: Common plants (grass, simple flowers) appear more often
2. **Shared rendering**: All tulips use the same draw function with variations
3. **Height ranges**: Each category has appropriate min/max heights

### PlantVariation (Parametric Differences)

Instead of 101 separate render functions, variations modify shared renderers:

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
│  Sort plants by height (shorter in front for proper layering)   │
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

3. Build weighted array:
   - 40% slots → accent variants (repeated)
   - 60% slots → base palette colors

4. Plants pick randomly from this array
   → ~40% get accent color variants
   → ~60% get palette colors
```

## Rendering Pipeline

### Animation Loop

The `Garden` class manages the animation loop:

```typescript
class Garten {
  private tick(timestamp: number): void {
    // Calculate elapsed time (accounting for speed)
    const delta = (timestamp - this.lastTimestamp) * this.speed;
    this.elapsedTime += delta / 1000;

    // Clamp to duration
    if (this.elapsedTime >= this.duration) {
      this.elapsedTime = this.duration;
      this.state = 'complete';
    }

    // Render frame
    this.renderer.render(this.plants, this.elapsedTime);

    // Continue loop
    if (this.state === 'playing') {
      requestAnimationFrame(this.tick);
    }
  }
}
```

### Per-Plant Rendering

For each plant, the renderer calculates growth progress:

```typescript
function drawPlant(ctx, plant, width, height, time) {
  // Calculate growth progress (0 to 1)
  const elapsed = time - plant.delay;
  if (elapsed < 0) return;  // Not started yet

  const growth = Math.min(1, elapsed / plant.growDuration);

  // Convert normalized coordinates to pixels
  const x = plant.x * width;
  const y = height;  // Bottom of canvas
  const plantHeight = plant.maxHeight * height;

  // Dispatch to category renderer
  const category = getPlantCategory(plant.type);
  categoryRenderers[category](ctx, plant, x, y, plantHeight, growth);
}
```

### Growth Animation

Growth progresses through phases:

```
growth:  0.0 ─────────────────────────────────────────▶ 1.0

Stem:    |═══════════════════════════════════════════|
         0%                                         100%
         (grows from 0 to full height)

Leaves:  |░░░░░|═════════════════════════════════|░░░|
              20%                               80%
              (appear and grow mid-animation)

Flower:  |░░░░░░░░░░░░░░░░|════════════════════════════|
                         40%                        100%
                         (blooms after stem mostly grown)
```

Implementation:
```typescript
// Stem grows throughout
const stemGrowth = growth;
const stemHeight = plantHeight * stemGrowth;

// Flower blooms in second half
const flowerGrowth = Math.max(0, (growth - 0.4) / 0.6);
const flowerSize = baseSize * flowerGrowth;

// Leaves appear mid-growth
const leafGrowth = Math.max(0, Math.min(1, (growth - 0.2) / 0.6));
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

Per-plant seeds enable deterministic rendering without storing random values:

```typescript
// Each plant has a unique seed
plant.seed = baseSeed + gen * 1000 + p * 100;

// During rendering, recreate the same random sequence
const rand = createRandom(plant.seed);
const wobble = rand() * 0.1;  // Same value every frame
```

### 4. Sorted Rendering

Plants are sorted by height so shorter plants render first (proper z-ordering without depth buffer):

```typescript
plants.sort((a, b) => a.maxHeight - b.maxHeight);
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
┌─────────────────────────────────────────────────────┐
│  Generation 0:                                       │
│    Plant 0: seed=12345+0*1000+0*100 = 12345         │
│    Plant 1: seed=12345+0*1000+1*100 = 12445         │
│    ...                                              │
│  Generation 1:                                       │
│    Plant 0: seed=12345+1*1000+0*100 = 13345         │
│    ...                                              │
└─────────────────────────────────────────────────────┘
```

The seeded RNG (`createRandom`) uses a mulberry32 algorithm:

```typescript
function createRandom(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

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

```typescript
events: {
  onStateChange: (state) => { },
  onProgress: (progress, elapsed) => { },
  onGenerationComplete: (gen, total) => { },
  onComplete: () => { },
}
```

## File Organization

```
src/
├── index.ts          # Public exports
├── Garden.ts         # Main class, animation loop, playback control
├── Renderer.ts       # Canvas setup, resize handling, render orchestration
├── types.ts          # All TypeScript interfaces and enums
├── defaults.ts       # Default values, option resolution, timing curves
├── colors.ts         # Color palettes, accent color system
├── utils.ts          # Seeded RNG, color manipulation, helpers
└── plants/
    ├── index.ts      # Re-exports
    ├── generator.ts  # Plant generation, category selection
    └── renderers.ts  # Drawing functions for all plant categories
```
