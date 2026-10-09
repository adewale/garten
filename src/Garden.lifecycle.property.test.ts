import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
import type { PlaybackState } from './types';

vi.mock('./Renderer', () => ({
  Renderer: class {
    render(): void {}
    renderStatic(): void {}
    setOptions(): void {}
    destroy(): void {}
  },
}));

import { Garten } from './Garden';

type Model = {
  state: PlaybackState;
  elapsed: number;
  duration: number;
  speed: number;
  loop: boolean;
  destroyed: boolean;
};

type AnimationFrames = {
  active: Map<number, FrameRequestCallback>;
  now: number;
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
  advanceBy(milliseconds: number): void;
};
type Real = { garden: Garten; frames: AnimationFrames };

function createAnimationFrames(): AnimationFrames {
  let nextId = 1;
  const frames: AnimationFrames = {
    active: new Map(),
    now: 0,
    request(callback) {
      const id = nextId++;
      this.active.set(id, callback);
      return id;
    },
    cancel(id) {
      this.active.delete(id);
    },
    advanceBy(milliseconds) {
      this.now += milliseconds;
      const next = this.active.entries().next();
      if (!next.done) {
        const [id, callback] = next.value;
        this.active.delete(id);
        callback(this.now);
      }
    },
  };
  return frames;
}

function assertMatchesModel(model: Model, real: Real): void {
  expect(real.garden.getState()).toBe(model.state);
  expect(real.garden.getElapsedTime()).toBeCloseTo(model.elapsed, 10);
  expect(real.garden.getProgress()).toBeCloseTo(Math.min(1, model.elapsed / model.duration), 10);
  expect(real.garden.getProgress()).toBeGreaterThanOrEqual(0);
  expect(real.garden.getProgress()).toBeLessThanOrEqual(1);
  expect(real.frames.active.size).toBe(!model.destroyed && model.state === 'playing' ? 1 : 0);
}

abstract class LifecycleCommand implements fc.Command<Model, Real> {
  check(_model: Readonly<Model>): boolean {
    return true;
  }

  abstract run(model: Model, real: Real): void;
  abstract toString(): string;
}

class PlayCommand extends LifecycleCommand {
  run(model: Model, real: Real): void {
    real.garden.play();
    if (!model.destroyed && model.state !== 'playing') {
      if (model.state !== 'paused' && !(model.elapsed > 0 && model.elapsed < model.duration)) {
        model.elapsed = 0;
      }
      model.state = 'playing';
    }
    assertMatchesModel(model, real);
  }

  toString(): string {
    return 'play';
  }
}

class PauseCommand extends LifecycleCommand {
  run(model: Model, real: Real): void {
    real.garden.pause();
    if (!model.destroyed && model.state === 'playing') {
      model.state = 'paused';
    }
    assertMatchesModel(model, real);
  }

  toString(): string {
    return 'pause';
  }
}

class StopCommand extends LifecycleCommand {
  run(model: Model, real: Real): void {
    real.garden.stop();
    if (!model.destroyed) {
      model.state = 'idle';
      model.elapsed = 0;
    }
    assertMatchesModel(model, real);
  }

  toString(): string {
    return 'stop';
  }
}

class SeekCommand extends LifecycleCommand {
  constructor(private readonly time: number) {
    super();
  }

  run(model: Model, real: Real): void {
    real.garden.seek(this.time);
    if (!model.destroyed) {
      model.elapsed = Math.max(0, Math.min(this.time, model.duration));
      if (model.elapsed >= model.duration && !model.loop) {
        model.state = 'complete';
      } else if (model.state === 'complete') {
        model.state = 'paused';
      }
    }
    assertMatchesModel(model, real);
  }

  toString(): string {
    return `seek(${this.time})`;
  }
}

class SetDurationCommand extends LifecycleCommand {
  constructor(private readonly duration: number) {
    super();
  }

  run(model: Model, real: Real): void {
    real.garden.setOptions({ duration: this.duration });
    if (!model.destroyed) {
      model.duration = this.duration;
      model.elapsed = Math.min(model.elapsed, this.duration);
    }
    assertMatchesModel(model, real);
  }

  toString(): string {
    return `setDuration(${this.duration})`;
  }
}

class SetSpeedCommand extends LifecycleCommand {
  constructor(private readonly speed: number) {
    super();
  }

