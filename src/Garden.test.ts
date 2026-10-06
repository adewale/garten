/**
 * Garden + Renderer lifecycle tests
 * Exercises the public GardenController contract end-to-end with a mocked
 * canvas 2D context and fake timers (rAF + performance).
 *
 * These cover the seams unit tests miss: constructor wiring, the animation
 * loop, resize behavior, option updates, events, and teardown.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  it('fills the configured background color when one is provided', () => {
    const { garden, ctx } = makeGarden({ background: '#112233' });
    garden.seek(5);

    const bgFills = ctx.calls.filter(
      (c) => c.method === 'fillRect' && c.fillStyle === '#112233'
    );
    expect(bgFills.length).toBeGreaterThan(0);
    garden.destroy();
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
  it('builds the fade gradient for 3-digit hex fadeColor', () => {
    const { garden, ctx } = makeGarden({ fadeHeight: 0.2, fadeColor: '#fff' });
    garden.seek(5);

    expect(ctx.gradient.addColorStop).toHaveBeenCalledWith(0, 'rgba(255, 255, 255, 1)');
    expect(ctx.gradient.addColorStop).toHaveBeenCalledWith(1, 'rgba(255, 255, 255, 0)');
    garden.destroy();
  });

  it('accepts named and rgb() colors, not just hex', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const [fadeColor, stop] of [
      ['rebeccapurple', 'rgba(102, 51, 153, 1)'],
      ['rgb(10, 20, 30)', 'rgba(10, 20, 30, 1)'],
      ['rgba(10, 20, 30, 0.5)', 'rgba(10, 20, 30, 0.5)'],
    ]) {
      const { garden, ctx } = makeGarden({ fadeHeight: 0.2, fadeColor });
      garden.seek(5);
      expect(ctx.gradient.addColorStop).toHaveBeenCalledWith(0, stop);
      expect(fadeFills(ctx).length).toBeGreaterThan(0);
      garden.destroy();
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('tints only drawn pixels (source-atop), so the color is actually used', () => {
    const { garden, ctx } = makeGarden({ fadeHeight: 0.2, fadeColor: 'white' });
    garden.seek(5);

    const fills = fadeFills(ctx);
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) expect(fill.composite).toBe('source-atop');
    // The composite mode is restored for the next frame
    expect(ctx.globalCompositeOperation).toBe('source-over');
    garden.destroy();
  });

  it('never erases an opaque background', () => {
    const { garden, ctx } = makeGarden({
      background: '#112233',
      fadeHeight: 0.3,
      fadeColor: '#112233',
    });
    garden.seek(5);

    expect(fadeFills(ctx).length).toBeGreaterThan(0);
    expect(ctx.calls.some((c) => c.composite === 'destination-out')).toBe(false);
    garden.destroy();
  });

  it('places the fade zone at the top of the plant area, fadeHeight deep', () => {
    // Container is 800x600: the maxHeight line is at 600 * (1 - 0.5) = 300
    const { garden, ctx } = makeGarden({ maxHeight: 0.5, fadeHeight: 0.2, fadeColor: '#fff' });
    garden.seek(5);

    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 300, 0, 420);
    const [fill] = fadeFills(ctx);
    expect(fill.args).toEqual([0, 0, 800, 420]);
    garden.destroy();
  });

  it("fades out to transparent (erase) when fadeColor is 'transparent'", () => {
    const { garden, ctx } = makeGarden({ fadeHeight: 0.2, fadeColor: 'transparent' });
    garden.seek(5);

    const fills = fadeFills(ctx);
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) expect(fill.composite).toBe('destination-out');
    expect(ctx.gradient.addColorStop).toHaveBeenCalledWith(0, 'rgba(0, 0, 0, 1)');
    garden.destroy();
  });

  it('warns once and skips the fade for an unparseable color', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { garden, ctx } = makeGarden({ fadeHeight: 0.2, fadeColor: 'not-a-color' });
    garden.seek(5);
    garden.seek(6);

    expect(fadeFills(ctx).length).toBe(0);
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/not-a-color/);
    garden.destroy();
  });
});

// ==================== GENERATION EVENTS (M-2) ====================

describe('Constraint: generation completion events', () => {
  it('emits every crossed generation when multiple elapse in ONE frame', () => {
    // Drive rAF by hand so we can deliver a single frame with a large
    // timestamp jump — exactly what a suspended background tab produces
    let rafCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      rafCallback = null;
    });

    const onGenerationComplete = vi.fn();
    const { garden } = makeGarden({ events: { onGenerationComplete } });

    const t0 = performance.now();
    garden.play();

    rafCallback!(t0 + 100); // one healthy tick inside generation 0
    rafCallback!(t0 + 3600); // tab resumes 3.5s later: a single frame

    const reported = onGenerationComplete.mock.calls.map((c) => c[0]);
    expect(reported).toEqual([1, 2, 3]);
    garden.destroy();
  });

  it('reports the full count exactly once on completion', () => {
    const onGenerationComplete = vi.fn();
    const onComplete = vi.fn();
    const { garden } = makeGarden({ events: { onGenerationComplete, onComplete } });

    garden.play();
    advanceFrame(11000);

    const reported = onGenerationComplete.mock.calls.map((c) => c[0]);
    expect(reported).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(garden.getState()).toBe('complete');
    garden.destroy();
  });
});

describe('Constraint: a generation completes when its plants are fully grown', () => {
  /** Play with fine-grained frames, recording elapsed time at each event */
  function recordGenerationEvents(overrides: Partial<GardenOptions>) {
    const options = { ...overrides };
    const { garden, container } = makeGarden(options);
    const seen: Array<{ generation: number; at: number }> = [];
    garden.on('generationComplete', ({ generation }) =>
      seen.push({ generation, at: garden.getElapsedTime() })
    );
    garden.play();
    for (let t = 0; t < 10200; t += 50) advanceFrame(50);

    const resolved = resolveOptions({
      container,
      seed: 42,
      duration: 10,
      generations: 10,
      density: 'sparse',
      ...options,
    });
    const plants = generatePlants(resolved);
    garden.destroy();
    return { seen, plants };
  }

  for (const timingCurve of ['linear', 'ease-out', 'ease-in', 'ease-in-out'] as const) {
    it(`fires once every plant up to that generation has finished (${timingCurve})`, () => {
      const { seen, plants } = recordGenerationEvents({ timingCurve });
      expect(seen.map((e) => e.generation)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      for (const { generation, at } of seen) {
        const doneBy = Math.max(
          ...plants
            .filter((p) => p.generation < generation)
            .map((p) => p.delay + p.growDuration)
        );
        // Never early: no plant of generations 1..g is still growing
        expect(at).toBeGreaterThanOrEqual(doneBy - 1e-9);
        // Prompt: fired on the first frame after (frames are <= ~0.1s apart)
        expect(at).toBeLessThan(doneBy + 0.15);
      }
    });
  }
});

