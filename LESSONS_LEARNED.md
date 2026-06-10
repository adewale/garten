# Lessons Learned

Hard-won lessons from building and auditing Garten, a TypeScript canvas animation library rendering 147 plant types at a configurable frame rate (default 30fps).

---

## 1. GC Pressure Is Not a Memory Leak (But It Hurts Just as Much)

No true unbounded memory leaks existed in Garten, but **per-frame object allocations** caused GC pressure that produced visible frame stutters in long-running sessions (30+ minutes). Creating ~70K+ short-lived objects per second forces frequent garbage collection pauses even though every object is GC-eligible.

**Patterns that cause GC pressure in animation loops:**

| Pattern | Example | Fix |
|---------|---------|-----|
| New object literals from hot-path functions | `return { x, y }` in `drawStem` called per plant per frame | Module-level reusable output object (`_stemResult`) |
| Closures allocated per frame | `createRandom(seed)` allocates a closure every frame for deterministic values that never change | Reusable `SeededRandom` instance, re-seeded per plant |
| Wrapper context objects | `createFloweringContext()` wrapping pooled data in a new object each frame | Reusable `_floweringCtx` object mutated in place |
| `Array.push()` + `Array.shift()` | O(n) per frame for bounded rolling windows | Ring buffer with pre-allocated slots |
| Recreating immutable derived data | Gradient objects, template strings that only change on resize/option change | Cache with invalidation on option/resize changes |

**Key insight:** The fix for each pattern is the same principle — allocate once, reuse forever. But reusable output objects change API contracts (callers must consume values before the next call), so **write regression tests before optimizing**.

## 2. Shallow Merge Bugs Are Sneaky and Recurrent

The shallow merge pattern `{ ...defaults, ...userOptions }` appeared in three independent locations and caused bugs in all three:

- `setOptions()` — color sub-properties lost on partial updates
- `applyPreset()` — preset colors overwritten by defaults
- `createConfig()` — custom colors not preserved through config creation

Each was fixed independently over multiple commits before the pattern was recognized. **When you find a shallow merge bug, grep the entire codebase for the same pattern** — it's almost certainly repeated.

## 3. Documentation Drifts From Code Relentlessly

Across several audit cycles, 13+ documentation inconsistencies were found:

- Plant type counts (101 vs 147), category counts (13 vs 19)
- Palette names (`monochrome` vs `grayscale`)
- Function locations (`applyTimingCurve` listed in wrong file)
- Private field access shown in public examples
- Invalid category names in demo presets (`bird-of-paradise`, `lavender`)

**Lesson:** Documentation errors accumulate silently. When code changes, docs don't update themselves. Audit docs against code periodically, and consider integration tests that verify documented counts/names match actual exports.

## 4. Lifecycle Bugs: Destroy Must Be Thorough

Two lifecycle bugs survived all prior audits:

1. `destroy()` not nulling event callbacks — user closures (and everything they capture) retained after destroy
2. No guard against `play()` after `destroy()` — runaway `requestAnimationFrame` loop with no way to stop it

**The fix pattern for any class managing browser resources:**
- Add a `destroyed` boolean flag
- Guard all public methods that start async work (`play`, `resume`)
- In `destroy()`: cancel async work, null all callbacks, clear all collections, set flag

## 5. Repeated Audits Find Progressively Deeper Bugs

The project went through multiple audit cycles, each finding issues the previous one missed:

1. **First audit** — code quality, duplication, structural issues (186 tests)
2. **Second audit** — state preservation bugs, palette naming, option merging (412 tests)
3. **Third audit** — pattern-based analysis found 6 bugs by recognizing recurring bug shapes (419 tests)
4. **Fourth audit** — defensive guards, division by zero, zero-dimension handling (440 tests)
5. **Memory audit** — GC pressure from per-frame allocations, lifecycle bugs (460 tests)

Each cycle required different expertise and framing. The pattern-based audit (commit `d720aac`) was especially productive: once you identify a bug category (shallow merge, state sync, bounds overflow), systematically scanning the codebase for that pattern finds more instances.

