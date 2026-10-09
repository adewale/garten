import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { EventEmitter, SimpleEventEmitter } from './EventEmitter';
import { GARDEN_EVENT_TYPES, type GardenEventType } from './types';

// ==================== MODEL ====================

/**
 * Reference model of the listener registry. Per event, an ordered list of
 * registrations { handler, once }. Semantics:
 * - emit calls the registrations present when it started, in registration
 *   order, skipping any removed by an earlier handler of the same emit;
 * - once registrations that were called are removed after the emit;
 * - off(event, h) removes the first registration of h;
 * - a throwing handler is logged and does not stop the others;
 * - an event with no registrations disappears from eventNames().
 */
interface Reg { handler: number; once: boolean }

class Model {
  events = new Map<string, Reg[]>();
  log: Array<[number, string, number]> = [];

  add(event: string, handler: number, once: boolean): void {
    if (!this.events.has(event)) this.events.set(event, []);
    this.events.get(event)!.push({ handler, once });
  }

  off(event: string, handler: number): void {
    const list = this.events.get(event);
    if (!list) return;
    const i = list.findIndex((r) => r.handler === handler);
    if (i >= 0) list.splice(i, 1);
    if (list.length === 0) this.events.delete(event);
  }

  // DOM EventTarget / Node semantics: iterate a snapshot, skip registrations
  // removed earlier in this emit, and remove a once registration before its
  // handler runs (so a re-entrant emit cannot deliver it twice)
  emit(event: string, payload: number, react: (handler: number) => void): void {
    const list = this.events.get(event);
    if (!list) return;
    for (const reg of [...list]) {
      if (!list.includes(reg)) continue; // removed earlier in this emit
      if (reg.once) {
        list.splice(list.indexOf(reg), 1);
        if (list.length === 0 && this.events.get(event) === list) this.events.delete(event);
      }
      this.log.push([reg.handler, event, payload]);
      react(reg.handler);
    }
  }

  removeAll(event?: string): void {
    if (event === undefined) this.events.clear();
    else this.events.delete(event);
  }
}

// ==================== COMMANDS ====================

const EVENTS: GardenEventType[] = ['progress', 'complete', 'play'];
const HANDLERS = 4;

type Reaction = { kind: 'none' } | { kind: 'throw' } | { kind: 'off'; event: GardenEventType; target: number };
type Cmd =
  | { kind: 'on' | 'once' | 'off'; event: GardenEventType; handler: number }
  | { kind: 'emit'; event: GardenEventType; payload: number }
  | { kind: 'removeAll'; event: GardenEventType | undefined };

const eventArb = fc.constantFrom(...EVENTS);
const handlerArb = fc.integer({ min: 0, max: HANDLERS - 1 });
const reactionArb: fc.Arbitrary<Reaction> = fc.oneof(
  { weight: 3, arbitrary: fc.constant({ kind: 'none' as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'throw' as const }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('off' as const), event: eventArb, target: handlerArb }) }
);
const cmdArb: fc.Arbitrary<Cmd> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ kind: fc.constantFrom('on' as const, 'once' as const), event: eventArb, handler: handlerArb }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('off' as const), event: eventArb, handler: handlerArb }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('emit' as const), event: eventArb, payload: fc.integer() }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('removeAll' as const), event: fc.option(eventArb, { nil: undefined }) }) }
);

type AnyEmitter = {
  on(e: string, h: (d: number) => void): () => void;
  once(e: string, h: (d: number) => void): () => void;
  off(e: string, h: (d: number) => void): void;
  emit(e: string, d: number): void;
  removeAllListeners(e?: string): void;
};