// ==================== SEEK / PLAY (M-6) ====================

describe('Constraint: seek positions playback regardless of state', () => {
  it('play() after seek() from idle resumes at the sought time', () => {
    const { garden } = makeGarden();

    garden.seek(5);
    garden.play();
    advanceFrame(100);

    expect(garden.getElapsedTime()).toBeGreaterThanOrEqual(5);
    expect(garden.getElapsedTime()).toBeLessThan(6);
    garden.destroy();
  });

  it('seeking backward from complete returns to a resumable state', () => {
    const { garden } = makeGarden();
    garden.seek(10); // complete
    expect(garden.getState()).toBe('complete');

    garden.seek(4);
    garden.play();
    advanceFrame(100);

    expect(garden.getState()).toBe('playing');
    expect(garden.getElapsedTime()).toBeGreaterThanOrEqual(4);
    expect(garden.getElapsedTime()).toBeLessThan(5);
    garden.destroy();
  });

  it('ignores non-finite seek times', () => {
    const { garden } = makeGarden();
    garden.seek(NaN);
    expect(garden.getElapsedTime()).toBe(0);
    garden.destroy();
  });
});

describe('Constraint: playback position, speed and reset', () => {
  it('resumes from the paused position, not from 0, and freezes while paused', () => {
    const { garden } = makeGarden();
    garden.play();
    advanceFrame(2000);
    garden.pause();
    const pausedAt = garden.getElapsedTime();
    expect(pausedAt).toBeGreaterThan(1.9);

    advanceFrame(3000); // wall-clock time passes while paused
    expect(garden.getElapsedTime()).toBe(pausedAt);

    garden.play();
    advanceFrame(500);
    expect(garden.getElapsedTime()).toBeGreaterThanOrEqual(pausedAt + 0.45);
    expect(garden.getElapsedTime()).toBeLessThan(pausedAt + 0.6);
    garden.destroy();
  });

  it('advances elapsed time at the configured speed', () => {
    const { garden } = makeGarden({ speed: 3 });
    garden.play();
    advanceFrame(1000);
    expect(garden.getElapsedTime()).toBeGreaterThan(2.9);
    expect(garden.getElapsedTime()).toBeLessThan(3.2);
    garden.destroy();
  });

  it('setSpeed() mid-playback changes the rate without jumping position', () => {
    const { garden } = makeGarden();
    garden.play();
    advanceFrame(1000);
    const before = garden.getElapsedTime();

    garden.setSpeed(2);
    expect(garden.getState()).toBe('playing');
    advanceFrame(1000);
    const gained = garden.getElapsedTime() - before;
    expect(gained).toBeGreaterThan(1.9);
    expect(gained).toBeLessThan(2.2);
    garden.destroy();
  });

  it('rejects non-finite or non-positive speed and clamps to [0.01, 100]', () => {
    const { garden } = makeGarden({ duration: 1000 });
    expect(() => garden.setSpeed(NaN)).toThrow();
    expect(() => garden.setSpeed(Infinity)).toThrow();
    expect(() => garden.setSpeed(0)).toThrow();

    garden.setSpeed(1e6); // clamped to 100x
    garden.play();
    advanceFrame(1000);
    // ~1s of wall clock (frames land within ~30ms of it) at 100x
    expect(garden.getElapsedTime()).toBeGreaterThan(95);
    expect(garden.getElapsedTime()).toBeLessThan(105);

    garden.stop();
    garden.setSpeed(1e-6); // clamped to 0.01x
    garden.play();
    advanceFrame(1000);
    expect(garden.getElapsedTime()).toBeGreaterThan(0.009);
    expect(garden.getElapsedTime()).toBeLessThan(0.012);
    garden.destroy();
  });

  it('stop() resets elapsed time and progress, and renders the initial frame', () => {
    const { garden, ctx } = makeGarden();
    garden.play();
    advanceFrame(4000);
    expect(garden.getProgress()).toBeGreaterThan(0.3);

    ctx.reset();
    garden.stop();
    expect(garden.getState()).toBe('idle');
    expect(garden.getElapsedTime()).toBe(0);
    expect(garden.getProgress()).toBe(0);
    expect(ctx.callCount('clearRect')).toBeGreaterThan(0);

    garden.play();
    advanceFrame(100);
    expect(garden.getElapsedTime()).toBeLessThan(0.2);
    garden.destroy();
  });

  it('seek() while playing continues from the new position', () => {
    const { garden } = makeGarden();
    garden.play();
    advanceFrame(1000);
    garden.seek(7);
    advanceFrame(500);
    expect(garden.getState()).toBe('playing');
    expect(garden.getElapsedTime()).toBeGreaterThanOrEqual(7.45);
    expect(garden.getElapsedTime()).toBeLessThan(7.6);
    garden.destroy();
  });

  it('autoplay starts playing without a play() call', () => {
    const { garden } = makeGarden({ autoplay: true });
    expect(garden.getState()).toBe('playing');
    advanceFrame(500);
    expect(garden.getElapsedTime()).toBeGreaterThan(0.4);
    garden.destroy();
  });

  it('throttles frames to targetFPS', () => {
    const { garden } = makeGarden({ targetFPS: 10 });
    const progress = vi.fn();
    garden.on('progress', progress);
    garden.play();
    for (let i = 0; i < 60; i++) advanceFrame(16); // 60+ rAF callbacks
    // At 10 fps, one rendered frame per 100ms of elapsed time — not 60
    const expected = garden.getElapsedTime() * 10;
    expect(progress.mock.calls.length).toBeGreaterThanOrEqual(expected - 2);
    expect(progress.mock.calls.length).toBeLessThanOrEqual(expected + 2);
    expect(progress.mock.calls.length).toBeLessThan(30);
    garden.destroy();
  });
});

