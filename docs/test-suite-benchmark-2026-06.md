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
| Tests | 503 | 946 |
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

## 5. How to re-run

- Perf: the scratch benchmark lives in this commit's history (used a no-op
  canvas context, `vitest run`, best-of-5).
- Coverage: `npx vitest run --coverage --coverage.reporter=json-summary`.
- Probes: re-apply each table-1 mutation (regex patches over the named
  files), run `npm run test:run`, expect failure, `git checkout -- <file>`.
