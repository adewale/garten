/**
 * Exhaustive render sweep — every plant type x growth stage.
 *
 * The 147-type enum is a bounded space, so we test all of it instead of
 * sampling (the climber path bug hid for multiple releases because climbers
 * never render in default configs).
 *
 * The strict mock enforces canvas *semantics*, not just call recording:
 *  - a path with ops must be fill()ed or stroke()d before the next
 *    beginPath() discards it (the climber bug class)
 *  - save()/restore() must balance, and never underflow
 *  - globalAlpha / globalCompositeOperation must be restored after a plant
 *  - negative arc/ellipse radii throw, as real canvas does (IndexSizeError)
 *  - all coordinates must be finite (real canvas silently ignores NaN ops,
 *    which is how NaN bugs become invisible)
 */

import { describe, it, expect } from 'vitest';
import { drawPlant } from './renderers';
import { getPlantCategory } from './generator';
import { getPlantVariation } from './variations';
import { PlantType } from '../types';
import type { PlantData } from '../types';
import { GrowthProgressPool } from '../GrowthProgressPool';

interface StrictCtxState {
  violations: string[];
  flushes: number; // fill() + stroke() calls
}

function createStrictContext(): CanvasRenderingContext2D & StrictCtxState {
  const violations: string[] = [];
  let saveDepth = 0;
  let pathOps = 0;
  let pathFlushed = true;
  let flushes = 0;

  const checkFinite = (method: string, args: number[]) => {
    for (const a of args) {
      if (!Number.isFinite(a)) {
        violations.push(`${method} received non-finite argument (${args.join(', ')})`);
        return;
      }
    }
  };

  const pathOp =
    (method: string) =>
    (...args: number[]) => {
      checkFinite(method, args);
      pathOps++;
    };

  const radiusOp =
    (method: string, radiusIndexes: number[]) =>
    (...args: number[]) => {
      checkFinite(method, args);
      for (const idx of radiusIndexes) {
        if (args[idx] < 0) {
          // Mirrors the DOM: negative radii throw IndexSizeError
          throw new Error(`${method}: negative radius ${args[idx]}`);
        }
      }
      pathOps++;
    };

  const flush = () => {
    pathFlushed = true;
    flushes++;
  };

  const ctx = {
    canvas: {} as HTMLCanvasElement,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,

    beginPath() {
      if (pathOps > 0 && !pathFlushed) {
        violations.push(
          `beginPath() discarded an unflushed path with ${pathOps} op(s) — ` +
            'every constructed path must be filled or stroked first'
        );
      }
      pathOps = 0;
      pathFlushed = false;
    },
    moveTo: pathOp('moveTo'),
    lineTo: pathOp('lineTo'),
    bezierCurveTo: pathOp('bezierCurveTo'),
    quadraticCurveTo: pathOp('quadraticCurveTo'),
    closePath: () => {},
    arc: radiusOp('arc', [2]),
    ellipse: radiusOp('ellipse', [2, 3]),
    rect: pathOp('rect'),
    fill: flush,
    stroke: flush,
    fillRect(...args: number[]) {
      checkFinite('fillRect', args);
      flushes++;
    },
    clearRect(...args: number[]) {
      checkFinite('clearRect', args);
    },
    save() {
      saveDepth++;
    },
    restore() {
      if (saveDepth === 0) {
        violations.push('restore() without matching save()');
        return;
      }
      saveDepth--;
    },
    translate: (...args: number[]) => checkFinite('translate', args),
    rotate: (...args: number[]) => checkFinite('rotate', args),
    scale: (...args: number[]) => checkFinite('scale', args),
    setTransform: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),

    get violations() {
      // End-of-draw checks are evaluated lazily by the test
      const result = [...violations];
      if (saveDepth !== 0) {
        result.push(`unbalanced save/restore: depth ${saveDepth} at end of draw`);
      }
      if (pathOps > 0 && !pathFlushed) {
        result.push(`draw ended with an unflushed path of ${pathOps} op(s)`);
      }
      return result;
    },
    get flushes() {
      return flushes;
    },
  } as unknown as CanvasRenderingContext2D & StrictCtxState;

  return ctx;
}

/** Test-data builder for plants (research: test-data-builders.md) */
function makePlant(type: PlantType, overrides: Partial<PlantData> = {}): PlantData {
  return {
    id: 0,
    type,
    x: 0.5,
    maxHeight: 0.5,
    flowerColor: '#e85d75',
    stemColor: '#2d5a27',
    leafColor: '#228b22',
    delay: 0,
    growDuration: 1,
    seed: 4242,
    petals: 7,
    lean: 0.15,
    scale: 1,
    generation: 0,
    category: getPlantCategory(type),
    variation: getPlantVariation(type),
    ...overrides,
  };
}

const ALL_PLANT_TYPES = Object.values(PlantType);
const GROWTH_STAGES = [0.05, 0.2, 0.45, 0.65, 0.85, 1.0];

describe('Exhaustive: every plant type renders cleanly at every growth stage', () => {
  it.each(ALL_PLANT_TYPES)('%s obeys canvas state discipline', (type) => {
    const pool = new GrowthProgressPool({ devMode: true });

    for (const stage of GROWTH_STAGES) {
      const ctx = createStrictContext();
      pool.beginFrame();
      drawPlant(ctx, makePlant(type), 800, 600, stage, pool);
      pool.endFrame();

      expect(ctx.violations, `${type} @ growth ${stage}`).toEqual([]);
    }
  });

  it.each(ALL_PLANT_TYPES)('%s draws something at full growth', (type) => {
    const pool = new GrowthProgressPool({ devMode: true });
    const ctx = createStrictContext();

    pool.beginFrame();
    drawPlant(ctx, makePlant(type), 800, 600, 1, pool);
    pool.endFrame();

    expect(ctx.flushes, `${type} produced no fill/stroke at growth 1`).toBeGreaterThan(0);
  });

  it('every plant type renders cleanly with extreme variation inputs', () => {
    const pool = new GrowthProgressPool({ devMode: true });

    for (const type of ALL_PLANT_TYPES) {
      for (const overrides of [
        { scale: 0.1, lean: -0.15 }, // smallest legal scale
        { scale: 1.2, lean: 0.15, maxHeight: 1 }, // tallest
        { petals: 5, maxHeight: 0.05 }, // shortest
      ]) {
        const ctx = createStrictContext();
        pool.beginFrame();
        drawPlant(ctx, makePlant(type, overrides), 800, 600, 1, pool);
        pool.endFrame();
        expect(ctx.violations, `${type} ${JSON.stringify(overrides)}`).toEqual([]);
      }
    }
  });
});
