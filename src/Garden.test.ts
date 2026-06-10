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
}

interface MockCtx2D {
  calls: RecordedCall[];
  callCount(method: string): number;
  reset(): void;
}

function createMockContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D & MockCtx2D {
  const calls: RecordedCall[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args, fillStyle: String(ctx.fillStyle) });
    };

  const gradient = { addColorStop: vi.fn() };

  const ctx = {
    canvas,
    fillStyle: '',
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

// ==================== FADE (M-3) ====================

describe('Constraint: fade accepts any supported hex format', () => {
  it('builds the fade gradient for 3-digit hex fadeColor', () => {
    const { garden, ctx } = makeGarden({ fadeHeight: 0.2, fadeColor: '#fff' });
    garden.seek(5);

    expect(
      (ctx.createLinearGradient as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBeGreaterThan(0);
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

  it('clamps out-of-range speed in setSpeed and rejects non-finite values', () => {
    const { garden } = makeGarden();
    expect(() => garden.setSpeed(NaN)).toThrow();
    expect(() => garden.setSpeed(Infinity)).toThrow();
    expect(() => garden.setSpeed(0)).toThrow();
    expect(() => garden.setSpeed(0.5)).not.toThrow();
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

    expect(seen).toContain('play');
    expect(seen).toContain('pause');
    expect(seen).toContain('stop');
    expect(seen).toContain('state:playing');
    expect(seen).toContain('state:paused');
    expect(seen).toContain('state:idle');
    garden.destroy();
  });

  it('emits progress and complete events', () => {
    const { garden } = makeGarden();
    const progress = vi.fn();
    const complete = vi.fn();
    garden.on('progress', progress);
    garden.on('complete', complete);

    garden.play();
    advanceFrame(11000);

    expect(progress).toHaveBeenCalled();
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
