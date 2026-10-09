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
 *
 * It also tracks the current transform (save()/restore() included) and the
 * exact device-space vertical extent of every path, plus the colors
 * assigned, for the properties at the end of this file.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { drawPlant } from './renderers';
import { getPlantCategory } from './generator';
import { getPlantVariation } from './variations';
import { PlantType, PlantCategory } from '../types';
import type { PlantData, PlantVariation } from '../types';
import { GrowthProgressPool } from '../GrowthProgressPool';
import { COLORS, OPTION_BOUNDS } from '../constants';

interface StrictCtxState {
  violations: string[];
  flushes: number; // fill() + stroke() calls
  /**
   * Vertical extent of all path geometry in device space (after the current
   * transform), exact for lines, curves and arcs. Path geometry is the
   * centerline: strokes extend lineWidth/2 beyond it.
   */
  extent: { minY: number; maxY: number };
  /** Every fillStyle/strokeStyle string assigned during the draw */
  styles: Set<string>;
}

/** Affine transform [a b c d e f], as in setTransform() */
type Matrix = [number, number, number, number, number, number];

const TWO_PI = Math.PI * 2;
const mod2pi = (angle: number): number => ((angle % TWO_PI) + TWO_PI) % TWO_PI;

/**
 * Extremes of y(t) = y0 + A cos t + B sin t over an arc's sweep (the
 * device-space y of any arc or ellipse under an affine transform), plus the
 * two endpoints. Sweep normalization follows the canvas spec: a sweep of
 * 2*PI or more is the full ellipse.
 */
function arcYExtremes(
  y0: number,
  A: number,
  B: number,
  start: number,
  end: number,
  ccw: boolean
): number[] {
  const at = (t: number) => y0 + A * Math.cos(t) + B * Math.sin(t);
  const raw = ccw ? start - end : end - start;
  const sweep = raw >= TWO_PI ? TWO_PI : mod2pi(raw);
  const ys = [at(start), at(ccw ? start - sweep : start + sweep)];
  const peak = Math.atan2(B, A);
  for (const t of [peak, peak + Math.PI]) {
    if (mod2pi(ccw ? start - t : t - start) <= sweep) ys.push(at(t));
  }
  return ys;
}

/** Extremes of a 1-D Bezier curve (quadratic or cubic) given its control values */
function bezierExtremes(values: number[]): number[] {
  const ys = [values[0], values[values.length - 1]];
  const roots: number[] = [];
  if (values.length === 3) {
    const [p0, p1, p2] = values;
    const denom = p0 - 2 * p1 + p2;
    if (denom !== 0) roots.push((p0 - p1) / denom);
  } else {
    const [p0, p1, p2, p3] = values;
    // derivative: 3[(p1-p0)(1-t)^2 + 2(p2-p1)(1-t)t + (p3-p2)t^2]
    const a = -p0 + 3 * p1 - 3 * p2 + p3;
    const b = 2 * (p0 - 2 * p1 + p2);
    const c = p1 - p0;
    // a t^2 + b t + c = 0, in the cancellation-free form (a may be ~0)
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(disc));
      if (a !== 0) roots.push(q / a);
      if (q !== 0) roots.push(c / q);
    }
  }
  for (const t of roots) {
    if (t > 0 && t < 1) {
      const u = 1 - t;
      ys.push(
        values.length === 3
          ? u * u * values[0] + 2 * u * t * values[1] + t * t * values[2]
          : u * u * u * values[0] + 3 * u * u * t * values[1] + 3 * u * t * t * values[2] +
              t * t * t * values[3]
      );
    }
  }
  return ys;
}

