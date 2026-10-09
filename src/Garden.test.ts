/**
 * Garden + Renderer lifecycle tests
 * Exercises the public GardenController contract end-to-end with a mocked
 * canvas 2D context and fake timers (rAF + performance).
 *
 * These cover the seams unit tests miss: constructor wiring, the animation
 * loop, resize behavior, option updates, events, and teardown.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Garten } from './Garden';
import { Renderer } from './Renderer';
import { resolveOptions } from './defaults';
import { generatePlants } from './plants/generator';
import type { GardenOptions } from './types';

// ==================== CANVAS MOCK ====================

interface RecordedCall {
  method: string;
  args: unknown[];
  fillStyle: string;
  composite: string;
}

// A few named colors, normalized the way a real 2D context reports them
const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  red: '#ff0000',
  rebeccapurple: '#663399',
  transparent: 'rgba(0, 0, 0, 0)',
};

/**
 * Mimic the 2D context's fillStyle setter: valid colors are normalized,
 * invalid strings are ignored (the previous value is kept)
 */
function normalizeFillStyle(value: unknown, previous: unknown): unknown {
  if (typeof value !== 'string') return value; // gradients/patterns
  const lower = value.trim().toLowerCase();
  if (lower in NAMED_COLORS) return NAMED_COLORS[lower];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(lower)) return value;
  if (/^rgba?\([^)]*\)$/.test(lower)) return value;
  return previous;
}

interface MockCtx2D {
  calls: RecordedCall[];
  gradient: { addColorStop: ReturnType<typeof vi.fn> };
  callCount(method: string): number;
  reset(): void;
}

function createMockContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D & MockCtx2D {
  const calls: RecordedCall[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({
        method,
        args,
        fillStyle: String(ctx.fillStyle),
        composite: String(ctx.globalCompositeOperation),
      });
    };

  const gradient = { addColorStop: vi.fn() };
  let fillStyle: unknown = '#000000';

  const ctx = {
    canvas,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: unknown) {
      fillStyle = normalizeFillStyle(value, fillStyle);
    },
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillRect: record('fillRect'),
    clearRect: record('clearRect'),
    strokeRect: record('strokeRect'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    bezierCurveTo: record('bezierCurveTo'),
    quadraticCurveTo: record('quadraticCurveTo'),
    arc: record('arc'),
    ellipse: record('ellipse'),
    fill: record('fill'),
    stroke: record('stroke'),
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    scale: record('scale'),
    setTransform: record('setTransform'),
    createLinearGradient: vi.fn(() => gradient),
    gradient,
    createRadialGradient: vi.fn(() => gradient),
    calls,
    callCount(method: string) {
      return calls.filter((c) => c.method === method).length;
    },
    reset() {
      calls.length = 0;
    },
  } as unknown as CanvasRenderingContext2D & MockCtx2D;

  return ctx;
}

let lastCtx: (CanvasRenderingContext2D & MockCtx2D) | null = null;

function makeContainer(width = 800, height = 600): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  return container;
}

function makeGarden(overrides: Partial<GardenOptions> = {}): {
  garden: Garten;
  container: HTMLElement;
  ctx: CanvasRenderingContext2D & MockCtx2D;
} {
  const container = makeContainer();
  const garden = new Garten({
    container,
    seed: 42,
    autoplay: false,
    duration: 10,
    generations: 10,
    density: 'sparse',
    respectReducedMotion: false,
    ...overrides,
  });
  return { garden, container, ctx: lastCtx! };
}

const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  });
  vi.stubGlobal('matchMedia', mockMatchMedia);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement
  ) {
    lastCtx = createMockContext2D(this);
    return lastCtx as unknown as CanvasRenderingContext2D;
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  lastCtx = null;
});

/** Draw operations of the last frame (from its clear), without carried-over state */
function frameOps(calls: RecordedCall[]): Array<{ method: string; args: unknown[] }> {
  const start = calls.map((c) => c.method).lastIndexOf('clearRect');
  return calls.slice(Math.max(0, start)).map(({ method, args }) => ({ method, args }));
}

/** Advance fake time and deliver one animation frame */
function advanceFrame(ms = 0): void {
  if (ms > 0) vi.advanceTimersByTime(ms);
  vi.advanceTimersToNextFrame();
}

// ==================== GENERATORS ====================

type Command =
  | { kind: 'play' }
  | { kind: 'pause' }
  | { kind: 'stop' }
  | { kind: 'seek'; time: number }
  | { kind: 'setSpeed'; speed: number }
  | { kind: 'advance'; ms: number }
  | { kind: 'regenerate' };

