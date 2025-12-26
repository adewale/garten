# Garten Codebase Audit Report

## Executive Summary

The blooming-garden library is a well-structured TypeScript canvas animation library (~2000 lines across 10 source files). It implements 101 plant types with a category-based rendering system. While the architecture is generally sound, there are significant opportunities for improvement in code duplication, unused code removal, and performance optimization.

---

## 1. Code Duplication

### 1.1 Category Renderer Pattern Duplication (HIGH IMPACT)
**Location:** `src/plants/renderers.ts:1041-1388`

Nearly all category renderers follow an identical structural pattern:

```typescript
// This pattern appears in 9 of 13 category renderers
const progress = (time - plant.delay) / plant.growDuration;
if (progress <= 0) return;

const x = plant.x * width;
const baseY = height;
const plantHeight = plant.maxHeight * height * variation.heightMultiplier;

const stemGrowth = Math.min(1, progress * 1.5);
const leafGrowth = Math.max(0, Math.min(1, (progress - 0.3) * 2));
const flowerGrowth = Math.max(0, Math.min(1, (progress - 0.5) * 2));
```

This 8-line block is duplicated (with minor variations) in:
- `PlantCategory.SimpleFlower` (line 1041)
- `PlantCategory.Tulip` (line 1076)
- `PlantCategory.Daisy` (line 1110)
- `PlantCategory.Wildflower` (line 1144)
- `PlantCategory.Rose` (line 1216)
- `PlantCategory.Lily` (line 1250)
- `PlantCategory.Orchid` (line 1284)
- `PlantCategory.Specialty` (line 1333)

**Recommendation:** Extract a `calculateGrowthPhases()` helper function and a `FloweringPlantContext` type.

### 1.2 Leaf Drawing Duplication
**Location:** Multiple locations in `src/plants/renderers.ts`

The leaf drawing pattern appears repeatedly with only minor position/size variations:
- Lines 1067-1068 (SimpleFlower)
- Lines 1101-1102 (Tulip)
- Lines 1136 (Daisy)
- Lines 1241-1242 (Rose)
- Lines 1275-1276 (Lily)
- Lines 1358-1359 (Specialty)

All follow the pattern:
```typescript
drawLeaf(ctx, x - N, leafY, -angle, SIZE * plant.scale * leafGrowth, plant.leafColor);
drawLeaf(ctx, x + N, leafY + M, angle, SIZE * plant.scale * leafGrowth, plant.leafColor);
```

### 1.3 PlantVariation Map Redundancy
**Location:** `src/plants/renderers.ts:28-155`

The 101-entry `plantVariations` Map has significant redundancy. Many entries use identical or near-identical values:

```typescript
// These are essentially duplicates with tiny variations
[PlantType.SimpleFlower, { sizeMultiplier: 1.0, heightMultiplier: 1.0, ... complexity: 0.5 }],
[PlantType.Daisy, { sizeMultiplier: 1.0, heightMultiplier: 1.0, ... complexity: 0.5 }],
[PlantType.Wildflower, { sizeMultiplier: 1.0, heightMultiplier: 1.0, ... complexity: 0.5 }],
```

**Recommendation:** Use a sparse map with inheritance from `defaultVariation`.

---

## 2. Opportunities for Subtraction

### 2.1 Unused Functions (DEAD CODE)

| Function | Location | Status |
|----------|----------|--------|
| `smoothstep` | `src/utils.ts:35-38` | Never called |
| `throttle` | `src/utils.ts:133-145` | Never called |
| `mixColors` | `src/utils.ts:88-98` | Never called |

### 2.2 Unnecessary Fields

**`PlantData.baseY`** - `src/types.ts:322`

This field is always set to `0` in `src/plants/generator.ts:309` and never used for any calculation. All renderers use `height` directly:

```typescript
// generator.ts:309
baseY: 0,

// All renderers use:
const baseY = height;  // Ignores plant.baseY completely
```

### 2.3 Redundant Default Object

**`defaultEvents`** - `src/defaults.ts:17-22`

```typescript
export const defaultEvents: GardenEvents = {
  onGenerationComplete: undefined,
  onComplete: undefined,
  onStateChange: undefined,
  onProgress: undefined,
};
```

All values are `undefined`, making this object functionally equivalent to `{}`.

### 2.4 Console.log Statements in Production Code

**Location:** `src/Garden.ts:59, 305`

```typescript
console.log(`Garten: Generated ${this.plants.length} plants...`);
console.log(`Garten: Regenerated ${this.plants.length} plants`);
```

These should be removed or made conditional for production builds.

---

## 3. Missing Abstractions

### 3.1 Growth Phase Calculator

The growth calculation logic should be extracted:

**Current pattern repeated everywhere:**
```typescript
const stemGrowth = Math.min(1, progress * 1.5);
const leafGrowth = Math.max(0, Math.min(1, (progress - 0.3) * 2));
const flowerGrowth = Math.max(0, Math.min(1, (progress - 0.5) * 2));
```

**Missing abstraction:**
```typescript
interface GrowthPhases {
  stem: number;
  leaf: number;
  flower: number;
}

function calculateGrowthPhases(progress: number): GrowthPhases;
```

### 3.2 Flowering Plant Base Renderer

Most flowering plants (SimpleFlower, Tulip, Daisy, Rose, Lily, Orchid) share identical rendering structure:
1. Draw stem with `drawStem()`
2. Draw leaves at 30-40% height
3. Draw flower head at top

**Missing abstraction:** A `renderFloweringPlant()` higher-order function that accepts a flower-head renderer.

### 3.3 Render Context Object

