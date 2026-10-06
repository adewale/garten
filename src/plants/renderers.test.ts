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
import { drawStem, drawLeaf, drawPlant } from './renderers';
import { PlantType } from '../types';
import type { PlantData } from '../types';
import { getPlantVariation } from './variations';
import { seededRandom } from '../utils';
import { GrowthProgressPool } from '../GrowthProgressPool';

// Mock canvas context
function createMockContext(): CanvasRenderingContext2D {
  const paths: Array<{ method: string; args: number[] }> = [];

  return {
    beginPath: vi.fn(),
    moveTo: vi.fn((x, y) => paths.push({ method: 'moveTo', args: [x, y] })),
    lineTo: vi.fn((x, y) => paths.push({ method: 'lineTo', args: [x, y] })),
    bezierCurveTo: vi.fn((cp1x, cp1y, cp2x, cp2y, x, y) =>
      paths.push({ method: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] })),
    quadraticCurveTo: vi.fn((cpx, cpy, x, y) =>
      paths.push({ method: 'quadraticCurveTo', args: [cpx, cpy, x, y] })),
    arc: vi.fn(),
    ellipse: vi.fn(),
    stroke: vi.fn(),
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
    _paths: paths,
  } as unknown as CanvasRenderingContext2D & { _paths: typeof paths };
}

