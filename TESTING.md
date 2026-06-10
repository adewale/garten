# Testing Approach

How Garten is tested, why it is tested this way, and how to extend it.
Grounded in [adewale/testing-best-practices](https://github.com/adewale/testing-best-practices)
and rebuilt after the June 2026 audit, when five high-severity bugs were found
to have shipped under a 503-test green suite (see `LESSONS_LEARNED.md` §13–§20
and `docs/test-suite-benchmark-2026-06.md` for the before/after numbers).

## Commands

```bash
npm test               # watch mode
npm run test:run       # single pass (946 tests, ~7s)
npm run test:coverage  # with v8 coverage
npm run verify         # typecheck + tests + build + dist syntax gate
npm run check:dist     # es-check: dist/ parses at the documented browser level
```

`npm run verify` is the pre-publish gate (`prepublishOnly`).

## Organizing principle: cover risk boundaries, not files

Coverage percentage is informational. The question each suite answers is
"which boundary does this cross?" — every shipped high-severity bug lived in
a boundary no test crossed.

| Boundary | Suite | Technique |
|---|---|---|
| User options → resolved config | `integration.test.ts` ("resolveOptions is total") | fast-check property: *any* fuzzed partial options (NaN, ±Infinity, explicit `undefined`, unknown enum strings) must resolve to a finite, generatable config |
| Theme/preset output → constructor | `integration.test.ts` (constructibility) | every shipped theme, preset, and preset×theme combo runs through `resolveOptions → generatePlants` — fixtures are produced by the real upstream code, never hand-built |
| Config → plant generation | `integration.test.ts` | exhaustive density × palette × maxHeight lattice; seed-uniqueness; painter-ordering; timing invariants |
| Plant data → canvas | `plants/render-sweep.test.ts` | **exhaustive**: all 147 plant types × 6 growth stages × extreme variations under the strict semantic mock |
| Time → controller state/events | `Garden.test.ts` | fake rAF + fake `performance`; includes a hand-driven rAF for true background-tab (single-frame jump) simulation |
| Canvas lifecycle (resize, background, fade) | `Garden.test.ts` (Renderer sections) | recording mock + behavior assertions (frame survives resize, transparent default) |
| Constants ↔ constants | `constants.test.ts` | cross-invariants: seed strides vs density maxima, defaults within bounds, pool capacity vs worst legal config |
| Code ↔ documentation | `docs-sync.test.ts` | code is the source of truth: themes/presets/categories/options/events must appear in README; counts asserted against enums; browser claims parsed from `tsup.config.ts` |
| Source ↔ shipped bundles | `npm run check:dist` (es-check) | dist must parse at the documented minimum browser syntax level |
| Pure math/value objects | `property.test.ts`, unit suites | fast-check algebraic properties + examples |

## The strict canvas mock

jsdom has no real canvas, and a call-recording mock cannot see semantic bugs
(a vine path was silently discarded by `beginPath()` for several releases
while the mock dutifully recorded all the calls). The strict mock in
`plants/render-sweep.test.ts` models the parts of the canvas state machine
that have burned us:

- a path with ops **must** be `fill()`ed or `stroke()`d before the next
  `beginPath()` — discarding is a violation
- `save()`/`restore()` must balance and never underflow
- `globalAlpha`/`globalCompositeOperation` must be restored after a plant
- negative `arc`/`ellipse` radii **throw**, as the DOM does
- non-finite coordinates are violations (real canvas ignores them silently,
  which is exactly how NaN bugs become invisible)

When adding a renderer feature, the sweep runs it across all types and
stages automatically — there is nothing to opt into.

## Exhaustive over sampled

Bounded spaces are enumerated, not sampled: all 147 plant types, all
6 palettes × 4 densities, every theme and preset. Property-based randomness
(fast-check) is reserved for genuinely unbounded spaces (numeric options,
partial-object shapes, time values). The climber renderer was broken for
multiple releases because it only renders at `maxHeight ≥ 0.5` and nothing
ever sampled that region — exhaustiveness is the structural fix.

## Conventions

- `describe('Constraint: ...')` — invariants that must hold across the system
- `describe('Exhaustive: ...')` — full enumeration of a bounded space
- `describe('Property: ...')` — fast-check properties
- `describe('Doc sync: ...')` — documentation/code agreement
- Builders over fixtures: `makePlant(type, overrides)`, `makeGarden(overrides)`
  live next to their suites; when testing a consumer, prefer feeding it the
  real producer's output over any builder
- Performance assertions are **regression canaries**, not benchmarks: budgets
  carry ~10× headroom so they fail only on order-of-magnitude regressions and
  survive coverage instrumentation and slow CI hosts
- Fake time completely (`requestAnimationFrame`, `performance`, timers); for
  multi-second jumps in one frame, drive the rAF callback by hand

## Real-pixel tests (Playwright)

`tests/visual/garden.spec.ts` runs the **built IIFE bundle** in real Chromium
and asserts on the actual rasterized bitmap — the layer the vitest suite
cannot see:

- **Pixel probes** (platform-independent): background alpha is 0 by default
  and exactly the configured color with the `background` option; a completed
  garden paints >5k pixels in the bottom band and none above `maxHeight`; a
  `maxHeight: 1` garden paints the *top* band (the formerly-invisible tall
  region); the same seed produces a **byte-identical** bitmap across page
  loads; a real `ResizeObserver` resize repaints the frame while idle.
- **Golden screenshots** (change detection): three committed Linux-Chromium
  goldens (default complete, mid-growth, tall-on-dark). Regenerate with
  `npm run test:visual -- --update-snapshots`; AA is the only variance
  (no text is rendered), budgeted at `maxDiffPixelRatio: 0.01`.

```bash
npx playwright install chromium   # one-time browser download
npm run test:e2e                  # build + visual + contract projects
```

## Mock contract tests (Playwright)

`tests/contract/canvas-contract.spec.ts` validates every hand-encoded rule of
the strict vitest mock against a **real browser canvas**, so the mock cannot
drift from the platform. One test per rule, pixel-verified where possible:
`beginPath()` really discards an unflushed path; negative radii really throw
`IndexSizeError`; non-finite coordinates are really silent no-ops (which is
why the mock flags them); `save()/restore()` really restores style state;
`restore()` underflow is a no-op; paths are baked in user space at
construction (the `drawLeaf` pattern); `canvas.width` assignment really wipes
the bitmap (the resize-bug root); and every color format the library emits
parses. If one of these fails after a browser update, the platform changed —
update the mock and renderers to match.

## Measuring the suite itself

The suite's strength is verified, not assumed:

- **Automated mutation testing (Stryker)**: `npm run test:mutation:core`
  mutates the options/palette/growth/generation boundary files and runs the
  vitest suite per mutant (`coverageAnalysis: perTest`, incremental cache in
  `reports/stryker-incremental.json`); `npm run test:mutation` covers all of
  `src/`. Scores and methodology: `docs/test-suite-benchmark-2026-06.md`.
  Run it after substantial suite or boundary changes — it is too slow for
  the per-commit `verify` gate.
- **Defect-reintroduction probes**: the 12 historical defects from the June
  2026 audit are re-applied one at a time and the suite must kill each one.
  Current kill rate: 12/12 (the v1.0.3 suite scored 0/12 — every defect
  shipped under green). The probes remain the curated, fast complement to
  Stryker: they encode *real shipped bugs* rather than synthetic operators.
- When fixing any bug: write the failing test first (red), fix (green), and
  ask which *class* the bug belongs to — then add the class-level net
  (property, invariant, or sweep), not just the instance-level regression.

## Known gaps / future work

- Visual goldens are Linux-Chromium only (the CI platform). Cross-browser
  pixel parity (WebKit/Firefox projects) is possible but each adds a golden
  set; the pixel-probe assertions already run identically everywhere.
- Mutation testing is scoped + scheduled rather than gating: a full-`src`
  run is CPU-expensive. Revisit if CI capacity allows.
