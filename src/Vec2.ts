/**
 * Vec2 Value Object - 2D point/vector representation
 * Provides immutable point operations commonly used in canvas rendering
 */

/**
 * Simple point interface for interoperability
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 2D Vector value object with comprehensive vector operations
 * Immutable - all operations return new Vec2 instances
 */
export class Vec2 implements Point {
  readonly x: number;
  readonly y: number;

  // Reusable temporary vector for output parameters to reduce allocations
  private static _tempVec: Vec2 = new Vec2(0, 0);

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  // ==================== STATIC FACTORIES ====================

  /**
   * Create a Vec2 from a Point-like object
   */
  static from(point: Point): Vec2 {
    return new Vec2(point.x, point.y);
  }

  /**
   * Create a Vec2 from an array [x, y]
   */
  static fromArray(arr: [number, number]): Vec2 {
    return new Vec2(arr[0], arr[1]);
  }

  /**
   * Create a Vec2 from polar coordinates
   * @param angle Angle in radians
   * @param length Length (radius)
   */
  static fromPolar(angle: number, length: number): Vec2 {
    return new Vec2(
      Math.cos(angle) * length,
      Math.sin(angle) * length
    );
  }

  /**
   * Create a zero vector
   */
  static zero(): Vec2 {
    return new Vec2(0, 0);
  }

  /**
   * Create a unit vector pointing up (negative Y in canvas coordinates)
   */
  static up(): Vec2 {
    return new Vec2(0, -1);
  }

  /**
   * Create a unit vector pointing down
   */
  static down(): Vec2 {
    return new Vec2(0, 1);
  }

  /**
   * Create a unit vector pointing left
   */
  static left(): Vec2 {
    return new Vec2(-1, 0);
  }

  /**
   * Create a unit vector pointing right
   */
  static right(): Vec2 {
    return new Vec2(1, 0);
  }

  /**
   * Linear interpolation between two vectors
   * @param a Start vector
   * @param b End vector
   * @param t Interpolation factor (0-1)
   */
  static lerp(a: Vec2, b: Vec2, t: number): Vec2 {
    return new Vec2(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t
    );
  }

