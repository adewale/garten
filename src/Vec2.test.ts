import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Vec2, MutableVec2, type Point } from './Vec2';

// ==================== ARBITRARIES ====================

/** Every finite double: extremes, subnormals and -0 included */
const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
/** Every double, NaN and ±Infinity included (for exact sibling agreement) */
const anyDouble = fc.double();
const vec = fc.tuple(finite, finite).map(([x, y]) => new Vec2(x, y));
const point = fc.record({ x: finite, y: finite });

/** Object.is on both components: distinguishes -0 and treats NaN as equal */
function same(a: Point, b: Point): boolean {
  return Object.is(a.x, b.x) && Object.is(a.y, b.y);
}

/** IEEE numeric equality (+0 === -0) that also treats NaN as equal to NaN */
function eq(a: number, b: number): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

/**
 * Error model for operations that are approximate by nature (sin/cos,
 * sqrt then divide): a few ulps relative to the magnitude, plus an absolute
 * floor of a few subnormal steps, since each IEEE operation may round by up
 * to half of Number.MIN_VALUE in the subnormal range.
 */
function close(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= 1e-14 * Math.abs(expected) + 8 * Number.MIN_VALUE;
}

// ==================== EXAMPLES ====================

describe('Vec2 examples', () => {
  it('direction factories point the documented way (canvas: up is -y)', () => {
    expect(Vec2.zero().toArray()).toEqual([0, 0]);
    expect(Vec2.up().toArray()).toEqual([0, -1]);
    expect(Vec2.down().toArray()).toEqual([0, 1]);
    expect(Vec2.left().toArray()).toEqual([-1, 0]);
    expect(Vec2.right().toArray()).toEqual([1, 0]);
  });

  it('computes a 3-4-5 triangle exactly', () => {
    const v = new Vec2(3, 4);
    expect(v.length()).toBe(5);
    expect(v.lengthSquared()).toBe(25);
    expect(v.normalize().toArray()).toEqual([0.6, 0.8]);
    expect(v.dot(new Vec2(2, 5))).toBe(26);
    expect(v.cross(new Vec2(2, 5))).toBe(7);
    expect(new Vec2(0, 0).moveTowards(new Vec2(10, 0), 3).toArray()).toEqual([3, 0]);
  });

  it('toString has the documented format', () => {
    expect(new Vec2(3, 4).toString()).toBe('Vec2(3, 4)');
  });
});

// ==================== EXACT ALGEBRAIC LAWS (IEEE-exact, full finite domain) ====================

