# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-10

Fixes every finding from the June 2026 audit (`docs/audit-report-2026-06.md`).

> **Determinism note:** the RNG was replaced and seed derivation fixed, so a
> given `seed` produces a *different* (and now cross-browser-stable) garden
> than in 1.0.x.

### Fixed

- `applyTheme()` crashed the constructor for 6 of 11 built-in themes
  (natural, sunset, ocean, grayscale, vibrant, sakura): explicit `undefined`
  color fields clobbered defaults during option resolution. All merge sites
  now strip `undefined`, and palette builders are defensive
- Per-plant seed collisions: generation/plant seed strides overlapped, making
  plant 10+ of each generation a pixel-identical duplicate of a plant in the
  following generation (at `lush` density over half the garden was duplicates)
- Resizing while paused/complete/idle permanently blanked the canvas — the
  renderer now re-renders the last frame after resize
- Climber vines rendered broken: leaf drawing interrupted the in-progress
  vine path (`beginPath()` discards the current path), so most segments were
  never stroked. Vines now stroke completely before leaves are drawn
- Plant layering was inverted: tall plants drew over short foreground plants.
  Plants now draw tallest-first (painter's algorithm)
- Published bundles contained ES2020 syntax (`??`, `?.`) that the documented
  minimum browsers (Chrome 64, Safari 12, Firefox 69) cannot parse — the
  build now transpiles to those exact targets
- A legal configuration (`generations: 1000` + dense/lush density) exceeded
  the growth pool's hard cap mid-animation and froze the loop; the cap now
  covers the worst legal case (32,768) and a throwing frame pauses the
  animation recoverably instead of stranding it in `playing`
- `onGenerationComplete` skipped generations when several boundaries elapsed
  between frames (background tabs, slow frames, high speed) — every crossed
  generation is now reported in order
- `seek()` before `play()` was ignored from idle/complete; `play()` now
  resumes from the sought position, and seeking backward out of `complete`
  returns to a resumable state
- `NaN`/`Infinity` numeric options passed through clamping unchanged and
  silently broke the animation — non-finite values now fall back to defaults;
  `accentWeight` is clamped to [0, 1]
- Negative seeds all clamped to 0; they now normalize to distinct values
- `fadeColor: '#fff'` (3-digit hex) silently disabled the fade: the internal
  hex parser only handled 6-digit hex while the exported one handled 3/6/8.
  All color utilities now share the single `Color.ts` implementation
- Accent weighting silently dropped the tail of the base palette (the
  whites/creams in `natural` could never appear); all base colors are now
  always included with the accent proportion achieved by repetition
- `setOptions({ speed: invalid })` threw only *after* applying the other
  options; validation now happens before any mutation. `setSpeed()` rejects
  non-finite values and clamps to the documented range
- `setOptions({ container })` was silently ignored; it now throws with
  guidance to create a new instance
- Visual-only option changes (`background`, `fadeColor`, `opacity`, ...)
  while paused now re-render immediately instead of on the next playing frame
- All controller methods are no-ops after `destroy()` (previously `seek`,
  `stop`, `setOptions`, and `regenerate` still ran against the detached canvas)
- `GrowthProgress.clone()` dropped custom growth configs;
  `calculateGrowthPhases()` now clamps progress to 1 like the class/pool
  versions; `gaussian()` can no longer return `-Infinity`
- `Environment.prefersReducedMotion()`/`prefersDarkMode()` returned stale
  cached values; they now query fresh
- SSR: constructing with a selector string outside a browser now throws a
  clear "requires a browser environment" error instead of a misleading
  "invalid selector" one

### Added

- Real-pixel rendering tests (Playwright + Chromium, `tests/visual/`): the
  built IIFE bundle is exercised in a real browser with pixel-probe
  assertions (transparent/colored background, painted-band distribution,
  byte-identical determinism across page loads, repaint after a real
  ResizeObserver resize) plus three committed golden screenshots
- Canvas mock contract tests (`tests/contract/`): every hand-encoded rule of
  the strict vitest canvas mock is validated against real Chromium (path
  discard, IndexSizeError on negative radii, silent non-finite no-ops,
  save/restore semantics, user-space path baking, bitmap wipe on
  `canvas.width` assignment, color format parsing)
- Automated mutation testing via Stryker (`npm run test:mutation`,
  `test:mutation:core` for the options/palette/growth/generation boundary)
  with perTest coverage analysis and an incremental cache; survivor mining
  added class-level nets (pinned default values, exhaustive bounds-edge
  clamping, easing-function contracts, equality field sensitivity)
- CI workflow (`.github/workflows/ci.yml`): verify + Chromium suites on
  every PR and push to main; weekly scoped mutation run with report artifact
- Testing approach rebuilt on [testing-best-practices](https://github.com/adewale/testing-best-practices)
  research (`TESTING.md`): exhaustive 147-type render sweep under a strict
  semantic canvas mock, doc-sync tests (README/FAQ verified against code and
  build targets), cross-constant invariant tests, a fast-check totality
  property over the options boundary, and an `es-check` dist syntax gate
  (`npm run verify`). 978 vitest + 14 Playwright tests; defect-reintroduction kill rate 12/12 vs
  0/12 for the v1.0.x suite — see `docs/test-suite-benchmark-2026-06.md`
- Root-cause sweep fixes: `GrowthProgress` partial-config merges no longer
  NaN-poison phases via explicit `undefined`; `GrowthProgressPool` sanitizes
  non-finite numeric config; invalid `density`/`palette`/`categories`/
  `timingCurve` values fall back with a dev warning instead of crashing or
  corrupting; `SeededRandom` normalizes non-finite seeds; an unparseable
  `fadeColor` now warns once instead of silently disabling the fade
- `GARDEN_EVENT_TYPES` runtime constant (the event union is derived from it)
- `getCompletedGenerations()` — single source of generation-boundary math
  (replaces the unused `getCurrentGeneration`/`didGenerationComplete`)
- `background` option (default `'transparent'`): the canvas no longer paints
  an opaque white rectangle, so the garden works on dark and colored pages
- `on()` / `once()` / `off()` subscription API on `Garten`, emitting
  `play`, `pause`, `stop`, `complete`, `progress`, `generationComplete`,
  `stateChange`, `regenerate`, and `optionsChange` (the previously exported
  `EventEmitter` and event types are now actually wired in)
- Garden/Renderer lifecycle test suite (mocked canvas + fake rAF), theme/preset
  constructibility tests, seed-uniqueness and option-sanitization constraints,
  and a canvas path-integrity test harness (475 tests added since 1.0.x)

### Changed

- RNG is now a splitmix32-style integer hash instead of `fract(sin(x))`:
  deterministic across JS engines (the old form depended on each engine's
  `Math.sin`) and better distributed
- Renderer color/timing literals now reference the exported constants
  (`COLORS.*`, `ANIMATION.*`) instead of duplicated inline values
- Removed the `browser` package.json field (legacy bundlers resolved the
  IIFE for `import` and broke named imports); `exports` is authoritative
- Performance test budgets relaxed ~10x — they are regression canaries, not
  benchmarks, and previously failed on slow CI hosts

## [1.0.3] - 2026-03-03

Version bump only — no code changes (package.json/package-lock.json).
Note: 1.0.3 was never published to npm; the latest published release at the
time of the 1.1.0 audit was 1.0.2.

## [1.0.2] - 2026-03-02

### Fixed

- Fix GC pressure from per-frame allocations in animation loop (~70K+ throwaway objects/sec)
  - `drawStem` now returns a reusable shared object instead of allocating per call
  - `createFloweringContext` reuses a module-level context object
  - Tall plant renderers reuse a single `SeededRandom` instance instead of allocating closures per frame
- Fix `play()` after `destroy()` causing a runaway `requestAnimationFrame` loop with no way to stop it
- Fix `destroy()` not clearing event callbacks, retaining user closures and everything they capture
- Fix `GrowthProgressPool` frame history using `push()`/`shift()` (O(n) per frame) — now uses a ring buffer

### Added

- Property-based tests via `fast-check` covering Color, Vec2, GrowthProgress, SeededRandom, timing curves, utilities, and plant variation validity (44 tests)
- Memory regression tests for `drawStem` shared-object contract, RNG determinism, pool frame history, and pool lifecycle (19 tests)
- `LESSONS_LEARNED.md` documenting patterns and pitfalls from 5 audit cycles
- Fade gradient caching in `Renderer` — avoids recreating `CanvasGradient` and parsing hex colors every frame

### Changed

- `drawStem` returns a shared object — callers must consume `.x`/`.y` before the next call
- `GrowthProgressPool` frame history pre-allocates ring buffer slots at construction

## [1.0.1] - 2026-02-07

### Fixed

- Fix incorrect palette name `'monochrome'` to `'monotone'` in FAQ examples
- Fix FAQ code example accessing private `garden.options.duration` field
- Fix misleading FAQ comment claiming `regenerate()` uses a new random seed
- Fix FAQ error message text to match actual error in Renderer.ts
- Add missing `'grayscale'` palette to FAQ palette list

### Changed

- Remove undocumented `densityPreset` and `speedPreset` from public exports
- Remove unused `CategoryRenderers` type from public API
- Simplify `PlantCategory` re-export chain (`plants/index.ts` now re-exports directly from `types.ts`)
- Update CLAUDE.md with descriptions for all source files and fix inaccurate references

## [1.0.0] - 2024-12-29

### Added

- Initial public release
- 147 plant types across 19 categories:
  - Simple flowers, tulips, daisies, wildflowers
  - Grasses, ferns, bushes
  - Roses, lilies, orchids
  - Succulents, herbs, specialty flowers
  - Tall flowers (hollyhocks, delphiniums, foxgloves)
  - Giant grasses (bamboo, miscanthus)
  - Climbers (wisteria, clematis)
  - Small trees (birch, willow, cherry blossom)
  - Tropical plants (palms, bird of paradise)
  - Conifers (pine, cypress, juniper)
- Playback controls: `play()`, `pause()`, `stop()`, `seek()`, `setSpeed()`
- 12 presets: default, demo, subtle, lush, forest, meadow, roseGarden, tropical, herbs, succulent, ambient, performance
- 11 themes: natural, sunset, ocean, grayscale, vibrant, sakura, lavender, autumn, midnight, tropical, zen
- `createConfig()` to combine presets and themes
- Seeded RNG for reproducible gardens
- `GrowthProgressPool` for zero-allocation rendering
- Event callbacks: `onStateChange`, `onProgress`, `onGenerationComplete`, `onComplete`
- Timing curves: linear, ease-in, ease-out, ease-in-out, custom exponent
- Reduced motion support (`respectReducedMotion` option)
- ESM, CJS, and IIFE (CDN) bundles
- Full TypeScript support with type exports
- Zero dependencies

[1.0.2]: https://github.com/adewale/garten/releases/tag/v1.0.2
[1.0.1]: https://github.com/adewale/garten/releases/tag/v1.0.1
[1.0.0]: https://github.com/adewale/garten/releases/tag/v1.0.0