function createStrictContext(): CanvasRenderingContext2D & StrictCtxState {
  const violations: string[] = [];
  // save()/restore() snapshot compositing state and the transform, as the
  // real canvas does
  const stateStack: Array<{
    alpha: number;
    composite: GlobalCompositeOperation;
    matrix: Matrix;
  }> = [];
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  let pathOps = 0;
  let pathFlushed = true;
  let flushes = 0;
  // Current point in device space; paths are baked at construction time
  let cursorY: number | null = null;
  const extent = { minY: Infinity, maxY: -Infinity };
  const styles = new Set<string>();
  let fillStyle: unknown = '';
  let strokeStyle: unknown = '';

  const deviceY = (x: number, y: number) => matrix[1] * x + matrix[3] * y + matrix[5];
  const include = (ys: number[]) => {
    for (const y of ys) {
      if (y < extent.minY) extent.minY = y;
      if (y > extent.maxY) extent.maxY = y;
    }
  };
  // Records the device-space y extremes of an arc/ellipse with the given
  // radii and rotation, and moves the cursor to its end point
  const traceEllipse = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rotation: number,
    start: number,
    end: number,
    ccw: boolean
  ) => {
    const [, b, , d] = matrix;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const A = rx * (b * cosR + d * sinR);
    const B = ry * (d * cosR - b * sinR);
    const ys = arcYExtremes(deviceY(cx, cy), A, B, start, end, ccw);
    include(ys);
    cursorY = ys[1];
  };

  const checkFinite = (method: string, args: number[]) => {
    for (const a of args) {
      if (!Number.isFinite(a)) {
        violations.push(`${method} received non-finite argument (${args.join(', ')})`);
        return false;
      }
    }
    return true;
  };

  const flush = () => {
    pathFlushed = true;
    flushes++;
  };

  const ctx = {
    canvas: {} as HTMLCanvasElement,
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: unknown) {
      if (typeof value === 'string') styles.add(value);
      fillStyle = value;
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value: unknown) {
      if (typeof value === 'string') styles.add(value);
      strokeStyle = value;
    },

    beginPath() {
      if (pathOps > 0 && !pathFlushed) {
        violations.push(
          `beginPath() discarded an unflushed path with ${pathOps} op(s) — ` +
            'every constructed path must be filled or stroked first'
        );
      }
      pathOps = 0;
      pathFlushed = false;
      cursorY = null;
    },
    moveTo(x: number, y: number) {
      pathOps++;
      if (!checkFinite('moveTo', [x, y])) return;
      cursorY = deviceY(x, y);
      include([cursorY]);
    },
    lineTo(x: number, y: number) {
      pathOps++;
      if (!checkFinite('lineTo', [x, y])) return;
      cursorY = deviceY(x, y);
      include([cursorY]);
    },
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
      pathOps++;
      if (!checkFinite('quadraticCurveTo', [cpx, cpy, x, y])) return;
      const end = deviceY(x, y);
      include(bezierExtremes([cursorY ?? deviceY(cpx, cpy), deviceY(cpx, cpy), end]));
      cursorY = end;
    },
    bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
      pathOps++;
      if (!checkFinite('bezierCurveTo', [c1x, c1y, c2x, c2y, x, y])) return;
      const end = deviceY(x, y);
      include(
        bezierExtremes([cursorY ?? deviceY(c1x, c1y), deviceY(c1x, c1y), deviceY(c2x, c2y), end])
      );
      cursorY = end;
    },
    closePath: () => {},
    arc(x: number, y: number, r: number, start: number, end: number, ccw = false) {
      if (!checkFinite('arc', [x, y, r, start, end])) return;
      // Mirrors the DOM: negative radii throw IndexSizeError
      if (r < 0) throw new Error(`arc: negative radius ${r}`);
      pathOps++;
      traceEllipse(x, y, r, r, 0, start, end, ccw);
    },
    ellipse(
      x: number,
      y: number,
      rx: number,
      ry: number,
      rotation: number,
      start: number,
      end: number,
      ccw = false
    ) {
      if (!checkFinite('ellipse', [x, y, rx, ry, rotation, start, end])) return;
      if (rx < 0 || ry < 0) throw new Error(`ellipse: negative radius ${rx < 0 ? rx : ry}`);
      pathOps++;
      traceEllipse(x, y, rx, ry, rotation, start, end, ccw);
    },
    rect(x: number, y: number, w: number, h: number) {
      pathOps++;
      if (!checkFinite('rect', [x, y, w, h])) return;
      include([deviceY(x, y), deviceY(x + w, y), deviceY(x, y + h), deviceY(x + w, y + h)]);
      cursorY = deviceY(x, y);
    },
    fill: flush,
    stroke: flush,
    fillRect(x: number, y: number, w: number, h: number) {
      if (!checkFinite('fillRect', [x, y, w, h])) return;
      include([deviceY(x, y), deviceY(x + w, y), deviceY(x, y + h), deviceY(x + w, y + h)]);
      flushes++;
    },
    clearRect(...args: number[]) {
      checkFinite('clearRect', args);
    },
    save() {
      stateStack.push({
        alpha: ctx.globalAlpha,
        composite: ctx.globalCompositeOperation,
        matrix: [...matrix] as Matrix,
      });
    },
    restore() {
      const state = stateStack.pop();
      if (!state) {
        violations.push('restore() without matching save()');
        return;
      }
      ctx.globalAlpha = state.alpha;
      ctx.globalCompositeOperation = state.composite;
      matrix = state.matrix;
    },
    translate(tx: number, ty: number) {
      if (!checkFinite('translate', [tx, ty])) return;
      const [a, b, c, d, e, f] = matrix;
      matrix = [a, b, c, d, e + a * tx + c * ty, f + b * tx + d * ty];
    },
    rotate(angle: number) {
      if (!checkFinite('rotate', [angle])) return;
      const [a, b, c, d, e, f] = matrix;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      matrix = [a * cos + c * sin, b * cos + d * sin, c * cos - a * sin, d * cos - b * sin, e, f];
    },
    scale(sx: number, sy: number) {
      if (!checkFinite('scale', [sx, sy])) return;
      const [a, b, c, d, e, f] = matrix;
      matrix = [a * sx, b * sx, c * sy, d * sy, e, f];
    },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      if (!checkFinite('setTransform', [a, b, c, d, e, f])) return;
      matrix = [a, b, c, d, e, f];
    },
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
    extent,
    styles,
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
});

