# Test Suite & Runtime Benchmark — June 2026 Upgrade

Before = v1.0.3 (`d3cf620`), measured in a clean worktree. After = v1.1.0
with the testing upgrade. Same machine, same Node, perf numbers are
best-of-5 after warmup via an identical scratch benchmark run in both trees.

## 1. Suite strength: defect-reintroduction probes

The decisive metric. Each of the 12 defects found in the June 2026 audit was
re-introduced into the fixed codebase (as the original patch or an equivalent
mutation of the same class), the full suite was run, and the result recorded.
The v1.0.3 suite scores 0/12 on this set *by construction* — every one of
these defects shipped while that suite was green.

| Probe (defect class) | v1.0.3 suite | Upgraded suite |
|---|---|---|
| P1 Theme crash via explicit-undefined merge (H-1) | survived | **killed** — integration (constructibility + fuzz property) |
| P2 Seed-stride collision → duplicate plants (H-2) | survived | **killed** — constants invariant + seed-uniqueness |
| P3 Opaque background (H-3) | survived | **killed** — Garden background tests |
| P4 Resize blanks paused canvas (H-4) | survived | **killed** — Renderer resize-restore test |
| P5 Skipped generation events (M-2) | survived | **killed** — single-frame jump test |
| P6 Vine path discarded by beginPath (M-4) | survived | **killed** — 10 tests across render sweep + path harness |
| P7 Inverted painter ordering (M-5) | survived | **killed** — ordering constraint |
| P8 NaN passes option clamping (M-7) | survived | **killed** — 10 tests (sanitization + fuzz property) |
| P9 Palette tail truncation (L-2) | survived | **killed** — reachability constraint |
| P10 Hex parser divergence, 3-digit broken (M-3) | survived | **killed** — parity + fade + Color tests |
| P11 destroy() not terminal for seek (M-6) | survived | **killed** — destroy contract test |
| P12 Pool cap below legal config max (M-1) | survived | **killed** — worst-case capacity test |

**Kill rate: 0/12 → 12/12.** Most probes are killed by several independent
tests (P6 by ten, P8 by ten), meaning single-test deletion does not reopen
the holes. A 13th gate is non-test: removing the tsup browser targets (H-5)
is caught by `npm run check:dist` (es-check) rather than vitest.

## 2. Coverage by risk boundary

| File | v1.0.3 lines | v1.1.0 lines |
|---|---|---|
| **Total** | **57.5%** | **88.8%** |
| `Garden.ts` (controller, rAF loop) | 0% | 88.5% |
| `Renderer.ts` (canvas lifecycle) | 0% | 88.3% |
| `plants/renderers.ts` (all 19 category renderers) | 6.6% | 99.7% |
| `defaults.ts` (options boundary) | 85.7% | 87.8% |
| `plants/generator.ts` | 90.7% | 95.5% |
| `palettes.ts` | 100% | 100% |
| `presets.ts` | 99.7% | 99.7% |

The last two rows are the cautionary tale: `palettes.ts` was at 100% line
coverage *while containing the palette-truncation bug*, and `presets.ts` at
99.7% *while crashing six themes* — the v1.0.3 assertions exercised the lines
with hand-built fixtures but never the real producer-consumer contract.
Coverage went up as a side effect; the probes table is the real measure.

Note: the v1.0.3 suite could not complete under coverage instrumentation at
all — three wall-clock performance assertions failed under the slowdown.
Budgets are now ~10× regression canaries and the suite runs under coverage.

## 3. Suite size and shape

| Metric | v1.0.3 | v1.1.0 |
|---|---|---|
| Tests | 503 | 946 (at upgrade; 978 + 14 Playwright after §5) |
| Test files | 13 | 17 |
| Suites crossing the constructor boundary | 0 | 3 (Garden, constructibility, lattice) |
| Exhaustive enum sweeps | 0 | 147 types × 6 stages × 4 scenarios |
| Doc-sync assertions | 0 | 59 |
| Cross-constant invariants | 0 | 14 |
| Property-based suites | 1 file | 1 file + totality/monotonicity properties in integration |
| Full run time | ~6s | ~7.4s |

## 4. Runtime performance (best-of-5, same machine)

The PRNG swap (fract(sin) → splitmix32-style hash) and generator cleanups
were motivated by correctness/portability; the speedups are a side effect.

| Benchmark | v1.0.3 | v1.1.0 | Δ |
|---|---|---|---|
| `seededRandom` × 1M | 137.9ms | 15.8ms | **8.7× faster** |
| `SeededRandom.next()` × 1M | 123.2ms | 4.0ms | **31× faster** |
| `generatePlants` (47 gens, normal) × 20 | 23.8ms | 8.7ms | **2.7× faster** |
| Full-garden render × 100 frames | 35.4ms | 24.0ms | **1.5× faster** |
| Plants generated (default config, seed 42) | 502* | 490 | comparable |

\* v1.0.3's 502 includes the duplicate plants from the seed-collision bug —
many were pixel-identical overlaps, so its *visible* plant count was lower.

