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

**Postscript (v1.1.0):** it recurred anyway. A fourth instance (`applyTheme` writing explicit `undefined` into color fields) crashed 6 of 11 built-in themes, and a fifth (`GrowthProgress` config merges) NaN-poisoned growth phases — both *after* this lesson was written down. The durable fix was not prose: it was an `omitUndefined()` helper used at every merge site, plus a fast-check property asserting `resolveOptions` is total over fuzzed partial options (including explicit `undefined` in every field). See lesson 20.

## 3. Documentation Drifts From Code Relentlessly

Across several audit cycles, 13+ documentation inconsistencies were found:

- Plant type counts (101 vs 147), category counts (13 vs 19)
- Palette names (`monochrome` vs `grayscale`)
- Function locations (`applyTimingCurve` listed in wrong file)
- Private field access shown in public examples
- Invalid category names in demo presets (`bird-of-paradise`, `lavender`)

**Lesson:** Documentation errors accumulate silently. When code changes, docs don't update themselves. Audit docs against code periodically, and consider integration tests that verify documented counts/names match actual exports.

**Postscript (v1.1.0):** "consider integration tests" became `src/docs-sync.test.ts`: every theme, preset, category, option, and event must appear in the README; plant-type/category counts are asserted against the enums; the browser-support claim is parsed out of `tsup.config.ts` targets and matched against README and FAQ. On its first run it caught a live gap (the `colors` option was undocumented). Doc drift is now a failing test, not a periodic audit chore.

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

## 13. Coverage by File Lies; Measure Coverage by Risk Boundary

At v1.0.3 the suite had 503 tests and looked thorough — yet `Garden.ts` and `Renderer.ts` (the controller and the canvas layer, where users actually live) had **0% coverage**, and `plants/renderers.ts` had 6.6%. Meanwhile `palettes.ts` showed 100% line coverage *with a palette-truncation bug in it* and `presets.ts` 99.7% *with a constructor-crashing bug in it*.

Every high-severity defect found in the June 2026 audit lived in a seam the suite never crossed: constructor wiring, the rAF loop, resize, theme output feeding the constructor.

**Lesson:** list your risk boundaries (user input → options, options → generation, generation → canvas, time → events, docs → users) and ask "which test crosses this?" — not "which file has coverage?". Coverage percentage is informational; an untested *boundary* is a finding.

## 14. Test Through the Real Producer, Not Hand-Built Fixtures

Palette tests called `buildFlowerColors` with carefully hand-built, fully-populated options objects — and passed. The crash lived precisely in the difference between those fixtures and what `applyTheme` *actually emits* (explicit `undefined` fields). The README's own `applyTheme('sakura')` example crashed while the suite was green.

**Lesson:** when module B consumes module A's output, at least one test must feed B with A's *real* output, not a fixture imitating it. The constructibility suite now runs every shipped theme, preset, and preset×theme combination through `resolveOptions → generatePlants`.

## 15. Mocks Must Encode Platform Semantics, Not Record Calls

A call-recording canvas mock happily reported `quadraticCurveTo` called 8 times — it could not show that 7 of those segments were silently discarded because `drawLeaf()` called `beginPath()` mid-construction. Climber vines rendered broken for multiple releases. The same blindness hid that `canvas.width = x` wipes the bitmap (resize blanked paused gardens).

**Lesson:** for stateful platform APIs (canvas, WebGL, audio graphs), the mock must model the state machine: unflushed-path detection, save/restore depth, negative-radius throws, non-finite coordinate flags. Our strict mock turned an invisible bug class into `expect(ctx.violations).toEqual([])`.

## 16. When the State Space Is Bounded, Test All of It

147 plant types × 6 growth stages is 882 cheap cases — there was never a reason to sample. The climber bug hid because climbers only appear at `maxHeight >= 0.5` and no default config or test ever rendered one. The exhaustive sweep also asserts every type draws *something* at full growth, so a silently-blank plant type is now impossible.

**Lesson:** enums, flag sets, and small config lattices (density × palette × maxHeight) should be enumerated exhaustively, not sampled by example tests. Reserve property-based randomness for genuinely unbounded spaces.

## 17. Unwritten Invariants Don't Exist

The seed-stride collision (gen stride 1000 < 30 plants × 100) and the pool-cap crash (OPTION_BOUNDS allows ~30,000 plants; pool hard-capped at 16,384) were both pairs of *individually plausible* constants that nobody ever checked against each other. There was no place where "no two plants may share an RNG stream" or "the pool must cover the worst legal config" was stated.

**Lesson:** cross-cutting invariants must be articulated as executable tests (`constants.test.ts`). When a re-introduced seed-stride bug is killed by the *invariant* test before any behavioral test fires, the invariant is doing its job.

## 18. Documentation Claims Need Failing Conditions

"Chrome 64+, Safari 12+" was false for two releases: the bundles contained `??`/`?.` that those browsers cannot parse. The claim was mechanically checkable the whole time. Now `tsup.config.ts` declares the targets, `es-check` gates `dist/` syntax in `npm run verify`, and a doc-sync test parses the targets and asserts the README/FAQ claim matches them.

**Lesson:** every checkable claim in docs — version minimums, counts, option lists, API shapes — should have a test or build gate that fails when it stops being true.

## 19. Measure the Suite, Not Just the Code

Numbers from the v1.1.0 testing upgrade (same machine, see `docs/test-suite-benchmark-2026-06.md`):

- Defect-reintroduction probes: 12 historical defects re-applied one at a time. v1.0.3 suite kill rate: **0/12** (all shipped green). Upgraded suite: **12/12**, most killed by several independent tests.
- Line coverage 57.5% → 88.8%; `Garden.ts` 0% → 88.5%; `plants/renderers.ts` 6.6% → 99.7%.
- The v1.0.3 suite could not even *run* under coverage instrumentation — wall-clock perf assertions failed. Budgets are now regression canaries (~10× headroom).

**Lesson:** "does the suite catch the bugs we actually shipped?" is a measurable question. Re-introduce fixed defects periodically (or run mutation testing) — a suite that has never been measured against real defects is an untested test suite.

## 20. A Lesson Written as Prose Is a Lesson Waiting to Recur

Lesson 2 documented the shallow-merge bug class and its three fixed instances — and the fourth instance shipped anyway, crashing six themes. Prose doesn't execute.

**Lesson:** every entry in this file should end with a pointer to the *mechanism* that enforces it — a helper everyone must use, a type that makes the bug unrepresentable, a test that fails, or a build gate. If a lesson has no mechanism, it is a TODO, not a lesson. (This file now practices what it preaches: lessons 2, 3, 13–19 each name their enforcing test or gate.)
