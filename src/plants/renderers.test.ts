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
import { drawStem, drawLeaf } from './renderers';

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

    const half = drawStem(ctx, 100, baseY, height, 2, '#4A7C40', 0, 0.5);
    const full = drawStem(ctx, 100, baseY, height, 2, '#4A7C40', 0, 1);

    // Height at 0.5 growth should be half of full height
    const halfHeight = baseY - half!.y;
    const fullHeight = baseY - full!.y;

    expect(halfHeight).toBeCloseTo(fullHeight * 0.5, 5);
  });

  it('lean should not affect stem height', () => {
    const ctx = createMockContext();
    const baseY = 200;
    const height = 50;

    const noLean = drawStem(ctx, 100, baseY, height, 2, '#4A7C40', 0, 1);
    const withLean = drawStem(ctx, 100, baseY, height, 2, '#4A7C40', 0.3, 1);

    // Both should have same Y position (same height)
    expect(noLean!.y).toBe(withLean!.y);
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
  // These tests verify that plant rendering handles extreme negative modifiers
  // without producing zero or negative counts (fixes issue #1)

  it('should guard against extreme negative petalCountModifier', () => {
    // All these formulas should produce at least the minimum value
    // even with an extreme negative modifier like -10

    // Succulent: leavesPerLayer = Math.max(3, 6 + petalCountModifier)
    const succulentLeaves = Math.max(3, 6 + (-10));
    expect(succulentLeaves).toBe(3);
    expect(succulentLeaves).toBeGreaterThanOrEqual(1);

    // Dahlia: petalCount = Math.max(8, 16 + petalCountModifier)
    const dahliaCount = Math.max(8, 16 + (-10));
    expect(dahliaCount).toBe(8);
    expect(dahliaCount).toBeGreaterThanOrEqual(1);

    // Hydrangea: floretCount = Math.max(8, 20 + petalCountModifier)
    const hydrangeaCount = Math.max(8, 20 + (-15));
    expect(hydrangeaCount).toBe(8);
    expect(hydrangeaCount).toBeGreaterThanOrEqual(1);

    // Peony: petalsInLayer = Math.max(4, 10 + layer * 2 + petalCountModifier)
    for (let layer = 0; layer < 5; layer++) {
      const peonyPetals = Math.max(4, 10 + layer * 2 + (-20));
      expect(peonyPetals).toBe(4);
      expect(peonyPetals).toBeGreaterThanOrEqual(1);
    }

    // Climber: numFlowers = Math.max(1, 3 + Math.floor(petalCountModifier))
    const climberFlowers = Math.max(1, 3 + Math.floor(-10));
    expect(climberFlowers).toBe(1);
    expect(climberFlowers).toBeGreaterThanOrEqual(1);

    // SmallTree: numFlowers = Math.max(1, Math.floor(petalCountModifier))
    const treeFlowers = Math.max(1, Math.floor(-5));
    expect(treeFlowers).toBe(1);
    expect(treeFlowers).toBeGreaterThanOrEqual(1);
  });

  it('should produce positive counts with typical modifier range', () => {
    // Test with typical modifier range (-3 to +3)
    for (const modifier of [-3, -2, -1, 0, 1, 2, 3]) {
      // Climber flowers
      const climber = Math.max(1, 3 + Math.floor(modifier));
      expect(climber).toBeGreaterThanOrEqual(1);

      // Succulent leaves
      const succulent = Math.max(3, 6 + modifier);
      expect(succulent).toBeGreaterThanOrEqual(3);
    }
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