// Seek times are drawn relative to the duration so that "exactly the end",
// "past the end" and "before the start" all occur; frame spacing mixes
// sub-frame-interval gaps (throttling) with long gaps (completion, wrap)
type SeekCommand = { kind: 'seek'; fraction: number };
type RawCommand = Exclude<Command, { kind: 'seek' }> | SeekCommand;

const rawCommandArb: fc.Arbitrary<RawCommand> = fc.oneof(
  fc.constant({ kind: 'play' as const }),
  fc.constant({ kind: 'pause' as const }),
  fc.constant({ kind: 'stop' as const }),
  fc.record({
    kind: fc.constant('seek' as const),
    fraction: fc.oneof(
      fc.double({ min: -1, max: 2, noNaN: true }),
      fc.constantFrom(0, 1, NaN, Infinity, -Infinity)
    ),
  }),
  fc.record({
    kind: fc.constant('setSpeed' as const),
    speed: fc.oneof(
      fc.double({ min: 0.01, max: 100, noNaN: true }),
      fc.double({ min: 1e-6, max: 0.01, noNaN: true }),
      fc.double({ min: 100, max: 1e6, noNaN: true }),
      fc.constantFrom(0, -1, NaN, Infinity)
    ),
  }),
  fc.record({
    kind: fc.constant('advance' as const),
    ms: fc.oneof(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 1, max: 4000 })),
  }),
  fc.constant({ kind: 'regenerate' as const })
);

interface Model {
  state: 'idle' | 'playing' | 'paused' | 'complete';
  elapsed: number;
  pausedAt: number;
  speed: number;
  startTime: number;
  lastFrameTime: number;
  lastReported: number;
  /** Every event the garden should have emitted, in order */
  log: string[];
}

/** Events that also have a legacy `options.events` callback */
const LEGACY_EVENTS = ['state', 'generation', 'progress', 'complete'];

const timingCurveArb = fc.oneof(
  fc.constantFrom('linear' as const, 'ease-out' as const, 'ease-in' as const, 'ease-in-out' as const),
  fc.double({ min: 0.1, max: 10, noNaN: true })
);

const configArb = fc.record({
  seed: fc.integer({ min: 0, max: 1e9 - 1 }),
  duration: fc.double({ min: 1, max: 20, noNaN: true }),
  generations: fc.integer({ min: 1, max: 8 }),
  density: fc.constantFrom('sparse' as const, 'normal' as const, 'dense' as const, 'lush' as const),
  timingCurve: timingCurveArb,
  speed: fc.double({ min: 0.01, max: 100, noNaN: true }),
  targetFPS: fc.integer({ min: 1, max: 120 }),
  loop: fc.boolean(),
  autoplay: fc.boolean(),
});

type Config = typeof configArb extends fc.Arbitrary<infer T> ? T : never;

/**
 * Reference for "generations fully grown at time t": the generation count
 * whose plants (and all earlier generations' plants) have all finished.
 * Deliberately naive, independent of getGenerationEndTimes().
 */
function referenceCompleted(config: Config, container: HTMLElement): (t: number) => number {
  const plants = generatePlants(resolveOptions({ container, ...config }));
  const ends = Array.from({ length: config.generations }, (_, g) =>
    Math.min(
      config.duration,
      Math.max(0, ...plants.filter((p) => p.generation <= g).map((p) => p.delay + p.growDuration))
    )
  );
  return (t) => (t > 0 ? ends.filter((end) => end <= t).length : 0);
}

// Regressions pinned from bugs this suite has caught (fast-check `examples`)
const baseConfig: Config = {
  seed: 42,
  duration: 10,
  generations: 4,
  density: 'sparse',
  timingCurve: 'linear',
  speed: 1,
  targetFPS: 30,
  loop: false,
  autoplay: false,
};
const pinned: Array<[Config, RawCommand[]]> = [
  // pause() must remember the position (play resumed from 0)
  [baseConfig, [{ kind: 'play' }, { kind: 'advance', ms: 2000 }, { kind: 'pause' }, { kind: 'advance', ms: 3000 }, { kind: 'play' }, { kind: 'advance', ms: 500 }]],
  // a background tab jumps several generations in one frame
  [{ ...baseConfig, timingCurve: 'ease-out' }, [{ kind: 'play' }, { kind: 'advance', ms: 100 }, { kind: 'advance', ms: 6000 }]],
  // seeking back from complete is resumable
  [baseConfig, [{ kind: 'seek', fraction: 1 }, { kind: 'seek', fraction: 0.4 }, { kind: 'play' }, { kind: 'advance', ms: 100 }]],
  // the loop wraps and re-fires generation events from 1
  [{ ...baseConfig, loop: true }, [{ kind: 'play' }, { kind: 'advance', ms: 10200 }, { kind: 'advance', ms: 1300 }]],
];

