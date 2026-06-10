# Garten Deep Audit — June 2026 (v1.0.3)

> **Resolution status: all findings fixed in v1.1.0** (see
> `CHANGELOG.md`). Each High/Medium finding gained a regression test before
> its fix; the test-coverage gaps below were closed by `src/Garden.test.ts`,
> the theme/preset constructibility suite, the path-integrity harness in
> `src/plants/renderers.test.ts`, and the build-target enforcement in
> `tsup.config.ts`.

Full-system audit covering every source module, the build/packaging pipeline, the test
suite, and all documentation. Suspected defects were **empirically verified** with
throwaway tests before being reported (methodology at the end). The previous report in
`docs/audit-report.md` describes the pre-1.0 codebase (101 plant types, stale line
numbers) and is superseded by this document; all of its recommendations have been
implemented.

Baseline at audit time: `npm run typecheck` clean · 502/503 tests passing (1 flaky
wall-clock perf test, see L-8) · all three bundles build.

---

## High severity — user-visible breakage

### H-1. Six of eleven built-in themes crash the constructor (verified)

`applyTheme()` (`src/presets.ts:341-347`) builds its colors object with explicit
`flowerColors: themeConfig.flowerColors` / `foliageColors: themeConfig.foliageColors`.
For themes that don't define these arrays the properties exist *with value `undefined`*.
The shallow merge in `resolveOptions` (`src/defaults.ts:121-124`) then lets that
explicit `undefined` clobber the `[]` default, and `buildFlowerColors` /
`buildFoliageColors` (`src/palettes.ts:137,182`) throw:

```
TypeError: Cannot read properties of undefined (reading 'length')
```

Affected themes: **natural, sunset, ocean, grayscale, vibrant, sakura** (sakura passes
`flowerColors` but not `foliageColors`, so it crashes one call later). The README's own
`applyTheme('sakura')` example crashes. Verified end-to-end through
`resolveOptions → generatePlants`.

Note the irony: `LESSONS_LEARNED.md` §2 ("Shallow Merge Bugs Are Sneaky and Recurrent")
documents exactly this bug class as fixed in three other locations. This is the fourth
instance. Fix by stripping `undefined` values in `applyTheme`, **and** defensively
`?? []` in `buildFlowerColors`/`buildFoliageColors` so no merge path can reintroduce it.

### H-2. Per-plant seed collisions produce mass duplicate plants (verified)

`src/plants/generator.ts:514,520`: generation RNG stride is `gen * 1000`, plant stride
is `p * 100`. Any plant with index ≥ 10 has the same seed as a plant in a following
generation: `seed + g*1000 + 10*100 === seed + (g+1)*1000 + 0`. Since the per-plant RNG
stream determines type, x-position, height, and all three colors, the colliding plants
are **pixel-identical and grow at the same x** — only their start time differs.

Measured (seed 42, lush, 10 generations): 264 plants generated, **only 117 distinct
seeds; 99 seeds shared by 2+ plants**. The user effectively gets ~45% fewer visible
plants than generated, plus "the same flower grows twice in the same spot" artifacts.
Affects every density that can roll > 10 plants per generation (normal: 8–13; dense and
lush: always). Additionally `genRand` (`seed + gen*1000`) is the same stream as plant 0
of that generation, correlating plant count with plant-0 appearance.

Fix: make the generation stride exceed the maximum per-plant offset (e.g.
`gen * 100_000 + p * 137`), or derive seeds with a hash. Note this changes existing
seeded gardens — a major-ish visual change worth a changelog entry.

### H-3. Hardcoded opaque white background defeats "background" use cases

`Renderer.clear()` (`src/Renderer.ts:131-134`) fills the whole canvas with literal
`'#ffffff'` every frame (the `COLORS.CANVAS_BACKGROUND` constant exists but is unused).
The README sells full-page background usage (`position: fixed; inset: 0; z-index: -1`),
but on any non-white page — dark mode especially — the garden is an opaque white
rectangle painted over the page background. There is no option to change this and no
transparent mode. Fix: default to `clearRect()` (transparent) and add an optional
`background` option; this also makes `fadeColor` meaningful on non-white pages.

### H-4. Any resize while not playing permanently blanks the canvas

