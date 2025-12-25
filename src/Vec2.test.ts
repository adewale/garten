import { describe, it, expect } from 'vitest';
import { Vec2, MutableVec2 } from './Vec2';

describe('Vec2', () => {
  describe('constructor', () => {
    it('should create a vector with x and y', () => {
      const v = new Vec2(3, 4);
      expect(v.x).toBe(3);
      expect(v.y).toBe(4);
    });
  });

  describe('static factories', () => {
    it('should create from point object', () => {
      const v = Vec2.from({ x: 5, y: 10 });
      expect(v.x).toBe(5);
      expect(v.y).toBe(10);
    });

    it('should create from array', () => {
      const v = Vec2.fromArray([3, 7]);
      expect(v.x).toBe(3);
      expect(v.y).toBe(7);
    });

    it('should create from polar coordinates', () => {
      const v = Vec2.fromPolar(0, 5);
      expect(v.x).toBeCloseTo(5, 5);
      expect(v.y).toBeCloseTo(0, 5);
    });

    it('should create zero vector', () => {
      const v = Vec2.zero();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });

    it('should create direction vectors', () => {
      expect(Vec2.up().y).toBe(-1);
      expect(Vec2.down().y).toBe(1);
      expect(Vec2.left().x).toBe(-1);
      expect(Vec2.right().x).toBe(1);
    });
  });

  describe('arithmetic operations', () => {
    it('should add vectors', () => {
      const a = new Vec2(3, 4);
      const b = new Vec2(1, 2);
      const c = a.add(b);
      expect(c.x).toBe(4);
      expect(c.y).toBe(6);
    });

    it('should subtract vectors', () => {
      const a = new Vec2(5, 7);
      const b = new Vec2(2, 3);
      const c = a.subtract(b);
      expect(c.x).toBe(3);
      expect(c.y).toBe(4);
    });

    it('should multiply by scalar', () => {
      const v = new Vec2(3, 4);
      const scaled = v.multiply(2);
      expect(scaled.x).toBe(6);
      expect(scaled.y).toBe(8);
    });

    it('should divide by scalar', () => {
      const v = new Vec2(6, 8);
      const divided = v.divide(2);
      expect(divided.x).toBe(3);
      expect(divided.y).toBe(4);
    });

    it('should throw on division by zero', () => {
      const v = new Vec2(3, 4);
      expect(() => v.divide(0)).toThrow();
    });

    it('should negate', () => {
      const v = new Vec2(3, -4);
      const neg = v.negate();
      expect(neg.x).toBe(-3);
      expect(neg.y).toBe(4);
    });
  });

  describe('vector operations', () => {
    it('should calculate length', () => {
      const v = new Vec2(3, 4);
      expect(v.length()).toBe(5);
    });

    it('should calculate squared length', () => {
      const v = new Vec2(3, 4);
      expect(v.lengthSquared()).toBe(25);
    });

    it('should normalize', () => {
      const v = new Vec2(3, 4);
      const n = v.normalize();
      expect(n.length()).toBeCloseTo(1, 5);
      expect(n.x).toBeCloseTo(0.6, 5);
      expect(n.y).toBeCloseTo(0.8, 5);
    });

    it('should handle zero vector normalization', () => {
      const v = Vec2.zero();
      const n = v.normalize();
      expect(n.x).toBe(0);
      expect(n.y).toBe(0);
    });

    it('should set length', () => {
      const v = new Vec2(3, 4);
      const scaled = v.setLength(10);
      expect(scaled.length()).toBeCloseTo(10, 5);
    });

    it('should limit length', () => {
      const v = new Vec2(3, 4);
      const limited = v.limit(3);
      expect(limited.length()).toBeCloseTo(3, 5);
    });

    it('should not limit if under max', () => {
      const v = new Vec2(3, 4);
      const limited = v.limit(10);
      expect(limited.length()).toBe(5);
    });

    it('should calculate dot product', () => {
      const a = new Vec2(3, 4);
      const b = new Vec2(2, 5);
      expect(a.dot(b)).toBe(26);
    });

    it('should calculate cross product', () => {
      const a = new Vec2(3, 4);
      const b = new Vec2(2, 5);
      expect(a.cross(b)).toBe(7); // 3*5 - 4*2 = 7
    });

    it('should calculate angle', () => {
      const v = new Vec2(1, 0);
      expect(v.angle()).toBe(0);

      const v2 = new Vec2(0, 1);
      expect(v2.angle()).toBeCloseTo(Math.PI / 2, 5);
    });

    it('should rotate', () => {
      const v = new Vec2(1, 0);
      const rotated = v.rotate(Math.PI / 2);
      expect(rotated.x).toBeCloseTo(0, 5);
      expect(rotated.y).toBeCloseTo(1, 5);
    });

    it('should get perpendicular', () => {
      const v = new Vec2(1, 0);
      const perp = v.perpendicular();
      // Use toBeCloseTo to handle -0 vs 0 (IEEE 754 floating point)
      expect(perp.x).toBeCloseTo(0);
      expect(perp.y).toBeCloseTo(1);
    });
  });

  describe('interpolation', () => {
    it('should lerp between vectors', () => {
      const a = new Vec2(0, 0);
      const b = new Vec2(10, 10);
      const mid = a.lerp(b, 0.5);
      expect(mid.x).toBe(5);
      expect(mid.y).toBe(5);
    });

    it('should use static lerp', () => {
      const a = new Vec2(0, 0);
      const b = new Vec2(10, 10);
      const mid = Vec2.lerp(a, b, 0.5);
      expect(mid.x).toBe(5);
      expect(mid.y).toBe(5);
    });

    it('should move towards target', () => {
      const a = new Vec2(0, 0);
      const b = new Vec2(10, 0);
      const moved = a.moveTowards(b, 3);
      expect(moved.x).toBe(3);
      expect(moved.y).toBe(0);
    });
  });

  describe('distance', () => {
    it('should calculate distance to point', () => {
      const a = new Vec2(0, 0);
      const b = { x: 3, y: 4 };
      expect(a.distanceTo(b)).toBe(5);
    });

    it('should calculate squared distance', () => {
      const a = new Vec2(0, 0);
      const b = { x: 3, y: 4 };
      expect(a.distanceToSquared(b)).toBe(25);
    });

    it('should use static distance', () => {
      const a = { x: 0, y: 0 };
      const b = { x: 3, y: 4 };
      expect(Vec2.distance(a, b)).toBe(5);
    });
  });

  describe('utility methods', () => {
    it('should clamp to bounds', () => {
      const v = new Vec2(15, -5);
      const clamped = v.clamp(0, 0, 10, 10);
      expect(clamped.x).toBe(10);
      expect(clamped.y).toBe(0);
    });

    it('should round', () => {
      const v = new Vec2(3.7, 4.2);
      const rounded = v.round();
      expect(rounded.x).toBe(4);
      expect(rounded.y).toBe(4);
    });

    it('should floor', () => {
      const v = new Vec2(3.7, 4.2);
      const floored = v.floor();
      expect(floored.x).toBe(3);
      expect(floored.y).toBe(4);
    });

    it('should ceil', () => {
      const v = new Vec2(3.1, 4.9);
      const ceiled = v.ceil();
      expect(ceiled.x).toBe(4);
      expect(ceiled.y).toBe(5);
    });

    it('should get absolute values', () => {
      const v = new Vec2(-3, -4);
      const abs = v.abs();
      expect(abs.x).toBe(3);
      expect(abs.y).toBe(4);
    });
  });

  describe('comparison', () => {
    it('should check equality', () => {
      const a = new Vec2(3, 4);
      const b = new Vec2(3, 4);
      const c = new Vec2(3, 5);
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });

    it('should check approximate equality', () => {
      const a = new Vec2(3.0, 4.0);
      const b = new Vec2(3.00001, 4.00001);
      expect(a.approximatelyEquals(b, 0.0001)).toBe(true);
      expect(a.approximatelyEquals(b, 0.000001)).toBe(false);
    });

    it('should check if zero', () => {
      expect(Vec2.zero().isZero()).toBe(true);
      expect(new Vec2(1, 0).isZero()).toBe(false);
    });
  });

  describe('conversion', () => {
    it('should convert to array', () => {
      const v = new Vec2(3, 4);
      expect(v.toArray()).toEqual([3, 4]);
    });

    it('should convert to object', () => {
      const v = new Vec2(3, 4);
      expect(v.toObject()).toEqual({ x: 3, y: 4 });
    });

    it('should clone', () => {
      const v = new Vec2(3, 4);
      const clone = v.clone();
      expect(clone.x).toBe(3);
      expect(clone.y).toBe(4);
      expect(clone).not.toBe(v);
    });

    it('should convert to string', () => {
      const v = new Vec2(3, 4);
      expect(v.toString()).toBe('Vec2(3, 4)');
    });
  });
});

describe('MutableVec2', () => {
  it('should allow mutation', () => {
    const v = new MutableVec2(0, 0);
    v.set(3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });

  it('should copy from another point', () => {
    const v = new MutableVec2(0, 0);
    v.copy({ x: 5, y: 10 });
    expect(v.x).toBe(5);
    expect(v.y).toBe(10);
  });

  it('should add in place', () => {
    const v = new MutableVec2(3, 4);
    v.addMut({ x: 1, y: 2 });
    expect(v.x).toBe(4);
    expect(v.y).toBe(6);
  });

  it('should subtract in place', () => {
    const v = new MutableVec2(5, 7);
    v.subtractMut({ x: 2, y: 3 });
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });

  it('should multiply in place', () => {
    const v = new MutableVec2(3, 4);
    v.multiplyMut(2);
    expect(v.x).toBe(6);
    expect(v.y).toBe(8);
  });

  it('should convert to immutable Vec2', () => {
    const mv = new MutableVec2(3, 4);
    const v = mv.toVec2();
    expect(v).toBeInstanceOf(Vec2);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });
});