**Current:** Each renderer manually calculates:
```typescript
const x = plant.x * width;
const baseY = height;
const plantHeight = plant.maxHeight * height * variation.heightMultiplier;
```

**Missing abstraction:**
```typescript
interface PlantRenderContext {
  x: number;
  baseY: number;
  plantHeight: number;
  progress: number;
  growthPhases: GrowthPhases;
}
```

---

## 4. Architecture Review

### 4.1 File Organization

| File | Responsibility | Lines | Assessment |
|------|---------------|-------|------------|
| `index.ts` | Public API exports | 26 | Clean |
| `types.ts` | Type definitions | 394 | Well-organized |
| `defaults.ts` | Default values and resolution | 149 | Clear |
| `utils.ts` | Utility functions | 160 | Some dead code |
| `palettes.ts` | Color palette management | 127 | Focused |
| `Renderer.ts` | Canvas management | 173 | Well-designed |
| `Garden.ts` | Main controller | 333 | Slightly large |
| `plants/index.ts` | Plants barrel export | 3 | Appropriate |
| `plants/generator.ts` | Plant data generation | 370 | Good |
| `plants/renderers.ts` | Drawing functions | 1406 | **Too large** |

### 4.2 Responsibility Separation Issues

**`renderers.ts` is too large (1406 lines)**

This file contains:
- Plant variation data (128 lines of data)
- 15+ individual flower drawing functions
- 13 category renderer functions
- Main dispatch logic

**Recommendation:** Split into:
- `variations.ts` - PlantVariation data
- `flowers/` directory with one file per flower type
- `category-renderers.ts` - Category dispatch logic

### 4.3 Public API - GOOD

The `GardenController` interface is clean and minimal:
- All methods have clear purpose
- No unnecessary exposure of internals
- Good separation between playback control and configuration

### 4.4 Module Coupling

**Potential Issue:** `applyTimingCurve` location

This function is in `defaults.ts` but is really a mathematical utility. It's imported by `generator.ts` which creates a conceptual coupling between "default values" and "plant generation".

**Recommendation:** Move to `utils.ts`.

---

## 5. Performance Concerns

### 5.1 Rendering Invisible Plants (HIGH IMPACT)
**Location:** `src/Renderer.ts:120-127`

```typescript
render(plants: PlantData[], time: number): void {
  for (const plant of plants) {
    drawPlant(this.ctx, plant, this.width, this.height, time);
  }
}
```

Every plant is passed to `drawPlant()` on every frame, even plants whose `delay` hasn't been reached yet. Each call performs:
1. Map lookup for category
2. Map lookup for variation
3. Progress calculation
4. Early return if progress <= 0

With ~500 plants and 30 FPS, this is ~15,000 unnecessary function calls per second in early animation stages.

**Recommendation:** Pre-filter plants by current time or use binary search since plants are sorted.

### 5.2 Repeated Map Lookups
**Location:** `src/plants/renderers.ts:1394-1404`

```typescript
export function drawPlant(...): void {
  const category = getPlantCategory(plant.type);  // Map lookup
  const variation = getVariation(plant.type);      // Map lookup
  ...
}
```

These lookups happen for every plant on every frame. Since plant types don't change, these could be cached in `PlantData` at generation time.

### 5.3 Object Allocation in Hot Path
**Location:** `src/plants/renderers.ts:179-211`

```typescript
export function drawStem(...): { x: number; y: number } | null {
  return { x: endX, y: endY };  // New object allocation every call
}
```

This creates garbage on every draw call. Consider reusing an output object.

---

## 6. Type Safety Issues

### 6.1 Type Assertions
**Location:** `src/plants/generator.ts:254-255`

```typescript
const flowerColors = buildFlowerColors(colors as Required<ColorOptions>);
```

The `as Required<ColorOptions>` assertion is unnecessary since `ResolvedOptions` already has `colors: Required<ColorOptions>`.

### 6.2 Weak Dictionary Type
**Location:** `src/defaults.ts:47`

```typescript
export const plantsPerGeneration: Record<string, [number, number]> = { ... };
```

Uses `Record<string, ...>` instead of `Record<Density, ...>`. This loses type safety.

### 6.3 PlantCategory Definition Location
**Location:** `src/plants/generator.ts:10-24`

`PlantCategory` is defined in `generator.ts` and imported by `renderers.ts`. Having the enum inside the generator module (rather than in `types.ts`) creates an awkward dependency.

---

## Summary of Recommendations

### High Priority
1. **Extract growth phase calculations** into reusable function
2. **Pre-filter plants by time** before rendering to avoid unnecessary work
3. **Remove dead code**: `smoothstep`, `throttle`, `mixColors`
4. **Remove unused field**: `PlantData.baseY`
5. **Split renderers.ts** into smaller, focused modules

### Medium Priority
6. **Cache category/variation lookups** in PlantData at generation time
7. **Create flowering plant base renderer** to eliminate duplication
8. **Move `applyTimingCurve`** to utils.ts
9. **Strengthen plantsPerGeneration type** to use `Density` instead of `string`
10. **Remove console.log statements** from production code

### Low Priority
11. Use sparse variation map with defaults
12. Consider reducing PlantType enum to base types with variation parameters
13. Optimize canvas context state changes
14. Add color validation at options resolution time

---

## Metrics Summary

| Metric | Value |
|--------|-------|
| Total source lines | ~2,000 |
| Dead code lines | ~35 |
| Duplicate pattern instances | ~50 |
| Type assertions used | 2 |
| Files over 500 lines | 1 (renderers.ts: 1406) |
| Unused exports | 3 functions |