Assigning `canvas.width`/`canvas.height` clears a canvas. The debounced
`Renderer.resize()` (`src/Renderer.ts:108-126`) does exactly that and **never
re-renders**, and `Garten` has no resize hook either. Re-renders only happen in `tick()`
(playing), `stop()`, `seek()`, and `regenerate()`. So for a garden that is `paused`,
`complete`, or `idle` — e.g. the very common "10-minute animation finished an hour ago"
state — any window resize, devtools open, orientation change, or container reflow wipes
the garden and nothing redraws it. Fix: have `Renderer` retain the last `(plants, time)`
and re-render at the end of `resize()`. (Related nit: `resize()` records
`this.width/height` *before* the zero-dimension guard, so `getDimensions()` can report
0×0 while the canvas still holds the old frame.)

### H-5. Shipped bundles don't run on the documented minimum browsers

README and FAQ claim "Chrome 64+, Firefox 69+, Safari 12+, Edge 79+". The published
artifacts contain ES2020 syntax — `??` and `?.` survive into `dist/*.js` (verified by
inspection; tsup is not configured with a browser `target`, and tsconfig `target` does
not govern esbuild output here). Chrome < 80, Firefox < 74, and Safari < 13.1 fail with
a **SyntaxError at parse time** — the library doesn't degrade, it doesn't load. Either
set an explicit esbuild `target` (e.g. `es2018`) in `tsup.config.ts`, or correct the
docs to Chrome 80+ / Firefox 74+ / Safari 13.1+ / Edge 80+.

---

## Medium severity — crashes in legal configs, API contract gaps

### M-1. Legal option combinations crash the pool mid-animation; no error containment in `tick()`

`OPTION_BOUNDS` allows `generations ≤ 1000` with any density. `generations: 1000` at
`'dense'` (~17k plants) or `'lush'` (~26k) exceeds the pool's hard
`DEFAULT_MAX_SIZE = 16384` (`src/GrowthProgressPool.ts:32`). Late in the animation, when
all plants render concurrently, `grow()` throws. The exception escapes
`Renderer.render` → `tick()` (`src/Garden.ts:83-134`), which has **no try/catch**: the
RAF chain dies, the garden freezes, and state is stuck at `'playing'` forever. Fix:
cap total generated plants (or derive pool `maxSize` from the resolved options), and
wrap the tick body so a render error transitions to a terminal state instead of a
silent freeze.

### M-2. `onGenerationComplete` silently skips generations

`didGenerationComplete` (`src/plants/generator.ts:597-612`) reports at most one
generation per frame (`prevGen + 1`), so whenever more than one boundary is crossed
between frames — background tab (RAF suspended), frame drops, high `speed`, low
`targetFPS` — the intermediate events are dropped and never recovered. `seek()`
compounds this: it sets `lastReportedGeneration = currentGen - 1` (`src/Garden.ts:220`)
but no mechanism ever emits that generation, so the event for the generation in
progress at the seek target is also lost. Consumers using the callback to drive
per-generation UI will observe gaps. Fix: loop from `prevGen+1..currentGen` (emitting
each), or document the callback as "may skip".

### M-3. Duplicated utilities with divergent behavior (public API lies about internals)

Two parallel implementations exist for the same names, and the *less capable* one is
what the engine actually uses:

| Function | Internal (used by engine) | Public export (`index.ts`) |
|---|---|---|
| `hexToRgb` / `rgbToHex` / `lightenColor` / `darkenColor` | `utils.ts` — **6-digit hex only** (used by `Renderer`, `palettes`) | `Color.ts` — 3/6/8-digit |
| `prefersReducedMotion` | `utils.ts` — fresh `matchMedia` per call (used by `Garden`) | `Environment.ts` — cached at first `detect()`, can go stale |
| `drawStem` / `drawLeaf` | `plants/renderers.ts` — hardcoded numbers | `CanvasHelper.ts` — uses `GEOMETRY` constants |

Consequences: `fadeColor: '#fff'` **silently disables the fade** (utils parser returns
null); a 3-digit `accent` silently disables accent variants in palettes; users testing
the exported `hexToRgb('#fff')` see it work and reasonably conclude their options are
valid. Consolidate on the `Color.ts` implementations and delete the `utils.ts` copies.

### M-4. Climber vines render broken (verified by path-semantics analysis)

`src/plants/renderers.ts:1351-1415`: the vine renderer interleaves `drawLeaf()` calls
*inside* the vine path construction loop. `drawLeaf` calls `ctx.beginPath()`
(`renderers.ts:146`), which discards the in-progress vine path — `save()/restore()` do
not protect the current path. The final `ctx.stroke()` draws only the segments added
after the last leaf, plus an unwanted stroke of the last leaf's outline in stem color.
Result: vines appear as floating leaves with a stub of stem. Hidden in default configs
because climbers require `maxHeight ≥ 0.5`. Fix: build and stroke the vine path
completely, then draw leaves in a second pass.

### M-5. Painter's-order sort contradicts its own intent

