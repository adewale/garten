/**
 * Renderer Tests - Verify rendering calculations
 * These tests ensure that the mathematical calculations in renderers
 * produce correct results. They serve as behavior verification if
 * we ever refactor to use Vec2/MutableVec2.
 *
 * Note on design choice: Renderers use inline math rather than Vec2 because:
 * 1. Canvas API accepts raw x, y coordinates
 * 2. Inline math avoids function call overhead in hot paths
 * 3. No intermediate allocations for simple arithmetic
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { drawStem, drawLeaf, drawPlant } from './renderers';
import { PlantType } from '../types';
import type { PlantData } from '../types';
import { getPlantVariation } from './variations';
import { seededRandom } from '../utils';
import { GrowthProgressPool } from '../GrowthProgressPool';

/** One recorded canvas call: method name plus its arguments */
interface Call {
  method: string;
  args: number[];
}

/**
 * Records every path/transform/draw call with its arguments and the style
 * properties in effect at each stroke()/fill(), so properties can assert
 * on the exact sequence the helper issued.
 */
function createRecordingContext() {
  const calls: Call[] = [];
  interface Styles {
    method: string;
    strokeStyle: string;
    fillStyle: string;
    lineWidth: number;
    lineCap: string;
  }
  const styles: Styles[] = [];
  const ctx = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
  const record =
    (method: string) =>
    (...args: number[]) => {
      calls.push({ method, args });
      if (method === 'stroke' || method === 'fill') {
        const { strokeStyle, fillStyle, lineWidth, lineCap } = ctx as unknown as Styles;
        styles.push({ method, strokeStyle, fillStyle, lineWidth, lineCap });
      }
    };
  for (const method of [
    'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
    'arc', 'ellipse', 'stroke', 'fill', 'save', 'restore', 'translate', 'rotate',
  ]) {
    (ctx as unknown as Record<string, unknown>)[method] = record(method);
  }
  return { ctx, calls, styles };
}

const finite = (min: number, max: number) => fc.double({ min, max, noNaN: true });
const coord = finite(-1e4, 1e4);
/** Growth values the guards reject: zero (both signs), negative, -Infinity */
const nonPositiveGrowth = fc.oneof(
  fc.constantFrom(0, -0, -Infinity),
  fc.double({ min: -1e6, max: 0, noNaN: true })
);
/** Positive growth, including values past full growth and +Infinity */
const positiveGrowth = fc.oneof(
  fc.double({ min: 0, max: 1, minExcluded: true, noNaN: true }),
  fc.double({ min: 1, max: 1e6, noNaN: true }),
  fc.constantFrom(Number.MIN_VALUE, 1, Infinity)
);
const stemArgs = fc.record({
  x: coord,
  y: coord,
  height: finite(0, 1e4),
  thickness: finite(0, 50),
  color: fc.constantFrom('#4A7C40', '#2d5a27', 'rgba(1, 2, 3, 0.5)'),
  lean: finite(-1, 1),
});