describe('Property: exact arithmetic laws', () => {
  it('add is commutative (exact: IEEE addition commutes)', () => {
    fc.assert(
      fc.property(vec, vec, (a, b) => {
        expect(same(a.add(b), b.add(a))).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('subtract(b) is add(b.negate()) (exact: IEEE defines x - y as x + -y)', () => {
    fc.assert(
      fc.property(vec, vec, (a, b) => {
        expect(same(a.subtract(b), a.add(b.negate()))).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('negate is an involution and multiply(-1) is negate, multiply(1) the identity (exact)', () => {
    fc.assert(
      fc.property(vec, (v) => {
        expect(same(v.negate().negate(), v)).toBe(true);
        expect(same(v.multiply(-1), v.negate())).toBe(true);
        expect(same(v.multiply(1), v)).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('divide throws exactly for a zero divisor (+0 and -0) and otherwise divides componentwise', () => {
    fc.assert(
      fc.property(vec, finite, (v, s) => {
        if (s === 0) {
          expect(() => v.divide(s)).toThrow(/Division by zero/);
        } else {
          expect(same(v.divide(s), new Vec2(v.x / s, v.y / s))).toBe(true);
        }
      }),
      { numRuns: 2000, examples: [[new Vec2(3, 4), 0], [new Vec2(3, 4), -0]] }
    );
  });

  it('dot is commutative and dot(self) is lengthSquared (exact)', () => {
    fc.assert(
      fc.property(vec, vec, (a, b) => {
        expect(Object.is(a.dot(b), b.dot(a))).toBe(true);
        expect(Object.is(a.dot(a), a.lengthSquared())).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('cross is antisymmetric (exact up to the sign of zero)', () => {
    fc.assert(
      fc.property(vec, vec, (a, b) => {
        expect(eq(a.cross(b), -b.cross(a))).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('perpendicular turns counter-clockwise: cross(v, perp v) is exactly lengthSquared', () => {
    // x*x - y*(-y) and x*x + y*y are bit-identical
    fc.assert(
      fc.property(vec, (v) => {
        expect(Object.is(v.cross(v.perpendicular()), v.lengthSquared())).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('perpendicular twice is negate, and is orthogonal: dot is exactly 0 unless x*y overflows', () => {
    fc.assert(
      fc.property(vec, (v) => {
        expect(same(v.perpendicular().perpendicular(), v.negate())).toBe(true);
        const d = v.dot(v.perpendicular());
        // -(x*y) + y*x is exactly 0 when the product is finite, NaN (Inf - Inf) otherwise
        expect(Number.isFinite(v.x * v.y) ? d === 0 : Number.isNaN(d)).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('round/floor/ceil/abs apply the Math function to each component (exact)', () => {
    const ops = ['round', 'floor', 'ceil', 'abs'] as const;
    fc.assert(
      fc.property(vec, fc.constantFrom(...ops), (v, op) => {
        expect(same(v[op](), new Vec2(Math[op](v.x), Math[op](v.y)))).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });
});

describe('Property: sibling geometry helpers agree exactly', () => {
  it('distance/distanceTo/distanceSquared/distanceToSquared are the length of b - a', () => {
    fc.assert(
      fc.property(vec, point, (a, b) => {
        const diff = new Vec2(b.x, b.y).subtract(a);
        expect(Object.is(Vec2.distance(a, b), diff.length())).toBe(true);
        expect(Object.is(a.distanceTo(b), diff.length())).toBe(true);
        expect(Object.is(Vec2.distanceSquared(a, b), diff.lengthSquared())).toBe(true);
        expect(Object.is(a.distanceToSquared(b), diff.lengthSquared())).toBe(true);
      }),
      // Shrunk: length() is Math.hypot but distance() still squares, so 1.34e154 overflows
      { numRuns: 2000, examples: [[new Vec2(0, 0), { x: 0, y: 1.3407807929942597e154 }]] }
    );
  });

  it('distance is symmetric (exact: (b-a)^2 and (a-b)^2 are bit-identical)', () => {
    fc.assert(
      fc.property(vec, vec, (a, b) => {
        expect(Object.is(a.distanceTo(b), b.distanceTo(a))).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('angleBetween/angleTo are the angle of b - a, and angle() is atan2(y, x)', () => {
    fc.assert(
      fc.property(vec, point, (a, b) => {
        const expected = new Vec2(b.x, b.y).subtract(a).angle();
        expect(Object.is(Vec2.angleBetween(a, b), expected)).toBe(true);
        expect(Object.is(a.angleTo(b), expected)).toBe(true);
        expect(Object.is(a.angle(), Math.atan2(a.y, a.x))).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('static lerp and instance lerp agree exactly for every t', () => {
    fc.assert(
      fc.property(vec, vec, anyDouble, (a, b, t) => {
        expect(same(Vec2.lerp(a, b, t), a.lerp(b, t))).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });
});

// ==================== CONTRACT PROPERTIES ====================

describe('Property: interpolation endpoints are exact', () => {
  it('lerp(a, b, 0) is a and lerp(a, b, 1) is b', () => {
    // Endpoint claims are exact contracts. a + (b - a) * t is not exact at
    // t = 1 (and is NaN at t = 0 when b - a overflows).
    fc.assert(
      fc.property(vec, vec, (a, b) => {
        expect(a.lerp(b, 0).equals(a), 't = 0').toBe(true);
        expect(a.lerp(b, 1).equals(b), 't = 1').toBe(true);
      }),
      { numRuns: 2000, examples: [[new Vec2(0.3, 0), new Vec2(1e-17, 0)]] }
    );
  });

  it('moveTowards returns exactly the target when it is within maxDistance', () => {
    fc.assert(
      fc.property(vec, vec, fc.double({ min: 0, noNaN: true }), (from, to, extra) => {
        const d = from.distanceTo(to);
        fc.pre(Number.isFinite(d));
        expect(same(from.moveTowards(to, d + extra), to)).toBe(true);
      }),
      {
        numRuns: 2000,
        // Shrunk: maxDistance === distanceTo(target), but d * d < dx² + dy² after rounding
        examples: [[new Vec2(-2.5124151918141034e85, 0), new Vec2(0, -4.3557738626421694e83), 0]],
      }
    );
  });
});

describe('Property: normalization and length limits', () => {
  it('normalize gives unit length for every finite non-zero vector, and zero for zero', () => {
    // Documented: "make it unit length". sqrt(x*x + y*y) overflows above
    // ~1.3e154 and underflows below ~1.5e-162, so huge vectors normalize to
    // (0, 0) and tiny ones to the zero vector.
    fc.assert(
      fc.property(vec, (v) => {
        const n = v.normalize();
        if (v.x === 0 && v.y === 0) {
          expect([n.x, n.y]).toEqual([0, 0]);
        } else {
          expect(close(Math.hypot(n.x, n.y), 1), `${v} -> ${n}`).toBe(true);
        }
      }),
      { numRuns: 2000, examples: [[new Vec2(1e200, 0)], [new Vec2(1e-200, 0)]] }
    );
  });

  it('limit(m) returns this when already within m, and never returns a longer vector', () => {
    fc.assert(
      fc.property(vec, fc.double({ min: 0, noNaN: true, noDefaultInfinity: true }), (v, m) => {
        const limited = v.limit(m);
        if (v.lengthSquared() <= m * m) {
          expect(limited).toBe(v);
        } else {
          expect(Math.hypot(limited.x, limited.y) <= m * (1 + 1e-14) + 8 * Number.MIN_VALUE).toBe(true);
        }
      }),
      // Shrunk: x * x is subnormal, so length() loses precision and the result overshoots m
      { numRuns: 2000, examples: [[new Vec2(-4.8776768215499596e-160, 0), 4.733238893013284e-307]] }
    );
  });
});

describe('Property: rotation and projection', () => {
  it('rotate(0) is the identity (exact up to the sign of zero)', () => {
    fc.assert(
      fc.property(vec, (v) => {
        const r = v.rotate(0);
        expect(r.x === v.x && r.y === v.y).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('rotate preserves length within the rounding error model', () => {
    fc.assert(
      fc.property(vec, fc.double({ min: -100, max: 100, noNaN: true }), (v, angle) => {
        const before = Math.hypot(v.x, v.y);
        const r = v.rotate(angle);
        fc.pre(before <= Number.MAX_VALUE / 2); // the rotated components cannot overflow
        expect(close(Math.hypot(r.x, r.y), before), `${v} by ${angle}`).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('fromPolar(angle(), length()) rebuilds the vector within the rounding error model', () => {
    // Overflowing length() is owned by the normalize property above.
    fc.assert(
      fc.property(vec, (v) => {
        const len = v.length();
        fc.pre(Number.isFinite(len) && len >= 1e-150);
        const p = Vec2.fromPolar(v.angle(), len);
        expect(close(p.x, v.x) || Math.abs(p.x - v.x) <= 1e-14 * len).toBe(true);
        expect(close(p.y, v.y) || Math.abs(p.y - v.y) <= 1e-14 * len).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('reflecting off an axis normal mirrors that component exactly (when 2*dot is finite)', () => {
    const normals = [new Vec2(1, 0), new Vec2(-1, 0), new Vec2(0, 1), new Vec2(0, -1)];
    fc.assert(
      fc.property(vec, fc.constantFrom(...normals), (v, n) => {
        fc.pre(Number.isFinite(2 * v.dot(n)));
        const r = v.reflect(n);
        const expected = n.x !== 0 ? [-v.x, v.y] : [v.x, -v.y];
        expect(r.x === expected[0] && r.y === expected[1]).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });

  it('projectOnto an axis unit vector keeps exactly that component; onto zero gives zero', () => {
    fc.assert(
      fc.property(vec, fc.boolean(), (v, onX) => {
        const axis = onX ? Vec2.right() : Vec2.down();
        const p = v.projectOnto(axis);
        expect(onX ? p.x === v.x && p.y === 0 : p.x === 0 && p.y === v.y).toBe(true);
        expect(same(v.projectOnto(Vec2.zero()), Vec2.zero())).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });
});

describe('Property: clamp', () => {
  it('clamp lands inside the box, keeps inside points exactly, and is idempotent', () => {
    fc.assert(
      fc.property(vec, finite, finite, finite, finite, (v, x1, x2, y1, y2) => {
        const [minX, maxX] = x1 <= x2 ? [x1, x2] : [x2, x1];
        const [minY, maxY] = y1 <= y2 ? [y1, y2] : [y2, y1];
        const c = v.clamp(minX, minY, maxX, maxY);
        expect(c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY).toBe(true);
        expect(same(c.clamp(minX, minY, maxX, maxY), c)).toBe(true);
        if (v.x > minX && v.x < maxX && v.y > minY && v.y < maxY) expect(same(c, v)).toBe(true);
      }),
      { numRuns: 2000 }
    );
  });
});

describe('Property: comparison and conversion', () => {
  it('from/fromArray/toArray/toObject/clone round-trip every double exactly', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, (x, y) => {
        const v = new Vec2(x, y);
        expect(same(Vec2.from({ x, y }), v)).toBe(true);
        expect(same(Vec2.fromArray(v.toArray()), v)).toBe(true);
        expect(same(Vec2.from(v.toObject()), v)).toBe(true);
        const c = v.clone();
        expect(c).not.toBe(v);
        expect(same(c, v)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('equals is componentwise ===; isZero is equals(zero); approximatelyEquals is a strict epsilon test', () => {
    fc.assert(
      fc.property(vec, point, fc.double({ min: 0, max: 1e3, noNaN: true }), (a, b, eps) => {
        expect(a.equals(b)).toBe(a.x === b.x && a.y === b.y);
        expect(a.isZero()).toBe(a.equals(Vec2.zero()));
        expect(a.approximatelyEquals(b, eps)).toBe(Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps);
        // Strict: a difference of exactly epsilon is not "approximately equal"
        expect(a.approximatelyEquals(b, Math.abs(a.x - b.x))).toBe(false);
      }),
      { numRuns: 2000 }
    );
  });

  it('toString prints both components', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, (x, y) => {
        expect(new Vec2(x, y).toString()).toBe(`Vec2(${x}, ${y})`);
      }),
      { numRuns: 500 }
    );
  });

  it('temp() hands back one shared instance holding the latest values', () => {
    fc.assert(
      fc.property(finite, finite, finite, finite, (x1, y1, x2, y2) => {
        const first = Vec2.temp(x1, y1);
        expect(same(first, { x: x1, y: y1 })).toBe(true);
        const second = Vec2.temp(x2, y2);
        expect(second).toBe(first);
        expect(same(second, { x: x2, y: y2 })).toBe(true);
      }),
      { numRuns: 500 }
    );
  });
});

// ==================== MUTABLE SIBLING ====================

type Op =
  | { kind: 'set'; x: number; y: number }
  | { kind: 'copy'; p: Point }
  | { kind: 'add'; p: Point }
  | { kind: 'subtract'; p: Point }
  | { kind: 'multiply'; s: number };

const anyPoint = fc.record({ x: anyDouble, y: anyDouble });
const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant('set' as const), x: anyDouble, y: anyDouble }),
  fc.record({ kind: fc.constant('copy' as const), p: anyPoint }),
  fc.record({ kind: fc.constant('add' as const), p: anyPoint }),
  fc.record({ kind: fc.constant('subtract' as const), p: anyPoint }),
  fc.record({ kind: fc.constant('multiply' as const), s: anyDouble })
);

describe('Property: MutableVec2 agrees with Vec2 on every operation', () => {
  it('any op sequence leaves the mutable vector bit-identical to the immutable result', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, fc.array(opArb, { maxLength: 30 }), (x0, y0, ops) => {
        const m = new MutableVec2(x0, y0);
        let v = new Vec2(x0, y0);
        for (const op of ops) {
          let ret: MutableVec2;
          switch (op.kind) {
            case 'set': ret = m.set(op.x, op.y); v = new Vec2(op.x, op.y); break;
            case 'copy': ret = m.copy(op.p); v = Vec2.from(op.p); break;
            case 'add': ret = m.addMut(op.p); v = v.add(op.p); break;
            case 'subtract': ret = m.subtractMut(op.p); v = v.subtract(op.p); break;
            case 'multiply': ret = m.multiplyMut(op.s); v = v.multiply(op.s); break;
          }
          expect(ret).toBe(m); // chaining returns the same instance
          expect(same(m, v), `${op.kind}: ${m.x},${m.y} vs ${v}`).toBe(true);
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('toVec2 snapshots the current values into an independent Vec2', () => {
    fc.assert(
      fc.property(anyDouble, anyDouble, opArb, (x, y, later) => {
        const m = new MutableVec2(x, y);
        const snap = m.toVec2();
        expect(snap).toBeInstanceOf(Vec2);
        expect(same(snap, { x, y })).toBe(true);
        if (later.kind === 'set') m.set(later.x, later.y);
        else m.multiplyMut(2);
        expect(same(snap, { x, y })).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('defaults to the zero vector', () => {
    const m = new MutableVec2();
    expect(same(m, Vec2.zero())).toBe(true);
  });
});