`generator.ts:580-581` sorts ascending by `maxHeight` with the comment "shorter plants
in front". Drawing in array order paints the *tallest last*, i.e. **tall plants are
drawn on top of short foreground plants** — the opposite of the comment (verified
ordering). Either sort descending or fix the comment; as shipped, large background
plants visually swallow foreground detail.

### M-6. `seek()` then `play()` from idle/complete discards the seek (state-machine gaps)

`play()` (`src/Garden.ts:146-163`) only resumes from `pausedAt` when state is
`'paused'`; from `'idle'`/`'complete'` it zeroes `elapsedTime`, so
`garden.seek(300); garden.play()` on a fresh garden starts at 0. Related gaps:

- Only `play()` checks `destroyed`. `stop()`, `seek()`, `setOptions()`, `regenerate()`
  after `destroy()` happily re-render to the detached canvas and regenerate plants,
  resurrecting the memory `destroy()` released.
- `setOptions({ speed: -1 })` first applies/regenerates everything, *then* throws from
  `setSpeed` — a post-mutation throw. Meanwhile `setSpeed()` itself bypasses
  `OPTION_BOUNDS.SPEED` (accepts `0.005` or `1e6`; `setOptions` clamps to 0.01–100).
- `setOptions({ container })` type-checks (`Partial<GardenOptions>`) but is silently
  ignored — `Renderer` never re-parents the canvas.
- Changing only `fadeColor`/`fadeHeight`/`opacity` while paused doesn't re-render, so
  nothing visibly changes until some other action forces a frame.

### M-7. NaN passes through option clamping (verified)

`clampOption` (`src/defaults.ts:69-74`) uses `Math.min/max`, which propagate NaN. Only
`seed` is `Number.isFinite`-guarded. Verified: `duration: NaN` resolves to `NaN` —
progress becomes NaN, the animation never completes, no error is raised. Add a
finite-check fallback to the default for every numeric option.

### M-8. Exported-but-unwired subsystems (~2,700 LOC) and the events API that isn't

`EventEmitter`, `Vec2`/`MutableVec2`, `Color` (class), `CanvasHelper`,
`GrowthProgress` (class), `SeededRandom` (class), and most of `Environment` are
imported **only by `src/index.ts`** — the engine never touches them (verified by
import graph). Specific problems:

- `GardenEventType` declares `'play' | 'stop' | 'regenerate' | 'optionsChange' | …`
  and `EventEmitter` is documented (CLAUDE.md: "garden lifecycle events"), but `Garten`
  exposes no `.on()` and never emits — the only working events are the four
  `options.events` callbacks. The types advertise an API that does not exist.
- CLAUDE.md says `CanvasHelper` provides the stem/leaf drawing — the real renderers
  use their own private copies (see M-3).
- The IIFE/CDN bundle (97 KB minified) carries all of it; ESM consumers tree-shake it,
  CDN users don't.

Decide direction: wire `EventEmitter` into `Garten` (and emit the declared events), or
trim the parallel layer / move it to a secondary entry point.

---

## Low severity / polish

- **L-1 Determinism caveat:** the PRNG is `fract(sin(seed·9999)·10⁴)`
  (`SeededRandom.ts:72-75`). `Math.sin` is not required to be bit-identical across JS
  engines, so "same seed = same garden" holds per-engine, not cross-browser. A
  mulberry32-style integer PRNG would be both portable and better distributed.
- **L-2** `buildFlowerColors` fills accent/base slots sequentially, so at default
  `accentWeight: 0.4` the last 3 natural-palette colors (`#FFF8DC`, `#FFEFD5`,
  `#FAF0E6`) can never appear (verified). Sample rather than truncate.
- **L-3** `GrowthProgress.clone()` recomputes via `fromProgress(progress)` and drops a
  custom `GrowthConfig`, so `clone().equals(original)` can be false. The legacy
  `calculateGrowthPhases()` also returns *unclamped* `progress` (can exceed 1) unlike
  the class/pool versions.
- **L-4** `defaultOptions.seed = Math.random()*100000` is evaluated once at module load
  and never used by `resolveOptions` (which rolls fresh) — a misleading export.
- **L-5** In SSR, `isValidSelector`'s catch converts the missing-`document`
  ReferenceError into a misleading `Invalid selector format` error.
- **L-6** `export * from './constants'` is documented "for advanced customization", but
  renderers hardcode duplicate literals (`'#FFD700'`, `'#ffffff'`, ground color, the
  100 ms debounce, `GROUND_HEIGHT`); editing the constants changes nothing, and the
  `as const` types make them read-only anyway.