describe('Property: drawStem', () => {
  it('draws nothing and returns null for growth <= 0', () => {
    fc.assert(
      fc.property(stemArgs, nonPositiveGrowth, (a, growth) => {
        const { ctx, calls } = createRecordingContext();
        const result = drawStem(ctx, a.x, a.y, a.height, a.thickness, a.color, a.lean, growth);
        expect(result).toBeNull();
        expect(calls).toEqual([]);
      }),
      { numRuns: 5 }
    );
  });

  it('returns the tip at min(1, growth) of the height, shifted by lean per unit of height', () => {
    // At full growth the tip is (x + lean * height, y - height); growth past
    // 1 is clamped and lean never changes the tip's height
    fc.assert(
      fc.property(stemArgs, positiveGrowth, (a, growth) => {
        const { ctx } = createRecordingContext();
        const h = a.height * Math.min(1, growth);
        const tip = drawStem(ctx, a.x, a.y, a.height, a.thickness, a.color, a.lean, growth);
        expect(tip).toEqual({ x: a.x + a.lean * h, y: a.y - h });
      }),
      { numRuns: 5 }
    );
  });

  it('strokes one curve from the base to the returned tip, inside their bounding box', () => {
    // A Bezier curve lies in the convex hull of its control points, so
    // control points inside the base-tip box keep the stem from bulging
    // past its own tip or base
    fc.assert(
      fc.property(stemArgs, positiveGrowth, (a, growth) => {
        const { ctx, calls } = createRecordingContext();
        const tip = { ...drawStem(ctx, a.x, a.y, a.height, a.thickness, a.color, a.lean, growth)! };
        expect(calls.map((c) => c.method)).toEqual(['beginPath', 'moveTo', 'bezierCurveTo', 'stroke']);
        expect(calls[1].args).toEqual([a.x, a.y]);
        const [c1x, c1y, c2x, c2y, endX, endY] = calls[2].args;
        expect([endX, endY]).toEqual([tip.x, tip.y]);
        const within = (v: number, p: number, q: number) => Math.min(p, q) <= v && v <= Math.max(p, q);
        for (const [cx, cy] of [[c1x, c1y], [c2x, c2y]]) {
          const inBox = within(cx, a.x, tip.x) && within(cy, a.y, tip.y);
          expect(inBox, `control point (${cx}, ${cy})`).toBe(true);
        }
      }),
      { numRuns: 5 }
    );
  });

  it('strokes with the given color and thickness and a round cap', () => {
    fc.assert(
      fc.property(stemArgs, positiveGrowth, (a, growth) => {
        const { ctx, styles } = createRecordingContext();
        drawStem(ctx, a.x, a.y, a.height, a.thickness, a.color, a.lean, growth);
        expect(styles).toEqual([
          {
            method: 'stroke',
            strokeStyle: a.color,
            fillStyle: '',
            lineWidth: a.thickness,
            lineCap: 'round',
          },
        ]);
      }),
      { numRuns: 5 }
    );
  });
});

const leafArgs = fc.record({
  x: coord,
  y: coord,
  angle: finite(-10, 10),
  color: fc.constantFrom('#228B22', '#2d5a27', 'rgba(1, 2, 3, 0.5)'),
});