describe('Constraint: construction and canvas styling', () => {
  it('resolves a selector-string container and styles the canvas', () => {
    const container = makeContainer();
    container.id = 'garden-root';
    const garden = new Garten({
      container: '#garden-root',
      autoplay: false,
      respectReducedMotion: false,
      opacity: 0.4,
      zIndex: 7,
    });
    const canvas = container.querySelector('canvas')!;
    expect(canvas).not.toBeNull();
    expect(canvas.style.opacity).toBe('0.4');
    expect(canvas.style.zIndex).toBe('7');
    garden.destroy();
  });

  it('throws a clear error when the selector matches nothing', () => {
    expect(() => new Garten({ container: '#does-not-exist' })).toThrow(/not found/);
  });
});

// ==================== DESTROY (M-6) ====================

describe('Constraint: destroy() is terminal', () => {
  it('ignores all controller calls after destroy', () => {
    const { garden, ctx } = makeGarden();
    garden.destroy();
    ctx.reset();

    expect(() => {
      garden.play();
      garden.pause();
      garden.stop();
      garden.seek(5);
      garden.setOptions({ opacity: 0.5 });
      garden.regenerate();
    }).not.toThrow();

    expect(garden.getElapsedTime()).toBe(0);
    expect(garden.getState()).toBe('idle');
    expect(ctx.calls.length).toBe(0); // nothing rendered to the detached canvas
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
  it('rejects invalid speed before applying any other option', () => {
    const { garden } = makeGarden(); // duration 10
    expect(() => garden.setOptions({ speed: -1, duration: 50 })).toThrow();

    // duration must be unchanged by the failed update
    garden.seek(5);
    expect(garden.getProgress()).toBeCloseTo(0.5, 5);
    garden.destroy();
  });

  it('keeps the seed when an option change regenerates plants', () => {
    // Same frame as a garden built with the new option from the start
    const a = makeGarden();
    a.garden.setOptions({ density: 'normal' });
    a.ctx.reset();
    a.garden.seek(5);

    const b = makeGarden({ density: 'normal' });
    b.ctx.reset();
    b.garden.seek(5);

    expect(a.ctx.calls.length).toBeGreaterThan(0);
    expect(frameOps(a.ctx.calls)).toEqual(frameOps(b.ctx.calls));
    a.garden.destroy();
    b.garden.destroy();
  });

  it('regenerate() rebuilds the same garden (same seed)', () => {
    const { garden, ctx } = makeGarden();
    garden.seek(5);
    const before = frameOps(ctx.calls);
    ctx.reset();
    garden.regenerate();
    expect(before.length).toBeGreaterThan(0);
    expect(frameOps(ctx.calls)).toEqual(before);
    garden.destroy();
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
  it('emits lifecycle events to on() subscribers', () => {
    const { garden } = makeGarden();
    const seen: string[] = [];

    garden.on('play', () => seen.push('play'));
    garden.on('pause', () => seen.push('pause'));
    garden.on('stop', () => seen.push('stop'));
    garden.on('stateChange', ({ state }) => seen.push(`state:${state}`));

    garden.play();
    advanceFrame(100);
    garden.pause();
    garden.stop();

    // Exact order, each exactly once
    expect(seen).toEqual([
      'state:playing',
      'play',
      'state:paused',
      'pause',
      'state:idle',
      'stop',
    ]);
    garden.destroy();
  });

  it('emits progress payloads that match elapsed time, ending at 1, then complete', () => {
    const { garden } = makeGarden(); // duration 10
    const payloads: Array<{ progress: number; elapsedTime: number }> = [];
    const legacy: Array<[number, number]> = [];
    const complete = vi.fn();
    garden.on('progress', (p) => payloads.push(p));
    garden.on('complete', complete);
    garden.setOptions({ events: { onProgress: (p, e) => legacy.push([p, e]) } });

    garden.play();
    for (let t = 0; t < 11000; t += 500) advanceFrame(500);

    expect(payloads.length).toBeGreaterThan(5);
    for (const { progress, elapsedTime } of payloads) {
      expect(progress).toBeCloseTo(Math.min(1, elapsedTime / 10), 10);
    }
    const progresses = payloads.map((p) => p.progress);
    expect(progresses).toEqual([...progresses].sort((x, y) => x - y));
    expect(progresses[0]).toBeLessThan(0.1);
    expect(progresses[progresses.length - 1]).toBe(1);
    expect(legacy).toEqual(payloads.map((p) => [p.progress, p.elapsedTime]));
    expect(complete).toHaveBeenCalledTimes(1);
    garden.destroy();
  });

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

// ==================== LOOPING ====================

describe('Constraint: looping restarts without completing', () => {
  it('wraps past the end, re-fires generation events, never completes', () => {
    const onComplete = vi.fn();
    const generations: number[] = [];
    const { garden } = makeGarden({
      loop: true,
      events: { onComplete, onGenerationComplete: (g) => generations.push(g) },
    });
    const complete = vi.fn();
    garden.on('complete', complete);

    garden.play();
    // Frames fire every ~16-48ms while time advances, so the loop wraps at
    // ~10s; land mid-generation-1 of the second pass (~1.5s in) to keep the
    // expected event list stable
    advanceFrame(10200);
    advanceFrame(1300);

    expect(garden.getState()).toBe('playing');
    expect(onComplete).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    // First pass reported all 10, second pass restarted from 1
    expect(generations.slice(0, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(generations.slice(10)).toEqual([1]);
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
