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
import { PlantType, PlantCategory } from '../types';
import type { PlantData, PlantVariation } from '../types';
import { GrowthProgressPool } from '../GrowthProgressPool';

interface StrictCtxState {
  violations: string[];
  flushes: number; // fill() + stroke() calls
}

function createStrictContext(): CanvasRenderingContext2D & StrictCtxState {
  const violations: string[] = [];
  // save()/restore() snapshot compositing state, as the real canvas does
  const stateStack: Array<{ alpha: number; composite: GlobalCompositeOperation }> = [];
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

  const ctx: CanvasRenderingContext2D & StrictCtxState = {
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
      stateStack.push({ alpha: ctx.globalAlpha, composite: ctx.globalCompositeOperation });
    },
    restore() {
      const state = stateStack.pop();
      if (!state) {
        violations.push('restore() without matching save()');
        return;
      }
      ctx.globalAlpha = state.alpha;
      ctx.globalCompositeOperation = state.composite;
    },
    translate: (...args: number[]) => checkFinite('translate', args),
    rotate: (...args: number[]) => checkFinite('rotate', args),
    scale: (...args: number[]) => checkFinite('scale', args),
    setTransform: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),

    get violations() {
      // End-of-draw checks are evaluated lazily by the test
      const result = [...violations];
      if (stateStack.length !== 0) {
        result.push(`unbalanced save/restore: depth ${stateStack.length} at end of draw`);
      }
      // Leaked compositing state would tint every plant drawn after this one
      if (ctx.globalAlpha !== 1) {
        result.push(`globalAlpha left at ${ctx.globalAlpha} at end of draw`);
      }
      if (ctx.globalCompositeOperation !== 'source-over') {
        result.push(
          `globalCompositeOperation left at '${ctx.globalCompositeOperation}' at end of draw`
        );
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

/**
 * Wraps the strict context in a recorder: every method call is logged with
 * its arguments rounded to 2 decimals, giving a renderer "op-stream" signature
 * that is stable across runs but distinguishes renderers.
 */
function createSignatureContext(): {
  ctx: CanvasRenderingContext2D & StrictCtxState;
  ops: string[];
} {
  const strict = createStrictContext();
  const ops: string[] = [];
  const fmt = (a: unknown) => (typeof a === 'number' ? a.toFixed(2) : String(a));
  const ctx = new Proxy(strict, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        ops.push(`${String(prop)}(${args.map(fmt).join(',')})`);
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  return { ctx, ops };
}

describe('Exhaustive: category dispatch routes to distinct renderers', () => {
  // A mis-routed category (e.g. Conifer drawn by the SimpleFlower renderer)
  // still draws *something* cleanly, so the sweep above cannot see it. Render
  // one plant per category with identical inputs (same seed, geometry and
  // variation) through the real type -> category -> renderer dispatch: any
  // two categories sharing a renderer then produce identical op streams.
  const ALL_CATEGORIES = Object.values(PlantCategory).filter(
    (c): c is PlantCategory => typeof c === 'number'
  );
  const NEUTRAL_VARIATION: PlantVariation = {
    sizeMultiplier: 1,
    heightMultiplier: 1,
    petalCountModifier: 0,
    thicknessMultiplier: 1,
    leanMultiplier: 1,
    complexity: 0.8, // above every detail threshold, so all branches draw
  };

  it('all 19 categories produce pairwise-distinct op-stream signatures at full growth', () => {
    expect(ALL_CATEGORIES).toHaveLength(19);
    const pool = new GrowthProgressPool({ devMode: true });
    const signatureOwner = new Map<string, PlantCategory>();
    const collisions: string[] = [];

    for (const category of ALL_CATEGORIES) {
      const type = ALL_PLANT_TYPES.find((t) => getPlantCategory(t) === category);
      expect(type, `no plant type in category ${PlantCategory[category]}`).toBeDefined();

      const { ctx, ops } = createSignatureContext();
      pool.beginFrame();
      // category left undefined so drawPlant resolves it from the type
      drawPlant(
        ctx,
        makePlant(type!, { maxHeight: 0.8, category: undefined, variation: NEUTRAL_VARIATION }),
        800,
        600,
        1,
        pool
      );
      pool.endFrame();

      expect(ctx.violations, PlantCategory[category]).toEqual([]);
      expect(ops.length, `${PlantCategory[category]} drew nothing`).toBeGreaterThan(0);

      const signature = ops.join(';');
      const owner = signatureOwner.get(signature);
      if (owner !== undefined) {
        collisions.push(`${PlantCategory[category]} renders identically to ${PlantCategory[owner]}`);
      } else {
        signatureOwner.set(signature, category);
      }
    }

    expect(collisions).toEqual([]);
  });
});