## 5. Addendum: the three remaining gaps, closed

The original upgrade left three stated gaps; all three are now closed.

### 5a. Real-pixel rendering tests (Playwright + Chromium)

`tests/visual/garden.spec.ts` runs the **built IIFE bundle** in real Chromium
(6 tests): pixel probes assert the transparent default background (alpha 0),
the `background` option's exact RGBA, painted-pixel distribution per vertical
band (a `maxHeight: 1` garden must rasterize pixels in the *top* third — the
region where the climber bug hid), **byte-identical bitmaps for the same seed
across page loads**, and a repaint after a real `ResizeObserver` resize.
Three Linux-Chromium golden screenshots are committed for change detection.

### 5b. Canvas mock contract tests

`tests/contract/canvas-contract.spec.ts` (8 tests) validates every
hand-encoded rule of the strict vitest mock against a real browser canvas:
path discard by `beginPath()` (pixel-verified), `IndexSizeError` on negative
radii, silent no-op on non-finite coordinates, save/restore state semantics,
restore-underflow no-op, user-space path baking (the `drawLeaf` pattern),
bitmap wipe on `canvas.width` assignment, and color-format parsing. All 8
passed on first run — the mock's encoded semantics match Chromium exactly.

### 5c. Automated mutation testing (Stryker)

`stryker.config.json` + `@stryker-mutator/vitest-runner` with perTest
coverage analysis and an incremental cache. Baseline from the first scoped
core run (`npm run test:mutation:core`, ~900 mutants, 7m34s, 38 tests/mutant
average):

Arrows show the survivor-mining pass: survivors were classified, the
load-bearing ones killed with class-level nets, and the files re-scored via
the incremental cache (51s–2m24s per re-run vs 7m34s cold).

| File | Score (total) | Score (covered) | Killed | Survived | No coverage |
|---|---|---|---|---|---|
| `palettes.ts` | 95.4% → **96.9%** | 96.4% → 97.9% | 185 → 188 | 7 → 4 | 2 |
| `GrowthProgress.ts` | 67.6% → **88.0%** | 71.5% → 89.1% | 163 → 212 | 65 → 26 | 13 → 3 |
| `plants/generator.ts` | 55.8% | 62.0% | 156 | 97 | 28 |
| `defaults.ts` | 44.6% → **51.1%** | 52.2% → 59.9% | 80 → 94 | 75 → 63 | 27 |
| **Core boundary total** | 65.2% → **~73%** | 70.7% → ~78% | | | |

Nets added in the survivor-mining pass: pinned *default option values* (a
mutant flipping `loop: false` to `true` had survived the entire suite!),
exhaustive bounds-edge clamping for every numeric option, easing-function
mathematical contracts (endpoints, monotonicity, in/out ordering — entire
case bodies could previously be emptied unnoticed), per-field sensitivity of
`equals`/`approximatelyEquals`, and exact phase/activity boundaries.

Reading the spread honestly:

- **`palettes.ts` at ~97% validates the method**: it is the file that received
  class-level nets (reachability constraint, proportion property,
  constructibility). Its surviving-mutant examples exposed a real gap —
  nothing asserted built color arrays contain *well-formed values* — which
  was closed immediately with a well-formedness constraint test (the arrows
  above show before → after; the incremental re-run took 51s vs 7m34s cold).
  The remaining 4 survivors are the `MAX_ACCENT_RATIO` cap region —
  equivalent-ish for any sane cap value.
- **`generator.ts` survivors are dominated by tuning constants** (category
  weights `0.15 → 0.16`, height-range table values, bias-curve exponents):
  for a generative-art library most of these are *equivalent-ish mutants* —
  any nearby value produces a valid-looking garden. Killing them would mean
  golden-pinning aesthetic constants; the visual golden screenshots cover
  this class at the integration level instead.
- **`defaults.ts` remaining survivors are almost entirely dev-warning
  machinery** (warn message strings, `NODE_ENV` guards, the warn branch of
  each fallback) — warnings are asserted by presence, not text, by policy.
  The load-bearing behavior (defaults, clamp edges, sanitization, fallback
  values) is now pinned directly; what survives is the equivalent-ish class.

The defect-reintroduction probes (section 1) remain the fast, curated
complement: they encode real shipped bugs; Stryker covers the synthetic
operator space between them and is run after substantial boundary or suite
changes (incremental cache keeps re-runs cheap).

## 6. How to re-run

- Perf: the scratch benchmark lives in this commit's history (used a no-op
  canvas context, `vitest run`, best-of-5).
- Coverage: `npx vitest run --coverage --coverage.reporter=json-summary`.
- Probes: re-apply each table-1 mutation (regex patches over the named
  files), run `npm run test:run`, expect failure, `git checkout -- <file>`.
- Mutation testing: `npm run test:mutation:core` (scoped) or
  `npm run test:mutation` (full src); HTML report at
  `reports/mutation/mutation.html`, incremental cache in `reports/`.
- Real-pixel + contract: `npx playwright install chromium` once, then
  `npm run test:e2e`.