- **L-7** `plants.length = estimatedTotal` pre-allocation creates a holey array (V8
  `HOLEY_ELEMENTS`), which usually *pessimizes* vs. plain `push`; the estimate can also
  undershoot lush rolls (harmless, but the perf claim is dubious).
- **L-8** `performance.test.ts:436` asserts 50k pool ops < 50 ms wall-clock — failed on
  this (virtualized) machine at 100 ms. Use generous relative budgets or mark perf
  tests as non-gating.
- **L-9** Packaging: the top-level `browser: dist/index.global.js` field makes legacy
  bundlers that ignore `exports` (webpack 4) resolve the IIFE for `import` — named
  imports silently break. The CJS build also mixes named+default exports (tsup warns);
  `require('garten').default` is needed for the default export.
- **L-10** `seed` bounds clamp negatives to 0 silently, so `seed: -5` ≡ `seed: 0`.
- **L-11** Reduced-motion renders a static completed garden (good), but a subsequent
  explicit `play()` animates anyway — worth documenting as intended or guarding.
- **L-12** Doc/code drift: `docs/audit-report.md` is two refactors stale;
  `docs/index.global.js.map` is orphaned (demo loads from CDN);
  `LESSONS_LEARNED.md` says "60fps" while the default target is 30; CLAUDE.md claims
  `EventEmitter`/`CanvasHelper` roles they don't have (see M-8); the dev-mode warning
  system (`typeof process` guards) is inert in plain browsers, which is where the
  library runs.

---

## Test-coverage gaps the above expose

The suite (503 tests, including property-based and memory-regression tests) is genuinely
strong on unit math, but every High finding lived in a seam the suite doesn't cross:

1. No test constructs a garden *through* `applyTheme`/`createConfig` output (would have
   caught H-1 immediately).
2. No test asserts uniqueness of `PlantData.seed`/`(x, type)` across generations (H-2).
3. Canvas is mocked, so path-semantics bugs (M-4) and background/compositing behavior
   (H-3) are invisible — consider a path-recording mock that asserts stroke/fill call
   structure, or snapshot tests via `node-canvas`.
4. Nothing resizes a non-playing garden and asserts the frame survives (H-4).
5. No fixture parses `dist/` output with the minimum-supported-browser syntax level
   (H-5) — a one-line `es-check`/`acorn` CI step would lock this.

## Strengths worth keeping

Zero runtime dependencies; strict TS config that passes clean; a real options-bounds
layer; frame-scoped object pool with self-healing production mode and leak diagnostics;
gradient caching; FPS throttling; `aria-hidden` + reduced-motion static rendering;
thorough `destroy()` for the supported path; honest CHANGELOG; and unusually good
explanatory docs (architecture/FAQ/lessons). The codebase has visibly benefited from its
previous audit cycles — the remaining defects cluster in the *seams between subsystems*
(merge semantics, duplicated utilities, doc/API drift), not in the core loop.

## Suggested fix order

| # | Finding | Effort | Why first |
|---|---------|--------|-----------|
| 1 | H-1 theme crash | XS | 6/11 themes + README example crash |
| 2 | H-2 seed collisions | XS | Halves visual output at high density |
| 3 | H-4 resize blanks canvas | S | Hits every completed/paused garden |
| 4 | H-3 white background | S | Blocks dark-mode adoption |
| 5 | H-5 build target vs docs | XS | Parse error = total failure on old browsers |
| 6 | M-1 pool crash + tick try/catch | S | Freeze with no recovery |
| 7 | M-3 utility consolidation | M | Removes a whole bug class (incl. `#fff` fade) |
| 8 | M-4/M-5 renderer fixes | S | Visible quality, low risk |
| 9 | M-2/M-6/M-7 API contract | M | Predictable controller behavior |
| 10 | M-8 dead-subsystem decision | M | Shrinks surface or delivers promised events |

---

### Methodology

Every file in `src/` was read in full (≈8,200 LOC excluding tests), plus all
configuration, docs, and the git history. Hypotheses were confirmed by: running
`tsc --noEmit`, the full vitest suite, and `tsup`; inspecting `dist/` output for syntax
level and export shape; and a temporary verification test file (removed after the
audit) that reproduced H-1 (constructor crash via `applyTheme('ocean')`), H-2 (117
distinct seeds across 264 plants), M-7 (`duration: NaN` resolves to NaN), L-2 (three
unreachable palette colors), and the M-5 sort order. M-4 was established from canvas
path semantics (`beginPath` inside `drawLeaf` while the vine path is open); H-4/H-3
from renderer control flow plus canvas clearing semantics.
