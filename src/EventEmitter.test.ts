import { describe, it, expect, vi } from 'vitest';
import { EventEmitter, SimpleEventEmitter } from './EventEmitter';

describe('EventEmitter', () => {
  describe('on', () => {
    it('should subscribe to events', () => {
      const emitter = new EventEmitter();
      const handler = vi.fn();

      emitter.on('progress', handler);
      emitter.emit('progress', { progress: 0.5, elapsedTime: 300 });

      expect(handler).toHaveBeenCalledWith({ progress: 0.5, elapsedTime: 300 });
    });

    it('should return unsubscribe function', () => {
      const emitter = new EventEmitter();
      const handler = vi.fn();

      const unsubscribe = emitter.on('progress', handler);
      unsubscribe();
      emitter.emit('progress', { progress: 0.5, elapsedTime: 300 });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow multiple handlers for same event', () => {
      const emitter = new EventEmitter();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('complete', handler1);
      emitter.on('complete', handler2);
      emitter.emit('complete', undefined);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('should only fire once', () => {
      const emitter = new EventEmitter();
      const handler = vi.fn();

      emitter.once('complete', handler);
      emitter.emit('complete', undefined);
      emitter.emit('complete', undefined);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('off', () => {
    it('should unsubscribe specific handler', () => {
      const emitter = new EventEmitter();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('progress', handler1);
      emitter.on('progress', handler2);
      emitter.off('progress', handler1);
      emitter.emit('progress', { progress: 0.5, elapsedTime: 300 });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('should not throw if no handlers', () => {
      const emitter = new EventEmitter();
      expect(() => emitter.emit('complete', undefined)).not.toThrow();
    });

    it('should catch handler errors', () => {
      const emitter = new EventEmitter();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      emitter.on('complete', () => {
        throw new Error('Handler error');
      });
      emitter.emit('complete', undefined);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('hasListeners', () => {
    it('should return true if listeners exist', () => {
      const emitter = new EventEmitter();
      emitter.on('complete', () => {});
      expect(emitter.hasListeners('complete')).toBe(true);
    });

    it('should return false if no listeners', () => {
      const emitter = new EventEmitter();
      expect(emitter.hasListeners('complete')).toBe(false);
    });
  });

  describe('listenerCount', () => {
    it('should return number of listeners', () => {
      const emitter = new EventEmitter();
      emitter.on('progress', () => {});
      emitter.on('progress', () => {});
      expect(emitter.listenerCount('progress')).toBe(2);
    });

    it('should return 0 for no listeners', () => {
      const emitter = new EventEmitter();
      expect(emitter.listenerCount('progress')).toBe(0);
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for an event', () => {
      const emitter = new EventEmitter();
      emitter.on('progress', () => {});
      emitter.on('complete', () => {});

      emitter.removeAllListeners('progress');

      expect(emitter.hasListeners('progress')).toBe(false);
      expect(emitter.hasListeners('complete')).toBe(true);
    });

    it('should remove all listeners when no event specified', () => {
      const emitter = new EventEmitter();
      emitter.on('progress', () => {});
      emitter.on('complete', () => {});

      emitter.removeAllListeners();

      expect(emitter.hasListeners('progress')).toBe(false);
      expect(emitter.hasListeners('complete')).toBe(false);
    });
  });

  describe('eventNames', () => {
    it('should return list of event names with listeners', () => {
      const emitter = new EventEmitter();
      emitter.on('progress', () => {});
      emitter.on('complete', () => {});

      const names = emitter.eventNames();
      expect(names).toContain('progress');
      expect(names).toContain('complete');
    });
  });
});

describe('SimpleEventEmitter', () => {
  interface TestEvents {
    message: string;
    count: number;
  }

  it('should work with custom event types', () => {
    const emitter = new SimpleEventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on('message', handler);
    emitter.emit('message', 'hello');

    expect(handler).toHaveBeenCalledWith('hello');
  });

  it('should support once', () => {
    const emitter = new SimpleEventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.once('count', handler);
    emitter.emit('count', 1);
    emitter.emit('count', 2);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('should support off', () => {
    const emitter = new SimpleEventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on('message', handler);
    emitter.off('message', handler);
    emitter.emit('message', 'test');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should support removeAllListeners', () => {
    const emitter = new SimpleEventEmitter<TestEvents>();
    emitter.on('message', () => {});
    emitter.on('count', () => {});

    emitter.removeAllListeners();

    // Should not throw when emitting to removed listeners
    expect(() => emitter.emit('message', 'test')).not.toThrow();
  });
});