describe('Property: drawLeaf', () => {
  it('draws nothing for a size below 1px', () => {
    fc.assert(
      fc.property(
        leafArgs,
        fc.oneof(
          fc.double({ min: -1e6, max: 1, maxExcluded: true, noNaN: true }),
          fc.constant(-Infinity)
        ),
        (a, size) => {
          const { ctx, calls } = createRecordingContext();
          drawLeaf(ctx, a.x, a.y, a.angle, size, a.color);
          expect(calls).toEqual([]);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('fills one closed leaf from its base to `size` along the angle, inside save/restore', () => {
    // The leaf is drawn in a frame translated to (x, y) and rotated by
    // `angle`: it starts and ends at the origin and reaches (size, 0)
    fc.assert(
      fc.property(leafArgs, fc.double({ min: 1, max: 1e4, noNaN: true }), (a, size) => {
        const { ctx, calls, styles } = createRecordingContext();
        drawLeaf(ctx, a.x, a.y, a.angle, size, a.color);
        expect(calls.map((c) => c.method)).toEqual([
          'save', 'translate', 'rotate',
          'beginPath', 'moveTo', 'bezierCurveTo', 'bezierCurveTo', 'fill',
          'restore',
        ]);
        expect(calls[1].args).toEqual([a.x, a.y]);
        expect(calls[2].args).toEqual([a.angle]);
        expect(calls[4].args).toEqual([0, 0]);
        expect(calls[5].args.slice(4)).toEqual([size, 0]);
        expect(calls[6].args.slice(4)).toEqual([0, 0]);
        expect(styles.map((st) => st.fillStyle)).toEqual([a.color]);
      }),
      { numRuns: 5 }
    );
  });
});

describe('Negative modifier guards', () => {
  // Count formulas are clamped with Math.max(min, base + petalCountModifier)
  // so extreme negative modifiers still draw the minimum (fixes issue #1).
  // Each case renders a real plant through drawPlant at full growth: with
  // the guard in place, an extreme modifier (-100) must draw exactly what the
  // modifier that lands *on* the minimum draws. Without the guard the
  // extreme render loses those petals/leaves entirely and the streams differ.

  /** Records every call as `method(args)` and flags non-finite or negative-radius args */
  function createOpRecorder() {
    const ops: string[] = [];
    const problems: string[] = [];
    const record =
      (method: string, radiusIndexes: number[] = []) =>
      (...args: unknown[]) => {
        const nums = args.filter((a): a is number => typeof a === 'number');
        if (nums.some((n) => !Number.isFinite(n))) problems.push(`${method}(${nums.join(',')})`);
        for (const idx of radiusIndexes) {
          if ((args[idx] as number) < 0) problems.push(`${method} negative radius ${String(args[idx])}`);
        }
        ops.push(`${method}(${nums.map((n) => n.toFixed(2)).join(',')})`);
      };
    const ctx = {
      beginPath: record('beginPath'),
      closePath: record('closePath'),
      moveTo: record('moveTo'),
      lineTo: record('lineTo'),
      bezierCurveTo: record('bezierCurveTo'),
      quadraticCurveTo: record('quadraticCurveTo'),
      arc: record('arc', [2]),
      ellipse: record('ellipse', [2, 3]),
      rect: record('rect'),
      fill: record('fill'),
      stroke: record('stroke'),
      fillRect: record('fillRect'),
      save: record('save'),
      restore: record('restore'),
      translate: record('translate'),
      rotate: record('rotate'),
      scale: record('scale'),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      lineCap: 'butt' as CanvasLineCap,
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;
    return { ctx, ops, problems };
  }

  function render(type: PlantType, petalCountModifier: number) {
    const base = makeGuardPlant(type);
    const plant = {
      ...base,
      variation: { ...getPlantVariation(type), complexity: 0.8, petalCountModifier },
    };
    const { ctx, ops, problems } = createOpRecorder();
    const pool = new GrowthProgressPool({ devMode: true });
    pool.beginFrame();
    drawPlant(ctx, plant, 800, 600, 1, pool);
    pool.endFrame();
    return { ops, problems };
  }

  function makeGuardPlant(type: PlantType): PlantData {
    return {
      id: 0,
      type,
      x: 0.5,
      maxHeight: 0.8,
      flowerColor: '#e85d75',
      stemColor: '#2d5a27',
      leafColor: '#228b22',
      delay: 0,
      growDuration: 1,
      seed: 4242,
      petals: 7,
      lean: 0.1,
      scale: 1,
      generation: 0,
    };
  }

  /** Grass blade base count is seeded: 3 + floor(seededRandom(seed) * 3) */
  const grassBase = 3 + Math.floor(seededRandom(4242) * 3);

  // [plant type, guarded formula, modifier at which the formula hits its minimum exactly]
  const cases: Array<[PlantType, string, number]> = [
    [PlantType.SimpleFlower, 'simple flower: max(3, petals + m), petals = 7', 3 - 7],
    [PlantType.Daisy, 'daisy: max(8, 12 + m)', 8 - 12],
    [PlantType.Wildflower, 'wildflower: max(3, 5 + m)', 3 - 5],
    [PlantType.Grass, 'grass: max(2, base + m)', 2 - grassBase],
    [PlantType.Fern, 'fern: max(4, 6 + m)', 4 - 6],
    [PlantType.Bush, 'bush: max(5, 8 + m)', 5 - 8],
    [PlantType.Lily, 'lily: max(4, 6 + m)', 4 - 6],
    [PlantType.Succulent, 'succulent: max(3, 6 + m)', 3 - 6],
    [PlantType.Sunflower, 'sunflower: max(8, 16 + m)', 8 - 16],
    [PlantType.Hydrangea, 'hydrangea: max(8, 20 + m)', 8 - 20],
    [PlantType.Dahlia, 'dahlia: max(4, 10 + layer*2 + m) for layers 0-3', 4 - 16],
    [PlantType.Vine, 'climber: max(1, 3 + floor(m)) flowers of max(3, 5 + m) petals', 1 - 3],
  ];

  it.each(cases)('%s clamps %s under an extreme negative modifier', (type, _formula, atMinimum) => {
    const extreme = render(type, -100);
    const boundary = render(type, atMinimum);

    expect(extreme.problems).toEqual([]);
    expect(boundary.problems).toEqual([]);
    expect(extreme.ops.length).toBeGreaterThan(0);
    // Clamped: going further negative than the minimum changes nothing
    expect(extreme.ops).toEqual(boundary.ops);
  });
});

describe('Path integrity', () => {
  // Canvas keeps a single "current path"; any beginPath() while another
  // shape is mid-construction silently discards it. These tests verify
  // that multi-segment plants stroke their complete path.

  interface PathOp {
    method: string;
    args: number[];
  }

  function createPathTrackingContext() {
    let currentPath: PathOp[] = [];
    const strokedPaths: PathOp[][] = [];

    const pathOp =
      (method: string) =>
      (...args: number[]) => {
        currentPath.push({ method, args });
      };

    const ctx = {
      beginPath: vi.fn(() => {
        currentPath = [];
      }),
      moveTo: pathOp('moveTo'),
      lineTo: pathOp('lineTo'),
      quadraticCurveTo: pathOp('quadraticCurveTo'),
      bezierCurveTo: pathOp('bezierCurveTo'),
      arc: pathOp('arc'),
      ellipse: pathOp('ellipse'),
      closePath: pathOp('closePath'),
      stroke: vi.fn(() => {
        strokedPaths.push([...currentPath]);
      }),
      fill: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      lineCap: 'butt' as CanvasLineCap,
      globalAlpha: 1,
      strokedPaths,
    } as unknown as CanvasRenderingContext2D & { strokedPaths: PathOp[][] };

    return ctx;
  }

  function makeClimberPlant(): PlantData {
    return {
      id: 0,
      type: PlantType.Vine,
      x: 0.5,
      maxHeight: 0.8,
      flowerColor: '#ff0000',
      stemColor: '#00ff00',
      leafColor: '#0000ff',
      delay: 0,
      growDuration: 1,
      seed: 42,
      petals: 5,
      lean: 0.1,
      scale: 1,
      generation: 0,
    };
  }

  it('strokes the complete climber vine as one uninterrupted path', () => {
    const ctx = createPathTrackingContext();
    const pool = new GrowthProgressPool({ devMode: false });
    const width = 1000;
    const height = 500;

    pool.beginFrame();
    drawPlant(ctx, makeClimberPlant(), width, height, 1, pool);
    pool.endFrame();

    // The vine is the stroked path that starts at the plant base
    const baseX = 0.5 * width;
    const vinePath = ctx.strokedPaths.find(
      (path) =>
        path.length > 0 &&
        path[0].method === 'moveTo' &&
        path[0].args[0] === baseX &&
        path[0].args[1] === height
    );

    expect(vinePath, 'no stroked path begins at the vine base').toBeDefined();

    // All 8 vine segments must be present in the stroked path
    const segments = vinePath!.filter((op) => op.method === 'quadraticCurveTo');
    expect(segments.length).toBe(8);

    // The vine path must not be contaminated by leaf geometry
    const leafOps = vinePath!.filter((op) => op.method === 'bezierCurveTo');
    expect(leafOps.length).toBe(0);
  });
});