/** Render one frame of a garden with the given fade, sized w x h */
function fadeFrame(overrides: Partial<GardenOptions>, width = 800, height = 600) {
  const container = makeContainer(width, height);
  const garden = new Garten({
    container,
    seed: 42,
    autoplay: false,
    duration: 10,
    generations: 3,
    density: 'sparse',
    respectReducedMotion: false,
    ...overrides,
  });
  const ctx = lastCtx!;
  garden.seek(5);
  garden.destroy();
  return ctx;
}

const byte = fc.integer({ min: 0, max: 255 });
const hex2 = (n: number) => n.toString(16).padStart(2, '0');

/** A color and every notation for it the fade must accept */
const fadeColorArb = fc
  .record({ r: byte, g: byte, b: byte, a: fc.integer({ min: 1, max: 255 }) })
  .chain(({ r, g, b, a }) => {
    const alpha = a / 255;
    const opaque = [`#${hex2(r)}${hex2(g)}${hex2(b)}`, `rgb(${r}, ${g}, ${b})`].map((css) => ({
      css,
      stop: `rgba(${r}, ${g}, ${b}, 1)`,
    }));
    const translucent = [
      { css: `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a)}`, stop: `rgba(${r}, ${g}, ${b}, ${alpha})` },
      { css: `rgba(${r}, ${g}, ${b}, ${alpha})`, stop: `rgba(${r}, ${g}, ${b}, ${alpha})` },
    ];
    const short =
      r % 17 === 0 && g % 17 === 0 && b % 17 === 0
        ? [{ css: `#${(r / 17).toString(16)}${(g / 17).toString(16)}${(b / 17).toString(16)}`, stop: `rgba(${r}, ${g}, ${b}, 1)` }]
        : [];
    return fc.constantFrom(...opaque, ...translucent, ...short);
  });

// ==================== BACKGROUND (H-3) ====================

describe('Constraint: canvas background', () => {
  it('clears to transparent by default instead of painting opaque white', () => {
    const { garden, ctx } = makeGarden();
    garden.seek(5);

    expect(ctx.callCount('clearRect')).toBeGreaterThan(0);
    const whiteFills = ctx.calls.filter(
      (c) => c.method === 'fillRect' && c.fillStyle.toLowerCase() === '#ffffff'
    );
    expect(whiteFills.length).toBe(0);
    garden.destroy();
  });

  it('fills the whole canvas with any configured background color, first', () => {
    fc.assert(
      fc.property(fadeColorArb, fc.integer({ min: 1, max: 3000 }), fc.integer({ min: 1, max: 3000 }), ({ css }, w, h) => {
        const container = makeContainer(w, h);
        const garden = new Garten({ container, seed: 1, autoplay: false, generations: 2, respectReducedMotion: false, background: css });
        const ctx = lastCtx!;
        ctx.reset();
        garden.seek(1);
        const [first] = ctx.calls;
        expect(first).toMatchObject({ method: 'fillRect', args: [0, 0, w, h], fillStyle: css });
        expect(ctx.callCount('clearRect')).toBe(0);
        garden.destroy();
      }),
      { numRuns: 200 }
    );
  });
});

// ==================== RESIZE (H-4) ====================