  run(model: Model, real: Real): void {
    real.garden.setSpeed(this.speed);
    if (!model.destroyed) {
      model.speed = this.speed;
    }
    assertMatchesModel(model, real);
  }

  toString(): string {
    return `setSpeed(${this.speed})`;
  }
}

function advanceFrame(model: Model, real: Real, milliseconds: number): void {
  const wasPlaying = !model.destroyed && model.state === 'playing';
  real.frames.advanceBy(milliseconds);

  if (wasPlaying) {
    const nextElapsed = model.elapsed + milliseconds * model.speed / 1000;
    if (nextElapsed >= model.duration) {
      if (model.loop) {
        model.elapsed = 0;
      } else {
        model.elapsed = nextElapsed;
        model.state = 'complete';
      }
    } else {
      model.elapsed = nextElapsed;
    }
  }

  assertMatchesModel(model, real);
}

class AdvanceFrameCommand extends LifecycleCommand {
  constructor(private readonly milliseconds: number) {
    super();
  }

  run(model: Model, real: Real): void {
    advanceFrame(model, real, this.milliseconds);
  }

  toString(): string {
    return `advanceFrame(${this.milliseconds}ms)`;
  }
}

class AdvancePastEndCommand extends LifecycleCommand {
  check(model: Readonly<Model>): boolean {
    return !model.destroyed && model.state === 'playing';
  }

  run(model: Model, real: Real): void {
    const remaining = Math.max(0, model.duration - model.elapsed);
    const milliseconds = Math.ceil(remaining * 1000 / model.speed) + 17;
    advanceFrame(model, real, milliseconds);
  }

  toString(): string {
    return 'advancePastEnd';
  }
}

class RegenerateCommand extends LifecycleCommand {
  run(model: Model, real: Real): void {
    real.garden.regenerate();
    assertMatchesModel(model, real);
  }

  toString(): string {
    return 'regenerate';
  }
}

class DestroyCommand extends LifecycleCommand {
  run(model: Model, real: Real): void {
    real.garden.destroy();
    if (!model.destroyed) {
      model.destroyed = true;
      model.state = 'idle';
      model.elapsed = 0;
    }
    assertMatchesModel(model, real);
  }

  toString(): string {
    return 'destroy';
  }
}

const lifecycleCommands = [
  fc.constant(new PlayCommand()),
  fc.constant(new PauseCommand()),
  fc.constant(new StopCommand()),
  fc.integer({ min: -20, max: 40 }).map((time) => new SeekCommand(time)),
  fc.integer({ min: 1, max: 30 }).map((duration) => new SetDurationCommand(duration)),
  fc.integer({ min: 1, max: 8 }).map((speed) => new SetSpeedCommand(speed)),
  fc.integer({ min: 17, max: 2_000 }).map((milliseconds) => new AdvanceFrameCommand(milliseconds)),
  fc.constant(new AdvancePastEndCommand()),
  fc.constant(new RegenerateCommand()),
  fc.constant(new DestroyCommand()),
];

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Garten lifecycle model', () => {
  it('keeps timed playback coherent across shrinkable command sequences', () => {
    let garden: Garten | undefined;
    for (const loop of [false, true]) {
      fc.assert(
        fc.property(fc.commands(lifecycleCommands, { maxCommands: 50 }), (commands) => {
          const frames = createAnimationFrames();
          vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => (
            frames.request(callback)
          ));
          vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.cancel(id));
          const performanceNow = vi.spyOn(performance, 'now').mockImplementation(() => frames.now);

          const container = document.createElement('div');
          document.body.appendChild(container);
          try {
            fc.modelRun(
              () => {
                const created = new Garten({
                  container,
                  autoplay: false,
                  duration: 10,
                  generations: 4,
                  density: 'sparse',
                  loop,
                  respectReducedMotion: false,
                  seed: 42,
                  targetFPS: 60,
                });
                garden = created;
                const model: Model = {
                  state: 'idle',
                  elapsed: 0,
                  duration: 10,
                  speed: 1,
                  loop,
                  destroyed: false,
                };
                return {
                  model,
                  real: { garden: created, frames },
                };
              },
              commands,
            );
          } finally {
            garden?.destroy();
            garden = undefined;
            performanceNow.mockRestore();
            container.remove();
          }
        }),
        { numRuns: 100 },
      );
    }
  });
});