describe('drawStem', () => {
  it('should return null when growth is 0', () => {
    const ctx = createMockContext();
    const result = drawStem(ctx, 100, 200, 50, 2, '#4A7C40', 0, 0);
    expect(result).toBeNull();
  });

  it('should return null when growth is negative', () => {
    const ctx = createMockContext();
    const result = drawStem(ctx, 100, 200, 50, 2, '#4A7C40', 0, -0.5);
    expect(result).toBeNull();
  });

  it('should return stem tip position for full growth', () => {
    const ctx = createMockContext();
    const x = 100;
    const y = 200;
    const height = 50;
    const lean = 0.1;
    const growth = 1;

    const result = drawStem(ctx, x, y, height, 2, '#4A7C40', lean, growth);

    expect(result).not.toBeNull();
    // End position: x + lean * height, y - height
    expect(result!.x).toBe(x + lean * height);
    expect(result!.y).toBe(y - height);
  });

  it('should scale stem with partial growth', () => {
    const ctx = createMockContext();
    const x = 100;
    const y = 200;
    const height = 50;
    const lean = 0;
    const growth = 0.5;

    const result = drawStem(ctx, x, y, height, 2, '#4A7C40', lean, growth);

    expect(result).not.toBeNull();
    // At 50% growth, stem is half height
    expect(result!.x).toBe(x);
    expect(result!.y).toBe(y - height * 0.5);
  });

  it('should apply lean to stem tip', () => {
    const ctx = createMockContext();
    const x = 100;
    const y = 200;
    const height = 50;
    const lean = 0.2; // Positive lean = right
    const growth = 1;

    const result = drawStem(ctx, x, y, height, 2, '#4A7C40', lean, growth);

    expect(result).not.toBeNull();
    // Tip should be shifted right by lean * height
    expect(result!.x).toBeGreaterThan(x);
    expect(result!.x).toBe(x + lean * height);
  });

  it('should draw bezier curve with correct control points', () => {
    const ctx = createMockContext();
    const x = 100;
    const y = 200;
    const height = 50;
    const lean = 0.1;
    const growth = 1;

    drawStem(ctx, x, y, height, 2, '#4A7C40', lean, growth);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(x, y);
    expect(ctx.bezierCurveTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('should set correct stroke properties', () => {
    const ctx = createMockContext();
    const color = '#4A7C40';
    const thickness = 3;

    drawStem(ctx, 100, 200, 50, thickness, color, 0, 1);

    expect(ctx.strokeStyle).toBe(color);
    expect(ctx.lineWidth).toBe(thickness);
    expect(ctx.lineCap).toBe('round');
  });

  it('should clamp growth to 1', () => {
    const ctx = createMockContext();
    const x = 100;
    const y = 200;
    const height = 50;

    // Growth > 1 should be clamped
    const result = drawStem(ctx, x, y, height, 2, '#4A7C40', 0, 1.5);

    expect(result).not.toBeNull();
    expect(result!.y).toBe(y - height); // Full height, not 1.5x
  });
});

describe('drawLeaf', () => {
  it('should not draw when size is too small', () => {
    const ctx = createMockContext();

    drawLeaf(ctx, 100, 100, 0, 0.5, '#228B22');

    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it('should save and restore context', () => {
    const ctx = createMockContext();

    drawLeaf(ctx, 100, 100, Math.PI / 4, 15, '#228B22');

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('should translate to leaf position', () => {
    const ctx = createMockContext();
    const x = 100;
    const y = 150;

    drawLeaf(ctx, x, y, 0, 15, '#228B22');

    expect(ctx.translate).toHaveBeenCalledWith(x, y);
  });

  it('should rotate to specified angle', () => {
    const ctx = createMockContext();
    const angle = Math.PI / 4;

    drawLeaf(ctx, 100, 100, angle, 15, '#228B22');

    expect(ctx.rotate).toHaveBeenCalledWith(angle);
  });

  it('should set fill color', () => {
    const ctx = createMockContext();
    const color = '#228B22';

    drawLeaf(ctx, 100, 100, 0, 15, color);

    expect(ctx.fillStyle).toBe(color);
  });
});

describe('Stem position calculations', () => {
  // These tests verify the mathematical relationships that must hold
  // for correct stem rendering

  it('stem tip Y should always be above base Y', () => {
    const ctx = createMockContext();

    for (let growth = 0.1; growth <= 1; growth += 0.1) {
      const result = drawStem(ctx, 100, 200, 50, 2, '#4A7C40', 0, growth);
      expect(result!.y).toBeLessThan(200);
    }
  });

  it('stem height should be proportional to growth', () => {
    const ctx = createMockContext();
    const baseY = 200;
    const height = 50;

    // drawStem returns a shared object — capture values before next call
    const halfResult = drawStem(ctx, 100, baseY, height, 2, '#4A7C40', 0, 0.5);
    const halfY = halfResult!.y;
    const fullResult = drawStem(ctx, 100, baseY, height, 2, '#4A7C40', 0, 1);
    const fullY = fullResult!.y;

    // Height at 0.5 growth should be half of full height
    const halfHeight = baseY - halfY;
    const fullHeight = baseY - fullY;

    expect(halfHeight).toBeCloseTo(fullHeight * 0.5, 5);
  });

  it('lean should not affect stem height', () => {
    const ctx = createMockContext();
    const baseY = 200;
    const height = 50;

    // drawStem returns a shared object — capture values before next call
    const noLeanResult = drawStem(ctx, 100, baseY, height, 2, '#4A7C40', 0, 1);
    const noLeanY = noLeanResult!.y;
    const withLeanResult = drawStem(ctx, 100, baseY, height, 2, '#4A7C40', 0.3, 1);
    const withLeanY = withLeanResult!.y;

    // Both should have same Y position (same height)
    expect(noLeanY).toBe(withLeanY);
  });

  it('negative lean should lean left', () => {
    const ctx = createMockContext();
    const x = 100;

    const result = drawStem(ctx, x, 200, 50, 2, '#4A7C40', -0.2, 1);

    expect(result!.x).toBeLessThan(x);
  });

  it('positive lean should lean right', () => {
    const ctx = createMockContext();
    const x = 100;

    const result = drawStem(ctx, x, 200, 50, 2, '#4A7C40', 0.2, 1);

    expect(result!.x).toBeGreaterThan(x);
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

describe('Bezier control point calculations', () => {
  // These tests verify the bezier curve control point calculations
  // to ensure natural-looking stem curves

  it('control points should create S-curve for leaning stems', () => {
    const ctx = createMockContext() as CanvasRenderingContext2D & { _paths: Array<{ method: string; args: number[] }> };
    const x = 100;
    const y = 200;
    const height = 50;
    const lean = 0.2;

    drawStem(ctx, x, y, height, 2, '#4A7C40', lean, 1);

    // Get the bezierCurveTo call
    const bezierCall = (ctx.bezierCurveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    const [cp1x, cp1y, _cp2x, cp2y, endX, _endY] = bezierCall;

    // CP1 should be between start and end X
    expect(cp1x).toBeGreaterThanOrEqual(x);
    expect(cp1x).toBeLessThanOrEqual(endX);

    // CP1 should be at ~40% height
    expect(cp1y).toBeCloseTo(y - height * 0.4, 1);

    // CP2 should be at ~70% height
    expect(cp2y).toBeCloseTo(y - height * 0.7, 1);
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