/**
 * Wraps the strict context in a recorder: every method call is logged with
 * its arguments (rounded to 2 decimals unless `exact`), giving a renderer
 * "op-stream" signature that is stable across runs but distinguishes renderers.
 */
function createSignatureContext(exact = false): {
  ctx: CanvasRenderingContext2D & StrictCtxState;
  ops: string[];
} {
  const strict = createStrictContext();
  const ops: string[] = [];
  // `exact` keeps full precision, for comparisons that must be bit-for-bit
  const fmt = (a: unknown) => (typeof a === 'number' && !exact ? a.toFixed(2) : String(a));
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

describe('Property: the strict mock\'s vertical extent is exact', () => {
  // The bounds properties below trust createStrictContext's closed-form
  // curve and arc extremes; check them against dense sampling of the same
  // shapes. Sampling can only under-reach the true extremes, so every sample
  // must lie inside the extent and the extent must be reached to within the
  // sampling step.
  const coord = fc.double({ min: -1000, max: 1000, noNaN: true });
  const angle = fc.double({ min: -10, max: 10, noNaN: true });
  const STEPS = 1000;
  const close = (a: number, b: number, span: number) => Math.abs(a - b) <= span * 1e-5 + 1e-9;

  it('matches sampled cubic Bezier curves under rotation and translation', () => {
    fc.assert(
      fc.property(fc.array(coord, { minLength: 8, maxLength: 8 }), angle, coord, (p, rot, ty) => {
        const ctx = createStrictContext();
        ctx.translate(0, ty);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]);
        ctx.stroke();
        const ys: number[] = [];
        for (let i = 0; i <= STEPS; i++) {
          const t = i / STEPS;
          const u = 1 - t;
          const x = u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6];
          const y = u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7];
          ys.push(Math.sin(rot) * x + Math.cos(rot) * y + ty);
        }
        const span = Math.max(...ys) - Math.min(...ys) + 1;
        const slack = 1e-9 * span;
        const inside = (y: number) => y >= ctx.extent.minY - slack && y <= ctx.extent.maxY + slack;
        expect(ys.every(inside)).toBe(true);
        expect(close(Math.min(...ys), ctx.extent.minY, span)).toBe(true);
        expect(close(Math.max(...ys), ctx.extent.maxY, span)).toBe(true);
      }),
      {
        numRuns: 5,
        // Near-zero leading coefficient: the textbook quadratic formula
        // cancelled catastrophically here (a bug in this mock, now fixed)
        examples: [[[0, 999.9999999997801, 0, 0, 0, 0, 0, 999.9999999961984], 0, 0]],
      }
    );
  });

  it('matches sampled quadratic Bezier curves under rotation', () => {
    fc.assert(
      fc.property(fc.array(coord, { minLength: 6, maxLength: 6 }), angle, (p, rot) => {
        const ctx = createStrictContext();
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.quadraticCurveTo(p[2], p[3], p[4], p[5]);
        ctx.stroke();
        const ys: number[] = [];
        for (let i = 0; i <= STEPS; i++) {
          const t = i / STEPS;
          const u = 1 - t;
          const x = u * u * p[0] + 2 * u * t * p[2] + t * t * p[4];
          const y = u * u * p[1] + 2 * u * t * p[3] + t * t * p[5];
          ys.push(Math.sin(rot) * x + Math.cos(rot) * y);
        }
        const span = Math.max(...ys) - Math.min(...ys) + 1;
        expect(close(Math.min(...ys), ctx.extent.minY, span)).toBe(true);
        expect(close(Math.max(...ys), ctx.extent.maxY, span)).toBe(true);
      }),
      { numRuns: 5 }
    );
  });

  it('matches sampled elliptical arcs in both directions under rotation', () => {
    fc.assert(
      fc.property(
        coord, coord,
        fc.double({ min: 0, max: 500, noNaN: true }),
        fc.double({ min: 0, max: 500, noNaN: true }),
        angle, angle, angle, angle, fc.boolean(),
        (cx, cy, rx, ry, ellipseRot, start, end, rot, ccw) => {
          const ctx = createStrictContext();
          ctx.rotate(rot);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, ellipseRot, start, end, ccw);
          ctx.fill();
          // Canvas spec sweep: a sweep of 2*PI or more is the full ellipse
          const raw = ccw ? start - end : end - start;
          const sweep = raw >= TWO_PI ? TWO_PI : mod2pi(raw);
          const ys: number[] = [];
          for (let i = 0; i <= STEPS; i++) {
            const t = start + (ccw ? -1 : 1) * sweep * (i / STEPS);
            const ex = rx * Math.cos(t);
            const ey = ry * Math.sin(t);
            const x = cx + ex * Math.cos(ellipseRot) - ey * Math.sin(ellipseRot);
            const y = cy + ex * Math.sin(ellipseRot) + ey * Math.cos(ellipseRot);
            ys.push(Math.sin(rot) * x + Math.cos(rot) * y);
          }
          const span = Math.max(...ys) - Math.min(...ys) + 1;
          expect(close(Math.min(...ys), ctx.extent.minY, span)).toBe(true);
          expect(close(Math.max(...ys), ctx.extent.maxY, span)).toBe(true);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ==================== PROPERTIES OVER THE FULL DRAW DOMAIN ====================

/**
 * Plant fields are drawn from the generator's output envelope
 * (generatePlants in generator.ts: scale max(0.1, 0.7-1.2), lean +-0.15,
 * petals 5-8, growDuration >= 0.1, delay within the 86400s duration bound),
 * with maxHeight over all of [0, 1] and any hex colors. The canvas side
 * covers what Renderer.resize can hand drawPlant: a 0x0 container (the
 * initial size, kept while the container is hidden), tiny and huge
 * containers, and every legal maxPixelRatio (0.5-4) as the device transform.
 */
const hexColor = fc
  .integer({ min: 0, max: 0xffffff })
  .map((n) => `#${n.toString(16).padStart(6, '0')}`);
const containerSide = fc.oneof(
  fc.constant(0),
  fc.double({ min: 0, max: 8, noNaN: true }),
  fc.double({ min: 8, max: 4000, noNaN: true }),
  fc.double({ min: 4000, max: 100_000, noNaN: true })
);
const { MAX_PIXEL_RATIO } = OPTION_BOUNDS;
const dpr = fc.double({ min: MAX_PIXEL_RATIO.min, max: MAX_PIXEL_RATIO.max, noNaN: true });

const plantArb = fc.record({
  type: fc.constantFrom(...ALL_PLANT_TYPES),
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  maxHeight: fc.double({ min: 0, max: 1, noNaN: true }),
  scale: fc.double({ min: 0.1, max: 1.2, noNaN: true }),
  lean: fc.double({ min: -0.15, max: 0.15, noNaN: true }),
  petals: fc.integer({ min: 5, max: 8 }),
  seed: fc.integer({ min: 0, max: 1e9 }),
  flowerColor: hexColor,
  stemColor: hexColor,
  leafColor: hexColor,
  delay: fc.double({ min: 0, max: OPTION_BOUNDS.DURATION.max, noNaN: true }),
  growDuration: fc.double({ min: 0.1, max: OPTION_BOUNDS.DURATION.max, noNaN: true }),
});
type PlantFields = typeof plantArb extends fc.Arbitrary<infer T> ? T : never;

/**
 * Where in the plant's lifecycle to draw, as a multiple of growDuration
 * after its delay: before the start, the exact start and end, during,
 * after the end, and the infinite extremes.
 */
const lifecycle = fc.oneof(
  fc.double({ min: -3, max: 0, noNaN: true }),
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.double({ min: 1, max: 1e6, noNaN: true }),
  fc.constantFrom(-Infinity, 0, 1, Infinity)
);

const sceneArb = fc.record({ plant: plantArb, width: containerSide, height: containerSide, dpr });
type Scene = typeof sceneArb extends fc.Arbitrary<infer T> ? T : never;
const drawArb = fc.record({ scene: sceneArb, at: lifecycle });
type DrawCase = typeof drawArb extends fc.Arbitrary<infer T> ? T : never;

const toPlant = (fields: PlantFields): PlantData => makePlant(fields.type, fields);
const timeAt = (plant: { delay: number; growDuration: number }, at: number): number =>
  plant.delay + plant.growDuration * at;

/** Draws one plant the way Renderer does: device transform first, then drawPlant */
function drawOnce(
  ctx: CanvasRenderingContext2D,
  plant: PlantData,
  c: Pick<Scene, 'width' | 'height' | 'dpr'>,
  time: number
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(c.dpr, c.dpr);
  const pool = new GrowthProgressPool({ devMode: true });
  pool.beginFrame();
  drawPlant(ctx, plant, c.width, c.height, time, pool);
  pool.endFrame();
}

/** A scene with neutral plant fields, for pinned examples */
function sceneOf(type: PlantType, fields: Partial<PlantFields> = {}): Scene {
  return {
    plant: {
      type,
      x: 0.5,
      maxHeight: 0.5,
      scale: 1,
      lean: 0,
      petals: 5,
      seed: 4242,
      flowerColor: '#e85d75',
      stemColor: '#2d5a27',
      leafColor: '#228b22',
      delay: 0,
      growDuration: 1,
      ...fields,
    },
    width: 800,
    height: 600,
    dpr: 1,
  };
}

/** Every type's tallest and smallest-legal-scale corners, pinned (formerly a hand-picked loop) */
const CORNER_EXAMPLES: Array<[DrawCase]> = ALL_PLANT_TYPES.flatMap((type) =>
  [
    { scale: 0.1, lean: -0.15, maxHeight: 0.5 },
    { scale: 1.2, lean: 0.15, maxHeight: 1 },
    { scale: 1, lean: 0.15, maxHeight: 0.05 },
  ].map((corner): [DrawCase] => [
    {
      scene: { ...sceneOf(type, corner), width: 800, height: 600, dpr: 1 },
      at: 1,
    },
  ])
);

describe('Property: drawPlant over plant data, lifecycle time, container size and DPR', () => {
  it('obeys the strict canvas contract on every draw', () => {
    fc.assert(
      fc.property(drawArb, ({ scene, at }) => {
        const ctx = createStrictContext();
        const plant = toPlant(scene.plant);
        drawOnce(ctx, plant, scene, timeAt(plant, at));
        expect(ctx.violations).toEqual([]);
      }),
      { numRuns: 5, examples: CORNER_EXAMPLES }
    );
  });

  it('draws nothing at or before its start time', () => {
    fc.assert(
      fc.property(sceneArb, fc.double({ min: 0, max: 1e6, noNaN: true }), (scene, before) => {
        const { ctx, ops } = createSignatureContext();
        const plant = toPlant(scene.plant);
        drawOnce(ctx, plant, scene, plant.delay - plant.growDuration * before);
        // Only drawOnce's own device transform may appear
        expect(ops.filter((op) => !/^(setTransform|scale)\(/.test(op))).toEqual([]);
      }),
      { numRuns: 5 }
    );
  });

  it('draws exactly the fully grown plant from its end time on', () => {
    // A plant ends at delay + growDuration (getGenerationEndTimes fires
    // generationComplete there), and growth is clamped at 1 after it, so
    // every time from the end on must give the same frame as the limit
    // t = Infinity, bit for bit.
    // FINDING (reported to the lead, not yet fixed): (t - delay) / growDuration
    // rounds below 1 at t = delay + growDuration for many delays, so the
    // plant is drawn a hair short of fully grown at its own end time (the
    // pinned example: progress 0.9999999999999432, petals 0.8999999999998977
    // instead of 0.9). The same happens a few ulps past the end.
    fc.assert(
      fc.property(sceneArb, fc.double({ min: 1, max: 1e6, noNaN: true }), (scene, after) => {
        const plant = toPlant(scene.plant);
        const late = createSignatureContext(true);
        drawOnce(late.ctx, plant, scene, timeAt(plant, after));
        const limit = createSignatureContext(true);
        drawOnce(limit.ctx, plant, scene, Infinity);
        expect(late.ops).toEqual(limit.ops);
      }),
      {
        numRuns: 5,
        examples: [
          [{ ...sceneOf(PlantType.SimpleFlower, { delay: 63.99423915843511, growDuration: 0.1 }) }, 1],
        ],
      }
    );
  });

  it("paints only the plant's own colors and the library's fixed accent colors", () => {
    const accents = new Set<string>(Object.values(COLORS));
    fc.assert(
      fc.property(drawArb, ({ scene, at }) => {
        const ctx = createStrictContext();
        const plant = toPlant(scene.plant);
        drawOnce(ctx, plant, scene, timeAt(plant, at));
        const own = new Set([plant.flowerColor, plant.stemColor, plant.leafColor]);
        expect([...ctx.styles].filter((s) => !own.has(s) && !accents.has(s))).toEqual([]);
      }),
      { numRuns: 5 }
    );
  });
});