  /**
   * Get distance between two points
   */
  static distance(a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get squared distance between two points (faster, no sqrt)
   */
  static distanceSquared(a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return dx * dx + dy * dy;
  }

  /**
   * Get angle from point a to point b
   */
  static angleBetween(a: Point, b: Point): number {
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  /**
   * Get a temporary Vec2 for use as output parameter to avoid allocations
   * WARNING: This returns the same instance each time, do not store the result
   */
  static temp(x: number, y: number): Vec2 {
    (Vec2._tempVec as { x: number; y: number }).x = x;
    (Vec2._tempVec as { x: number; y: number }).y = y;
    return Vec2._tempVec;
  }

  // ==================== ARITHMETIC OPERATIONS ====================

  /**
   * Add another vector
   */
  add(other: Point): Vec2 {
    return new Vec2(this.x + other.x, this.y + other.y);
  }

  /**
   * Subtract another vector
   */
  subtract(other: Point): Vec2 {
    return new Vec2(this.x - other.x, this.y - other.y);
  }

  /**
   * Multiply by a scalar
   */
  multiply(scalar: number): Vec2 {
    return new Vec2(this.x * scalar, this.y * scalar);
  }

  /**
   * Divide by a scalar
   */
  divide(scalar: number): Vec2 {
    if (scalar === 0) {
      throw new Error('Vec2: Division by zero');
    }
    return new Vec2(this.x / scalar, this.y / scalar);
  }

  /**
   * Negate the vector
   */
  negate(): Vec2 {
    return new Vec2(-this.x, -this.y);
  }

  // ==================== VECTOR OPERATIONS ====================

  /**
   * Get the length (magnitude) of the vector
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Get the squared length (faster, no sqrt)
   */
  lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Normalize the vector (make it unit length)
   */
  normalize(): Vec2 {
    const len = this.length();
    if (len === 0) {
      return new Vec2(0, 0);
    }
    return new Vec2(this.x / len, this.y / len);
  }

  /**
   * Set the length of the vector
   */
  setLength(length: number): Vec2 {
    return this.normalize().multiply(length);
  }

  /**
   * Limit the length of the vector
   */
  limit(maxLength: number): Vec2 {
    const lenSq = this.lengthSquared();
    if (lenSq > maxLength * maxLength) {
      return this.setLength(maxLength);
    }
    return this;
  }

  /**
   * Dot product with another vector
   */
  dot(other: Point): number {
    return this.x * other.x + this.y * other.y;
  }

  /**
   * Cross product (returns scalar, the z-component of 3D cross product)
   */
  cross(other: Point): number {
    return this.x * other.y - this.y * other.x;
  }

  /**
   * Get the angle of the vector in radians
   */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /**
   * Rotate the vector by an angle
   * @param angle Angle in radians
   */
  rotate(angle: number): Vec2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vec2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  /**
   * Get perpendicular vector (rotated 90 degrees counter-clockwise)
   */
  perpendicular(): Vec2 {
    return new Vec2(-this.y, this.x);
  }

  /**
   * Reflect vector off a surface with the given normal
   */
  reflect(normal: Vec2): Vec2 {
    const d = 2 * this.dot(normal);
    return new Vec2(
      this.x - d * normal.x,
      this.y - d * normal.y
    );
  }

  /**
   * Project this vector onto another vector
   */
  projectOnto(other: Vec2): Vec2 {
    const lenSq = other.lengthSquared();
    if (lenSq === 0) {
      return Vec2.zero();
    }
    const scalar = this.dot(other) / lenSq;
    return other.multiply(scalar);
  }

  // ==================== INTERPOLATION ====================

  /**
   * Linear interpolation to another vector
   * @param target Target vector
   * @param t Interpolation factor (0-1)
   */
  lerp(target: Point, t: number): Vec2 {
    return new Vec2(
      this.x + (target.x - this.x) * t,
      this.y + (target.y - this.y) * t
    );
  }

  /**
   * Move towards a target by a maximum distance
   */
  moveTowards(target: Point, maxDistance: number): Vec2 {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distSq = dx * dx + dy * dy;

    if (distSq === 0 || distSq <= maxDistance * maxDistance) {
      return new Vec2(target.x, target.y);
    }

    const dist = Math.sqrt(distSq);
    return new Vec2(
      this.x + (dx / dist) * maxDistance,
      this.y + (dy / dist) * maxDistance
    );
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get distance to another point
   */
  distanceTo(other: Point): number {
    return Vec2.distance(this, other);
  }

  /**
   * Get squared distance to another point (faster, no sqrt)
   */
  distanceToSquared(other: Point): number {
    return Vec2.distanceSquared(this, other);
  }

  /**
   * Get angle to another point
   */
  angleTo(other: Point): number {
    return Vec2.angleBetween(this, other);
  }

  /**
   * Clamp coordinates to a rectangular region
   */
  clamp(minX: number, minY: number, maxX: number, maxY: number): Vec2 {
    return new Vec2(
      Math.max(minX, Math.min(maxX, this.x)),
      Math.max(minY, Math.min(maxY, this.y))
    );
  }

  /**
   * Round coordinates to integers
   */
  round(): Vec2 {
    return new Vec2(Math.round(this.x), Math.round(this.y));
  }

  /**
   * Floor coordinates
   */
  floor(): Vec2 {
    return new Vec2(Math.floor(this.x), Math.floor(this.y));
  }

  /**
   * Ceil coordinates
   */
  ceil(): Vec2 {
    return new Vec2(Math.ceil(this.x), Math.ceil(this.y));
  }

  /**
   * Get absolute values
   */
  abs(): Vec2 {
    return new Vec2(Math.abs(this.x), Math.abs(this.y));
  }

  // ==================== COMPARISON METHODS ====================

  /**
   * Check if this vector equals another (exact comparison)
   */
  equals(other: Point): boolean {
    return this.x === other.x && this.y === other.y;
  }

  /**
   * Check if this vector is approximately equal to another
   * @param epsilon Maximum difference allowed
   */
  approximatelyEquals(other: Point, epsilon: number = 0.0001): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon &&
      Math.abs(this.y - other.y) < epsilon
    );
  }

  /**
   * Check if the vector is zero
   */
  isZero(): boolean {
    return this.x === 0 && this.y === 0;
  }

  // ==================== CONVERSION ====================

  /**
   * Convert to array
   */
  toArray(): [number, number] {
    return [this.x, this.y];
  }

  /**
   * Convert to plain object
   */
  toObject(): Point {
    return { x: this.x, y: this.y };
  }

  /**
   * Clone this vector
   */
  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  /**
   * String representation
   */
  toString(): string {
    return `Vec2(${this.x}, ${this.y})`;
  }
}

// ==================== MUTABLE VECTOR FOR HOT PATHS ====================

/**
 * Mutable version of Vec2 for performance-critical code
 * Use with caution - mutations can lead to bugs
 */
export class MutableVec2 implements Point {
  x: number;
  y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * Set both coordinates
   */
  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Copy from another point
   */
  copy(other: Point): this {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  /**
   * Add in place
   */
  addMut(other: Point): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  /**
   * Subtract in place
   */
  subtractMut(other: Point): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  /**
   * Multiply by scalar in place
   */
  multiplyMut(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  /**
   * Convert to immutable Vec2
   */
  toVec2(): Vec2 {
    return new Vec2(this.x, this.y);
  }
}