const SIBLINGS: Array<[string, () => AnyEmitter, boolean]> = [
  ['EventEmitter', () => new EventEmitter() as unknown as AnyEmitter, true],
  ['SimpleEventEmitter', () => new SimpleEventEmitter<Record<string, number>>() as unknown as AnyEmitter, false],
];

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe('Property: the emitter matches the reference model for any command sequence', () => {
  it.each(SIBLINGS)('%s: delivered-call log, order, once and unsubscribe-during-emit', (_name, make, hasIntrospection) => {
    fc.assert(
      fc.property(
        fc.array(reactionArb, { minLength: HANDLERS, maxLength: HANDLERS }),
        fc.array(cmdArb, { maxLength: 50 }),
        (reactions, cmds) => {
          const emitter = make();
          const model = new Model();
          const log: Array<[number, string, number]> = [];
          let currentEvent = '';

          const react = (h: number, onModel: boolean) => {
            const r = reactions[h];
            if (r.kind === 'off') {
              if (onModel) model.off(r.event, r.target);
              else emitter.off(r.event, handlers[r.target]);
            } else if (r.kind === 'throw' && !onModel) {
              throw new Error(`handler ${h}`);
            }
          };
          const handlers = Array.from({ length: HANDLERS }, (_, h) => (payload: number) => {
            log.push([h, currentEvent, payload]);
            react(h, false);
          });

          for (const cmd of cmds) {
            switch (cmd.kind) {
              case 'on':
              case 'once':
                emitter[cmd.kind](cmd.event, handlers[cmd.handler]);
                model.add(cmd.event, cmd.handler, cmd.kind === 'once');
                break;
              case 'off':
                emitter.off(cmd.event, handlers[cmd.handler]);
                model.off(cmd.event, cmd.handler);
                break;
              case 'emit':
                currentEvent = cmd.event;
                emitter.emit(cmd.event, cmd.payload);
                model.emit(cmd.event, cmd.payload, (h) => react(h, true));
                break;
              case 'removeAll':
                emitter.removeAllListeners(cmd.event);
                model.removeAll(cmd.event);
                break;
            }
            expect(log).toEqual(model.log);
            if (hasIntrospection) {
              const ee = emitter as unknown as EventEmitter;
              expect(ee.eventNames()).toEqual([...model.events.keys()]);
              for (const e of GARDEN_EVENT_TYPES) {
                const n = model.events.get(e)?.length ?? 0;
                expect(ee.listenerCount(e)).toBe(n);
                expect(ee.hasListeners(e)).toBe(n > 0);
              }
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ==================== RE-ENTRANCY ====================

describe('Property: re-entrant use during emit', () => {
  it.each(SIBLINGS)('%s: a once listener fires at most once even if its handler re-emits the event', (_name, make) => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 0, max: 3 }), (depth, others) => {
        const emitter = make();
        let calls = 0;
        let level = 0;
        for (let i = 0; i < others; i++) emitter.on('progress', () => {});
        emitter.once('progress', () => {
          calls++;
          if (level < depth) {
            level++;
            emitter.emit('progress', level);
          }
        });
        emitter.emit('progress', 0);
        emitter.emit('progress', 99);
        expect(calls).toBe(1);
      }),
      { numRuns: 5, examples: [[1, 0]] }
    );
  });

  it.each(SIBLINGS)('%s: a listener registered by a handler that just unsubscribed itself stays registered', (_name, make) => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 1, max: 5 }), (payload, later) => {
        const emitter = make();
        const received: number[] = [];
        const replacement = (d: number) => received.push(d);
        const swap = () => {
          emitter.off('progress', swap);
          emitter.on('progress', replacement);
        };
        emitter.on('progress', swap);
        emitter.emit('progress', payload);
        emitter.emit('progress', later);
        expect(received).toContain(later);
      }),
      { numRuns: 5, examples: [[1, 2]] }
    );
  });

  it.each(SIBLINGS)('%s: a listener added during an emit is not called by that same emit', (_name, make) => {
    // DOM EventTarget and Node's EventEmitter both dispatch to the listeners
    // registered when the dispatch started; otherwise a handler that
    // subscribes a fresh closure on each call never terminates.
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), (others) => {
        const emitter = make();
        let added = 0;
        for (let i = 0; i < others; i++) emitter.on('progress', () => {});
        const adder = () => {
          if (added < 50) {
            added++;
            emitter.on('progress', adder);
          }
        };
        emitter.on('progress', adder);
        emitter.emit('progress', 0);
        expect(added).toBe(1);
      }),
      { numRuns: 5, examples: [[0]] }
    );
  });
});

// ==================== EXAMPLES ====================

describe('EventEmitter examples', () => {
  it('delivers the payload and returns a working unsubscribe function', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    const unsubscribe = emitter.on('progress', handler);
    emitter.emit('progress', { progress: 0.5, elapsedTime: 300 });
    expect(handler).toHaveBeenCalledWith({ progress: 0.5, elapsedTime: 300 });
    unsubscribe();
    emitter.emit('progress', { progress: 0.6, elapsedTime: 360 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(emitter.hasListeners('progress')).toBe(false);
  });

  it('logs a throwing handler and still calls the rest', () => {
    const emitter = new EventEmitter();
    const after = vi.fn();
    emitter.on('complete', () => {
      throw new Error('Handler error');
    });
    emitter.on('complete', after);
    emitter.emit('complete', undefined);
    expect(errorSpy).toHaveBeenCalled();
    expect(after).toHaveBeenCalled();
  });

  it('the unsubscribe function of a once registration cancels it before it fires', () => {
    const emitter = new SimpleEventEmitter<Record<string, number>>();
    const handler = vi.fn();
    emitter.once('count', handler)();
    emitter.emit('count', 1);
    expect(handler).not.toHaveBeenCalled();
  });
});