describe('Constraint: resize preserves the rendered frame', () => {
  it('re-renders the last frame after resize while not playing', () => {
    const container = makeContainer();
    const resolved = resolveOptions({ container, seed: 42, duration: 10, generations: 5 });
    const renderer = new Renderer(resolved);
    const ctx = lastCtx!;
    const plants = generatePlants(resolved);

    renderer.render(plants, 9); // late time => most plants visible
    const drawsAfterRender = ctx.callCount('stroke') + ctx.callCount('fill');
    expect(drawsAfterRender).toBeGreaterThan(0);

    ctx.reset();
    renderer.resize(); // canvas.width assignment wipes the bitmap

    const drawsAfterResize = ctx.callCount('stroke') + ctx.callCount('fill');
    expect(drawsAfterResize).toBeGreaterThan(0);
    renderer.destroy();
  });

  it('does not record stale dimensions when the container reports zero size', () => {
    const container = makeContainer();
    const resolved = resolveOptions({ container, seed: 42 });
    const renderer = new Renderer(resolved);
    const initial = renderer.getDimensions();
    expect(initial.width).toBeGreaterThan(0);

    (container.getBoundingClientRect as ReturnType<typeof vi.fn>).mockReturnValue({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    renderer.resize();

    // Hidden container: keep last good dimensions rather than reporting 0x0
    expect(renderer.getDimensions()).toEqual(initial);
    renderer.destroy();
  });
});

// ==================== FADE ====================

/** fillRect calls made while the fade's gradient was the fill */
function fadeFills(ctx: CanvasRenderingContext2D & MockCtx2D): RecordedCall[] {
  return ctx.calls.filter((c) => c.method === 'fillRect' && c.fillStyle === String(ctx.gradient));
}

describe('Constraint: fade blends plants into fadeColor', () => {
  it('accepts any color in hex, short hex, hex+alpha, rgb() and rgba() notation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fc.assert(
      fc.property(fadeColorArb, ({ css, stop }) => {
        const ctx = fadeFrame({ fadeHeight: 0.2, fadeColor: css });
        expect(ctx.gradient.addColorStop.mock.calls).toEqual([
          [0, stop],
          [1, stop.replace(/, [\d.]+\)$/, ', 0)')],
        ]);
      }),
      { numRuns: 300, examples: [[{ css: '#fff', stop: 'rgba(255, 255, 255, 1)' }]] }
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('accepts named colors as the canvas normalizes them', () => {
    const ctx = fadeFrame({ fadeHeight: 0.2, fadeColor: 'rebeccapurple' });
    expect(ctx.gradient.addColorStop).toHaveBeenCalledWith(0, 'rgba(102, 51, 153, 1)');
  });

  it('tints only drawn pixels (source-atop) and never erases, whatever the background', () => {
    fc.assert(
      fc.property(
        fadeColorArb,
        fc.oneof(fc.constant('transparent'), fadeColorArb.map((c) => c.css)),
        ({ css }, background) => {
          const ctx = fadeFrame({ fadeHeight: 0.3, fadeColor: css, background });
          const fills = fadeFills(ctx);
          expect(fills.length).toBe(1);
          expect(fills[0].composite).toBe('source-atop');
          expect(ctx.calls.some((c) => c.composite === 'destination-out')).toBe(false);
          expect(ctx.globalCompositeOperation).toBe('source-over'); // restored
        }
      ),
      { numRuns: 200 }
    );
  });

  it('spans the top fadeHeight of the plant area, for any size and heights', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4000 }),
        fc.integer({ min: 1, max: 4000 }),
        fc.double({ min: 0.05, max: 1, noNaN: true }),
        fc.double({ min: 0.001, max: 1, noNaN: true }),
        (width, height, maxHeight, fadeHeight) => {
          const ctx = fadeFrame({ maxHeight, fadeHeight, fadeColor: '#fff' }, width, height);
          const top = height * (1 - maxHeight);
          const bottom = Math.min(height, top + height * fadeHeight);
          expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, top, 0, bottom);
          expect(fadeFills(ctx)[0].args).toEqual([0, 0, width, bottom]);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('erases (fades out to transparent) for any fully transparent color', () => {
    fc.assert(
      fc.property(byte, byte, byte, fc.constantFrom('hex', 'rgba', 'named'), (r, g, b, form) => {
        const css =
          form === 'hex'
            ? `#${hex2(r)}${hex2(g)}${hex2(b)}00`
            : form === 'rgba'
              ? `rgba(${r}, ${g}, ${b}, 0)`
              : 'transparent';
        const [er, eg, eb] = form === 'named' ? [0, 0, 0] : [r, g, b];
        const ctx = fadeFrame({ fadeHeight: 0.2, fadeColor: css });
        const fills = fadeFills(ctx);
        expect(fills.length).toBe(1);
        expect(fills[0].composite).toBe('destination-out');
        expect(ctx.gradient.addColorStop).toHaveBeenCalledWith(0, `rgba(${er}, ${eg}, ${eb}, 1)`);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects anything that is not a color: one warning, no fade', () => {
    const hostile = fc.oneof(
      fc.constantFrom('', ' ', '#', '#12', '#12345', '#1234567', '#ggg', '#1g2g3g', 'abc', 'ffffff',
        'rgb(', 'rgb(1, 2)', 'not-a-color', 'transparentx', '#fff#', '##ffffff'),
      fc.stringMatching(/^[g-z]{1,12}$/)
    );
    fc.assert(
      fc.property(hostile, (fadeColor) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const ctx = fadeFrame({ fadeHeight: 0.2, fadeColor });
        expect(fadeFills(ctx).length, fadeColor).toBe(0);
        expect(ctx.createLinearGradient, fadeColor).not.toHaveBeenCalled();
        expect(warn, fadeColor).toHaveBeenCalledTimes(1);
        warn.mockRestore();
      }),
      { numRuns: 300 }
    );
  });
});

// ==================== PLAYBACK ====================
// Playback position, speed, seek, stop, autoplay, frame throttling, looping
// and every lifecycle event are covered by the model-based property at the
// end of this file. These examples cover what the model does not observe.

describe('Constraint: stop() repaints the initial frame', () => {
  it('clears and renders time 0 after playing', () => {
    const { garden, ctx } = makeGarden();
    garden.play();
    advanceFrame(4000);

    ctx.reset();
    garden.stop();
    expect(ctx.callCount('clearRect')).toBe(1);
    garden.destroy();
  });
});

describe('Constraint: construction and canvas styling', () => {
  it('resolves a selector-string container', () => {
    const container = makeContainer();
    container.id = 'garden-root';
    const garden = new Garten({ container: '#garden-root', autoplay: false, respectReducedMotion: false });
    expect(container.querySelector('canvas')).not.toBeNull();
    garden.destroy();
  });

  it('styles the canvas with the clamped opacity and zIndex, at construction and after setOptions', () => {
    // Documented ranges: opacity 0-1, zIndex -9999..9999
    const opacityArb = fc.oneof(fc.double({ min: -2, max: 3, noNaN: true }), fc.constantFrom(0, 1));
    const zArb = fc.oneof(fc.integer({ min: -20000, max: 20000 }), fc.constantFrom(-9999, 9999));
    fc.assert(
      fc.property(opacityArb, zArb, opacityArb, zArb, (opacity, zIndex, opacity2, zIndex2) => {
        const { garden, container } = makeGarden({ opacity, zIndex });
        const canvas = container.querySelector('canvas')!;
        const expectStyle = (o: number, z: number) => {
          expect(Number(canvas.style.opacity)).toBe(Math.min(1, Math.max(0, o)));
          expect(Number(canvas.style.zIndex)).toBe(Math.min(9999, Math.max(-9999, z)));
        };
        expectStyle(opacity, zIndex);
        garden.setOptions({ opacity: opacity2, zIndex: zIndex2 });
        expectStyle(opacity2, zIndex2);
        garden.destroy();
      }),
      { numRuns: 300 }
    );
  });

  it('throws a clear error when the selector matches nothing', () => {
    expect(() => new Garten({ container: '#does-not-exist' })).toThrow(/not found/);
  });
});

// ==================== DESTROY (M-6) ====================

describe('Constraint: destroy() is terminal', () => {
  it('ignores every controller call after destroy, whatever came before', () => {
    fc.assert(
      fc.property(
        fc.array(rawCommandArb, { maxLength: 15 }),
        fc.array(rawCommandArb, { maxLength: 15 }),
        (before, after) => {
          const { garden, ctx } = makeGarden();
          const run = (c: RawCommand) => {
            if (c.kind === 'seek') garden.seek(c.fraction * 10);
            else if (c.kind === 'setSpeed') garden.setSpeed(c.speed);
            else if (c.kind === 'advance') advanceFrame(c.ms);
            else garden[c.kind]();
          };
          for (const c of before) {
            try {
              run(c);
            } catch {
              // invalid speeds throw before destroy; that is not under test
            }
          }
          garden.destroy();
          ctx.reset();
          for (const c of after) expect(() => run(c)).not.toThrow(); // even invalid speeds
          expect(() => garden.setOptions({ opacity: 0.5, density: 'lush' })).not.toThrow();

          expect(garden.getElapsedTime()).toBe(0);
          expect(garden.getState()).toBe('idle');
          expect(ctx.calls.length).toBe(0); // nothing rendered to the detached canvas
        }
      ),
      { numRuns: 200 }
    );
  });

  it('is idempotent', () => {
    const { garden } = makeGarden();
    garden.destroy();
    expect(() => garden.destroy()).not.toThrow();
  });

  it('removes the canvas and the resize listener, and stops the loop', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { garden, container, ctx } = makeGarden();
    expect(container.querySelector('canvas')).not.toBeNull();
    garden.play();
    advanceFrame(100);

    garden.destroy();
    expect(container.querySelector('canvas')).toBeNull();
    // jsdom has no ResizeObserver, so the renderer used window 'resize'
    expect(removeListener.mock.calls.some(([type]) => type === 'resize')).toBe(true);

    ctx.reset();
    advanceFrame(500);
    expect(ctx.calls.length).toBe(0);
  });

  it('disconnects the ResizeObserver when one is available', () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = disconnect;
      }
    );
    const { garden } = makeGarden();
    garden.destroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

// ==================== SET OPTIONS (M-6) ====================

describe('Constraint: setOptions validation and re-render', () => {
  it('rejects an invalid speed atomically: no other option in the update applies', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(0, -1, -1e-9, NaN, Infinity, -Infinity),
        fc.double({ min: 11, max: 1000, noNaN: true }),
        (speed, duration) => {
          const { garden } = makeGarden(); // duration 10
          expect(() => garden.setOptions({ speed, duration })).toThrow();
          garden.seek(5);
          expect(garden.getProgress()).toBe(0.5); // duration still 10
          garden.destroy();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Every option that regenerates plants, with a value different from the base
  const regeneratingChange: fc.Arbitrary<Partial<GardenOptions>> = fc.oneof(
    fc.record({ density: fc.constantFrom('normal' as const, 'dense' as const, 'lush' as const) }),
    fc.record({ generations: fc.integer({ min: 1, max: 6 }) }),
    fc.record({ maxHeight: fc.double({ min: 0.05, max: 1, noNaN: true }) }),
    fc.record({ timingCurve: timingCurveArb }),
    fc.record({ duration: fc.double({ min: 1, max: 30, noNaN: true }) }),
    fc.record({ categories: fc.subarray(['rose', 'tulip', 'fern', 'conifer', 'grass'], { minLength: 1 }) }),
    fc.record({ colors: fc.record({ palette: fc.constantFrom('warm' as const, 'cool' as const, 'grayscale' as const) }) })
  );

  it('keeps the seed when any regenerating option changes', () => {
    // Same frame as a garden built with the new option from the start
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e9 - 1 }), regeneratingChange, (seed, change) => {
        const a = makeGarden({ seed, generations: 3 });
        a.garden.setOptions(change);
        a.ctx.reset();
        a.garden.seek(1);

        const b = makeGarden({ seed, generations: 3, ...change });
        b.ctx.reset();
        b.garden.seek(1);

        expect(frameOps(a.ctx.calls)).toEqual(frameOps(b.ctx.calls));
        a.garden.destroy();
        b.garden.destroy();
      }),
      { numRuns: 60 }
    );
  });

  it('regenerate() rebuilds the same garden for any configuration', () => {
    fc.assert(
      fc.property(configArb, fc.double({ min: 0, max: 1, noNaN: true }), (config, at) => {
        const { garden, ctx } = makeGarden({ ...config, generations: Math.min(config.generations, 4) });
        garden.seek(at * config.duration);
        const before = frameOps(ctx.calls);
        ctx.reset();
        garden.regenerate();
        expect(frameOps(ctx.calls)).toEqual(before);
        garden.destroy();
      }),
      { numRuns: 80 }
    );
  });

  it('rejects container changes explicitly instead of ignoring them', () => {
    const { garden } = makeGarden();
    const other = makeContainer();
    expect(() => garden.setOptions({ container: other })).toThrow(/container/i);
    garden.destroy();
  });

  it('re-renders visual-only option changes while paused', () => {
    const { garden, ctx } = makeGarden();
    garden.seek(5); // renders a frame, stays non-playing

    ctx.reset();
    garden.setOptions({ fadeHeight: 0.3, fadeColor: '#abcdef' });

    expect(ctx.calls.length).toBeGreaterThan(0);
    garden.destroy();
  });
});

// ==================== EVENTS API (M-8) ====================

describe('Constraint: subscription events API', () => {
  it('supports unsubscribe and once()', () => {
    const { garden } = makeGarden();
    const onPlay = vi.fn();
    const oncePause = vi.fn();

    const off = garden.on('play', onPlay);
    garden.once('pause', oncePause);

    garden.play();
    garden.pause();
    off();
    garden.play();
    garden.pause();

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(oncePause).toHaveBeenCalledTimes(1);
    garden.destroy();
  });

  it('emits regenerate and optionsChange', () => {
    const { garden } = makeGarden();
    const regenerate = vi.fn();
    const optionsChange = vi.fn();
    garden.on('regenerate', regenerate);
    garden.on('optionsChange', optionsChange);

    garden.setOptions({ density: 'normal' });

    expect(optionsChange).toHaveBeenCalledTimes(1);
    expect(regenerate).toHaveBeenCalledTimes(1);
    garden.destroy();
  });
});

// ==================== REDUCED MOTION ====================

describe('Constraint: reduced motion renders a static completed garden', () => {
  it('renders the fully grown garden without animating', () => {
    mockMatchMedia.mockImplementationOnce((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const container = makeContainer();
    const garden = new Garten({
      container,
      seed: 42,
      duration: 10,
      generations: 5,
      autoplay: true, // must be ignored under reduced motion
      respectReducedMotion: true,
    });
    const ctx = lastCtx!;

    expect(garden.getState()).toBe('complete');
    expect(ctx.callCount('stroke') + ctx.callCount('fill')).toBeGreaterThan(0);

    // No animation frame scheduled
    const drawsBefore = ctx.calls.length;
    advanceFrame(500);
    expect(ctx.calls.length).toBe(drawsBefore);

    // An explicit play() is consent to motion: it animates from the start
    garden.play();
    expect(garden.getState()).toBe('playing');
    advanceFrame(500);
    expect(garden.getElapsedTime()).toBeGreaterThan(0.4);
    expect(garden.getElapsedTime()).toBeLessThan(0.6);
    garden.destroy();
  });
});

// ==================== ERROR CONTAINMENT (M-1) ====================

describe('Constraint: render errors do not strand the animation loop', () => {
  it('catches a throwing frame, stops the loop, and leaves a resumable state', () => {
    const { garden, ctx } = makeGarden();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    garden.play();
    advanceFrame(100); // healthy frame

    (ctx as { clearRect: unknown }).clearRect = () => {
      throw new Error('boom');
    };

    expect(() => advanceFrame(100)).not.toThrow();
    expect(garden.getState()).toBe('paused');
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    garden.destroy();
  });
});

// ==================== POOL CAPACITY (M-1) ====================

describe('Constraint: pool capacity covers the worst legal configuration', () => {
  it('survives a frame that renders the maximum legal plant count', async () => {
    const { GrowthProgressPool } = await import('./GrowthProgressPool');
    const { OPTION_BOUNDS, PLANTS_PER_GENERATION } = await import('./constants');

    const worstCase =
      OPTION_BOUNDS.GENERATIONS.max * PLANTS_PER_GENERATION.lush[1];

    const pool = new GrowthProgressPool({ devMode: false });
    pool.beginFrame();
    expect(() => {
      for (let i = 0; i < worstCase; i++) {
        pool.acquireAndCalculate(1, 0, 1);
      }
    }).not.toThrow();
    pool.endFrame();
  });
});

// ==================== MODEL-BASED PLAYBACK ====================
// Random command sequences against a small reference model of the
// controller (Hypothesis-style rule-based stateful testing). The model owns
// the state machine: which state each call leads to, which position play()
// resumes from, when a frame completes or wraps the animation, which
// stateChange events fire. It shares only the elapsed-time formula
// elapsed = (frameTime - startTime) * speed / 1000, which is the
// documented definition, so the comparison can be exact.

describe('Property: playback matches a reference model under random commands', () => {
  it('state, elapsed time and every emitted event agree after every step', () => {
    fc.assert(
      fc.property(configArb, fc.array(rawCommandArb, { maxLength: 60 }), (config, rawCommands) => {
        let pending: FrameRequestCallback | null = null;
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
          pending = cb;
          return 1;
        });
        vi.stubGlobal('cancelAnimationFrame', () => {
          pending = null;
        });

        const commands: Command[] = rawCommands.map((c) =>
          c.kind === 'seek' ? { kind: 'seek', time: c.fraction * config.duration } : c
        );
        const container = makeContainer();
        const completedAt = referenceCompleted(config, container);

        // Subscribe before construction can emit (autoplay): via options
        const log: string[] = [];
        const garden = new Garten({
          container,
          respectReducedMotion: false,
          ...config,
          events: {
            onStateChange: (state) => log.push(`state:${state}`),
            onGenerationComplete: (g) => log.push(`generation:${g}`),
            onProgress: (progress, elapsed) => log.push(`progress:${progress}:${elapsed}`),
            onComplete: () => log.push('complete'),
          },
        });

        const frameInterval = 1000 / config.targetFPS;
        const m: Model = {
          state: 'idle',
          elapsed: 0,
          pausedAt: 0,
          speed: config.speed,
          startTime: 0,
          lastFrameTime: 0,
          lastReported: -1,
          log: [],
        };
        const enter = (state: Model['state']) => {
          m.state = state;
          m.log.push(`state:${state}`);
        };
        const play = () => {
          if (m.state === 'playing') return;
          const from =
            m.state === 'paused'
              ? m.pausedAt
              : m.elapsed > 0 && m.elapsed < config.duration
                ? m.elapsed
                : 0;
          if (from === 0) {
            m.elapsed = 0;
            m.lastReported = -1;
          }
          const now = performance.now();
          m.startTime = now - (from * 1000) / m.speed;
          m.lastFrameTime = now - frameInterval;
          enter('playing');
          m.log.push('play');
        };
        const pause = () => {
          if (m.state !== 'playing') return;
          m.pausedAt = m.elapsed; // the last rendered frame's position
          enter('paused');
          m.log.push('pause');
        };
        let bus: string[] | null = null;
        let busFrom = 0;
        const step = (label: string) => {
          expect(garden.getState(), label).toBe(m.state);
          expect(garden.getElapsedTime(), label).toBe(m.elapsed);
          expect(garden.getProgress(), label).toBe(Math.min(1, m.elapsed / config.duration));
          expect(log, label).toEqual(
            m.log.filter((e) => LEGACY_EVENTS.includes(e.split(':')[0]))
          );
          if (bus) expect(bus, label).toEqual(m.log.slice(busFrom));
        };

        if (config.autoplay) play();
        step('construction');

        // The on() API must report the same events as the callbacks, plus
        // play/pause/stop/regenerate (subscribed after construction)
        bus = [];
        busFrom = m.log.length;
        const busLog = bus;
        garden.on('stateChange', ({ state }) => busLog.push(`state:${state}`));
        garden.on('generationComplete', ({ generation }) => busLog.push(`generation:${generation}`));
        garden.on('progress', ({ progress, elapsedTime }) =>
          busLog.push(`progress:${progress}:${elapsedTime}`)
        );
        garden.on('complete', () => busLog.push('complete'));
        for (const name of ['play', 'pause', 'stop', 'regenerate'] as const) {
          garden.on(name, () => busLog.push(name));
        }

        for (const command of commands) {
          switch (command.kind) {
            case 'play':
              play();
              garden.play();
              break;
            case 'pause':
              pause();
              garden.pause();
              break;
            case 'stop':
              m.elapsed = 0;
              m.pausedAt = 0;
              m.lastReported = -1;
              enter('idle');
              m.log.push('stop');
              garden.stop();
              break;
            case 'seek': {
              garden.seek(command.time);
              if (!Number.isFinite(command.time)) break;
              const t = Math.max(0, Math.min(command.time, config.duration));
              if (m.state === 'playing') m.startTime = performance.now() - (t * 1000) / m.speed;
              else m.pausedAt = t;
              m.elapsed = t;
              m.lastReported = completedAt(t); // no catch-up events for a jump
              if (t >= config.duration && !config.loop) {
                if (m.state !== 'complete') {
                  enter('complete');
                  m.log.push('complete');
                }
              } else if (m.state === 'complete') {
                enter('paused');
              }
              break;
            }
            case 'setSpeed': {
              if (!(Number.isFinite(command.speed) && command.speed > 0)) {
                expect(() => garden.setSpeed(command.speed)).toThrow();
                break;
              }
              garden.setSpeed(command.speed);
              const wasPlaying = m.state === 'playing';
              if (wasPlaying) pause();
              m.speed = Math.min(100, Math.max(0.01, command.speed));
              if (wasPlaying) play();
              break;
            }
            case 'advance': {
              vi.advanceTimersByTime(command.ms);
              const frame = pending as FrameRequestCallback | null;
              if (frame === null) break;
              pending = null;
              const now = performance.now();
              expect(m.state).toBe('playing'); // only a playing garden schedules frames
              frame(now);
              if (now - m.lastFrameTime < frameInterval) break; // throttled
              m.lastFrameTime = now;
              m.elapsed = ((now - m.startTime) * m.speed) / 1000;
              const done = completedAt(m.elapsed);
              for (let g = Math.max(1, m.lastReported + 1); g <= done; g++) {
                m.log.push(`generation:${g}`);
              }
              m.lastReported = Math.max(m.lastReported, done);
              const progress = Math.min(1, m.elapsed / config.duration);
              m.log.push(`progress:${progress}:${m.elapsed}`);
              if (m.elapsed >= config.duration) {
                if (config.loop) {
                  m.startTime = now;
                  m.elapsed = 0;
                  m.lastReported = -1;
                } else {
                  enter('complete');
                  m.log.push('complete');
                }
              }
              break;
            }
            case 'regenerate': {
              // Same seed, so the garden is unchanged; while playing it
              // pauses and resumes internally, like setSpeed
              garden.regenerate();
              const wasPlaying = m.state === 'playing';
              if (wasPlaying) pause();
              m.lastReported = completedAt(m.elapsed);
              m.log.push('regenerate');
              if (wasPlaying) play();
              break;
            }
          }
          step(JSON.stringify(command));
        }
        garden.destroy();
        vi.unstubAllGlobals();
        vi.stubGlobal('matchMedia', mockMatchMedia);
      }),
      { numRuns: 500, examples: pinned }
    );
  });
});
