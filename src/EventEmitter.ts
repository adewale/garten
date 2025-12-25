/**
 * EventEmitter - Type-safe event emitter for Garden
 * Provides a pub/sub pattern for garden events
 */

import type { GardenEventType, GardenEventData, GardenEventHandler } from './types';

/**
 * Type-safe event listener entry
 */
interface Listener<T> {
  handler: GardenEventHandler<T>;
  once: boolean;
}

/**
 * EventEmitter class - Type-safe event emitter
 *
 * Usage:
 * ```typescript
 * const emitter = new EventEmitter();
 *
 * // Subscribe to events
 * const unsubscribe = emitter.on('progress', ({ progress, elapsedTime }) => {
 *   console.log(`Progress: ${progress * 100}%`);
 * });
 *
 * // Emit events
 * emitter.emit('progress', { progress: 0.5, elapsedTime: 300 });
 *
 * // Unsubscribe
 * unsubscribe();
 *
 * // Or use once for single-fire events
 * emitter.once('complete', () => {
 *   console.log('Animation complete!');
 * });
 * ```
 */
export class EventEmitter {
  private listeners: Map<GardenEventType, Set<Listener<unknown>>> = new Map();

  /**
   * Subscribe to an event
   * @param event Event type to listen for
   * @param handler Handler function
   * @returns Unsubscribe function
   */
  on<K extends GardenEventType>(
    event: K,
    handler: GardenEventHandler<GardenEventData[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const listener: Listener<GardenEventData[K]> = { handler, once: false };
    this.listeners.get(event)!.add(listener as Listener<unknown>);

    // Return unsubscribe function
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Subscribe to an event for one occurrence only
   * @param event Event type to listen for
   * @param handler Handler function
   * @returns Unsubscribe function
   */
  once<K extends GardenEventType>(
    event: K,
    handler: GardenEventHandler<GardenEventData[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const listener: Listener<GardenEventData[K]> = { handler, once: true };
    this.listeners.get(event)!.add(listener as Listener<unknown>);

    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Unsubscribe from an event
   * @param event Event type
   * @param handler Handler to remove
   */
  off<K extends GardenEventType>(
    event: K,
    handler: GardenEventHandler<GardenEventData[K]>
  ): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    for (const listener of listeners) {
      if (listener.handler === handler) {
        listeners.delete(listener);
        break;
      }
    }

    // Clean up empty sets
    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit an event
   * @param event Event type
   * @param data Event data
   */
  emit<K extends GardenEventType>(event: K, data: GardenEventData[K]): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    const toRemove: Listener<unknown>[] = [];

    for (const listener of listeners) {
      try {
        (listener.handler as GardenEventHandler<GardenEventData[K]>)(data);
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
      }

      if (listener.once) {
        toRemove.push(listener);
      }
    }

    // Remove once listeners
    for (const listener of toRemove) {
      listeners.delete(listener);
    }

    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Check if there are any listeners for an event
   */
  hasListeners(event: GardenEventType): boolean {
    const listeners = this.listeners.get(event);
    return listeners !== undefined && listeners.size > 0;
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: GardenEventType): number {
    const listeners = this.listeners.get(event);
    return listeners ? listeners.size : 0;
  }

  /**
   * Remove all listeners for a specific event or all events
   */
  removeAllListeners(event?: GardenEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get all registered event types
   */
  eventNames(): GardenEventType[] {
    return Array.from(this.listeners.keys());
  }
}

/**
 * Create a simple event emitter for basic use cases
 * Not tied to GardenEventType for general-purpose usage
 */
export class SimpleEventEmitter<EventMap extends Record<string, unknown>> {
  private listeners: Map<keyof EventMap, Set<Listener<unknown>>> = new Map();

  on<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const listener: Listener<EventMap[K]> = {
      handler: handler as GardenEventHandler<unknown>,
      once: false,
    };
    this.listeners.get(event)!.add(listener as Listener<unknown>);

    return () => this.off(event, handler);
  }

  once<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const listener: Listener<EventMap[K]> = {
      handler: handler as GardenEventHandler<unknown>,
      once: true,
    };
    this.listeners.get(event)!.add(listener as Listener<unknown>);

    return () => this.off(event, handler);
  }

  off<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void
  ): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    for (const listener of listeners) {
      if (listener.handler === handler) {
        listeners.delete(listener);
        break;
      }
    }

    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    const toRemove: Listener<unknown>[] = [];

    for (const listener of listeners) {
      try {
        listener.handler(data);
      } catch (error) {
        console.error(`Error in event handler for "${String(event)}":`, error);
      }

      if (listener.once) {
        toRemove.push(listener);
      }
    }

    for (const listener of toRemove) {
      listeners.delete(listener);
    }

    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