## 6. Property-Based Testing Finds What Example Tests Miss

The test suite had 440 example-based tests but zero property-based tests. Adding `fast-check` immediately revealed edge cases:

- **Near-zero vectors** (magnitude ~5e-324) — `normalize()` produced `NaN` due to floating-point underflow
- **Large float precision loss** — `Vec2.lerp` and `utils.lerp` failed at endpoints with very large coordinates
- **`setLength` tolerance** — relative vs absolute tolerance matters when the target length varies across orders of magnitude

**Best candidates for property-based tests:** Pure value objects (Color, Vec2), mathematical functions (timing curves, growth phases), and RNG contracts (determinism, range containment). These have well-defined invariants (commutativity, monotonicity, roundtrip preservation, bounds) that are tedious to enumerate by hand but natural to express as properties.

## 7. Caching Needs Invalidation, Not Just Creation

The `applyVerticalFade()` method was recreating a `CanvasGradient` and parsing hex colors every frame despite the inputs (fadeColor, fadeHeight, maxHeight, canvas dimensions) rarely changing. The fix was a cache keyed on all inputs, invalidated in `setOptions()` and `destroy()`.

**The pattern:** For any derived data computed in a render loop, ask: "How often do the inputs actually change?" If the answer is "only on resize or option change," cache it and invalidate explicitly.

## 8. Environment Caches Go Stale

`getPixelRatio()` was returning cached values from `window.devicePixelRatio`, which goes stale when the user moves a window between displays. The `onResize()` handler also used stale cached values for mobile detection.

**Lesson:** Only cache values that are truly immutable. Browser environment properties like DPI, viewport size, and media queries can change at any time. Either don't cache them, or invalidate on the events that change them.

## 9. Single Source of Truth Prevents Drift

Two patterns of duplication caused real bugs:

1. **RNG duplication** — `utils.ts` and `SeededRandom.ts` both implemented seeded random. Consolidated to single source with re-export.
2. **Variation data duplication** — `generator.ts` and `renderers.ts` each had their own `plantVariations` Map. Consolidated to `variations.ts` with sparse override pattern.

**The sparse override pattern** (`variationOverrides` Map storing only differences from defaults, merged at module load) reduced 147 full variation objects to ~30 override entries while maintaining O(1) lookup.

## 10. Test Before You Optimize

The reusable `_stemResult` object in `drawStem` eliminated ~36K allocations/sec but changed the API contract: callers must consume `.x` and `.y` before the next call to `drawStem`, because the same object is returned every time.

An existing test (`"stem height should be proportional to growth"`) stored a reference across calls and immediately caught the breakage. This validated the approach of writing regression tests before applying optimizations — the test correctly identified a real behavioral change that needed accommodation in calling code.

## 11. Defensive Guards at Boundaries

Multiple boundary-condition bugs were found across audits:

- Division by zero in `seek()` when generations = 0
- Unsafe `Set` iterator access without size check
- Zero-dimension canvas resize (container hidden or detached)
- `growDuration` of 0 causing division by zero in progress calculation
- Preset fallback doing nothing instead of applying defaults

**Principle:** Trust internal code and framework guarantees. Only validate at system boundaries — user input, browser APIs, container state. But at those boundaries, be thorough.

## 12. Object Pooling Is a Spectrum

Garten's pooling evolved through three levels:

1. **`GrowthProgressPool`** — frame-scoped auto-release pool for growth phase objects. Eliminated ~15K allocations/sec in the render hot path.
2. **Ring buffer for frame history** — replaced `push()`/`shift()` with fixed-size pre-allocated array and index arithmetic. Eliminated O(n) shifts.
3. **Module-level reusable objects** — `_stemResult`, `_floweringCtx`, `_tallPlantRng` for singleton hot-path returns. Zero allocation but requires caller discipline.

Each level trades API simplicity for allocation reduction. The right level depends on how hot the path actually is — profile before pooling.
