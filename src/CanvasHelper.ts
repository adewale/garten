/**
 * CanvasHelper - Canvas drawing utilities for common operations
 * Provides a fluent API for common canvas drawing patterns
 */

import { GEOMETRY, CANVAS_STYLE } from './constants';

/**
 * Common drawing context type
 */
type Ctx = CanvasRenderingContext2D;

/**
 * Stem drawing result with end position
 */
export interface StemResult {
  endX: number;
  endY: number;
}

/**
 * Reusable stem result to avoid allocations in hot paths
 */
const _stemResult: StemResult = { endX: 0, endY: 0 };

/**
 * CanvasHelper class - Provides common canvas drawing utilities
 *
 * Usage:
 * ```typescript
 * const helper = new CanvasHelper(ctx);
 *
 * // Draw a stem and get end position
 * const end = helper.drawStem(x, baseY, height, thickness, color, lean, growth);
 *
 * // Draw leaf pair
 * helper.drawLeafPair(x, y, leftAngle, rightAngle, size, color);
 *
 * // Draw with state management
 * helper.withState(() => {
 *   helper.translate(x, y);
 *   helper.rotate(angle);
 *   helper.drawEllipse(0, 0, rx, ry, color);
 * });
 * ```
 */
export class CanvasHelper {
  private readonly ctx: Ctx;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  // ==================== STATE MANAGEMENT ====================

  /**
   * Execute a function with saved canvas state
   * Automatically saves and restores
   */
  withState(fn: () => void): void {
    this.ctx.save();
    try {
      fn();
    } finally {
      this.ctx.restore();
    }
  }

  /**
   * Save canvas state
   */
  save(): this {
    this.ctx.save();
    return this;
  }

  /**
   * Restore canvas state
   */
  restore(): this {
    this.ctx.restore();
    return this;
  }

  // ==================== TRANSFORMS ====================

  /**
   * Translate origin
   */
  translate(x: number, y: number): this {
    this.ctx.translate(x, y);
    return this;
  }

  /**
   * Rotate canvas
   * @param angle Angle in radians
   */
  rotate(angle: number): this {
    this.ctx.rotate(angle);
    return this;
  }

  /**
   * Scale canvas
   */
  scale(x: number, y: number = x): this {
    this.ctx.scale(x, y);
    return this;
  }

  /**
   * Reset transform to identity
   */
  resetTransform(): this {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    return this;
  }

  // ==================== STYLE SETTERS ====================

  /**
   * Set fill style
   */
  setFill(color: string): this {
    this.ctx.fillStyle = color;
    return this;
  }

  /**
   * Set stroke style
   */
  setStroke(color: string, width?: number): this {
    this.ctx.strokeStyle = color;
    if (width !== undefined) {
      this.ctx.lineWidth = width;
    }
    return this;
  }

  /**
   * Set line width
   */
  setLineWidth(width: number): this {
    this.ctx.lineWidth = width;
    return this;
  }

  /**
   * Set line cap
   */
  setLineCap(cap: CanvasLineCap): this {
    this.ctx.lineCap = cap;
    return this;
  }

  /**
   * Set global alpha
   */
  setAlpha(alpha: number): this {
    this.ctx.globalAlpha = alpha;
    return this;
  }

  /**
   * Set composite operation
   */
  setComposite(operation: GlobalCompositeOperation): this {
    this.ctx.globalCompositeOperation = operation;
    return this;
  }

  // ==================== BASIC SHAPES ====================

  /**
   * Fill a rectangle
   */
  fillRect(x: number, y: number, width: number, height: number, color?: string): this {
    if (color) {
      this.ctx.fillStyle = color;
    }
    this.ctx.fillRect(x, y, width, height);
    return this;
  }

  /**
   * Stroke a rectangle
   */
  strokeRect(x: number, y: number, width: number, height: number, color?: string): this {
    if (color) {
      this.ctx.strokeStyle = color;
    }
    this.ctx.strokeRect(x, y, width, height);
    return this;
  }

  /**
   * Fill a circle
   */
  fillCircle(x: number, y: number, radius: number, color?: string): this {
    if (radius <= 0) return this;

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, GEOMETRY.TWO_PI);
    if (color) {
      this.ctx.fillStyle = color;
    }
    this.ctx.fill();
    return this;
  }

  /**
   * Stroke a circle
   */
  strokeCircle(x: number, y: number, radius: number, color?: string): this {
    if (radius <= 0) return this;

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, GEOMETRY.TWO_PI);
    if (color) {
      this.ctx.strokeStyle = color;
    }
    this.ctx.stroke();
    return this;
  }

  /**
   * Fill an ellipse
   */
  fillEllipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number = 0,
    color?: string
  ): this {
    if (radiusX <= 0 || radiusY <= 0) return this;

    this.ctx.beginPath();
    this.ctx.ellipse(x, y, radiusX, radiusY, rotation, 0, GEOMETRY.TWO_PI);
    if (color) {
      this.ctx.fillStyle = color;
    }
    this.ctx.fill();
    return this;
  }

  /**
   * Draw a line
   */
  line(x1: number, y1: number, x2: number, y2: number, color?: string, width?: number): this {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    if (color) {
      this.ctx.strokeStyle = color;
    }
    if (width !== undefined) {
      this.ctx.lineWidth = width;
    }
    this.ctx.stroke();
    return this;
  }

  // ==================== PLANT-SPECIFIC DRAWING ====================

  /**
   * Draw a curved stem and return the end position
   * Uses output parameter to avoid allocation
   * @returns The end position of the stem, or null if growth <= 0
   */
  drawStem(
    x: number,
    y: number,
    height: number,
    thickness: number,
    color: string,
    lean: number,
    growth: number,
    result: StemResult = _stemResult
  ): StemResult | null {
    if (growth <= 0) return null;

    const h = height * Math.min(1, growth);

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);

    // Control points for natural curve
    const cp1x = x + lean * h * GEOMETRY.STEM_CP1_LEAN;
    const cp1y = y - h * GEOMETRY.STEM_CP1_HEIGHT;
    const cp2x = x + lean * h * GEOMETRY.STEM_CP2_LEAN;
    const cp2y = y - h * GEOMETRY.STEM_CP2_HEIGHT;
    const endX = x + lean * h;
    const endY = y - h;

    this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = thickness;
    this.ctx.lineCap = CANVAS_STYLE.LINE_CAP;
    this.ctx.stroke();

    result.endX = endX;
    result.endY = endY;
    return result;
  }

  /**
   * Draw a leaf shape
   */
  drawLeaf(x: number, y: number, angle: number, size: number, color: string): this {
    if (size < 1) return this;

    this.withState(() => {
      this.ctx.translate(x, y);
      this.ctx.rotate(angle);

      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.bezierCurveTo(
        size * 0.3, -size * 0.15,
        size * 0.7, -size * 0.15,
        size, 0
      );
      this.ctx.bezierCurveTo(
        size * 0.7, size * 0.15,
        size * 0.3, size * 0.15,
        0, 0
      );
      this.ctx.fillStyle = color;
      this.ctx.fill();
    });

    return this;
  }

  /**
   * Draw a pair of leaves at the same height
   * Reduces duplication in flowering plant renderers
   */
  drawLeafPair(
    x: number,
    y: number,
    leftAngle: number,
    rightAngle: number,
    leftSize: number,
    rightSize: number,
    color: string,
    offsetX: number = 3
  ): this {
    this.drawLeaf(x - offsetX, y, leftAngle, leftSize, color);
    this.drawLeaf(x + offsetX, y, rightAngle, rightSize, color);
    return this;
  }

  /**
   * Draw leaves along a stem at specified positions
   */
  drawLeavesAlongStem(
    baseX: number,
    baseY: number,
    plantHeight: number,
    stemGrowth: number,
    lean: number,
    leafPositions: number[], // Array of t values (0-1) along stem
    leafSize: number,
    leafGrowth: number,
    color: string
  ): this {
    for (let i = 0; i < leafPositions.length; i++) {
      const t = leafPositions[i];
      const leafY = baseY - plantHeight * t * stemGrowth;
      const leafX = baseX + lean * plantHeight * t;
      const side = i % 2 === 0 ? -1 : 1;
      const angle = side * 0.6;
      this.drawLeaf(leafX, leafY, angle, leafSize * leafGrowth, color);
    }
    return this;
  }

  /**
   * Draw petals in a radial pattern
   */
  drawRadialPetals(
    x: number,
    y: number,
    count: number,
    radiusX: number,
    radiusY: number,
    offset: number,
    color: string,
    angleOffset: number = 0
  ): this {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * GEOMETRY.TWO_PI + angleOffset;
      this.withState(() => {
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        this.ctx.beginPath();
        this.ctx.ellipse(offset, 0, radiusX, radiusY, 0, 0, GEOMETRY.TWO_PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
      });
    }
    return this;
  }

  /**
   * Draw a flower center (common pattern)
   */
  drawFlowerCenter(x: number, y: number, size: number, color: string): this {
    return this.fillCircle(x, y, size, color);
  }

  // ==================== PATH HELPERS ====================

  /**
   * Begin a new path
   */
  beginPath(): this {
    this.ctx.beginPath();
    return this;
  }

  /**
   * Move to a point
   */
  moveTo(x: number, y: number): this {
    this.ctx.moveTo(x, y);
    return this;
  }

  /**
   * Line to a point
   */
  lineTo(x: number, y: number): this {
    this.ctx.lineTo(x, y);
    return this;
  }

  /**
   * Quadratic curve to a point
   */
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): this {
    this.ctx.quadraticCurveTo(cpx, cpy, x, y);
    return this;
  }

  /**
   * Bezier curve to a point
   */
  bezierCurveTo(
    cp1x: number, cp1y: number,
    cp2x: number, cp2y: number,
    x: number, y: number
  ): this {
    this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    return this;
  }

  /**
   * Close current path
   */
  closePath(): this {
    this.ctx.closePath();
    return this;
  }

  /**
   * Fill current path
   */
  fill(color?: string): this {
    if (color) {
      this.ctx.fillStyle = color;
    }
    this.ctx.fill();
    return this;
  }

  /**
   * Stroke current path
   */
  stroke(color?: string): this {
    if (color) {
      this.ctx.strokeStyle = color;
    }
    this.ctx.stroke();
    return this;
  }

  // ==================== GRADIENT HELPERS ====================

  /**
   * Create a linear gradient
   */
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    return this.ctx.createLinearGradient(x0, y0, x1, y1);
  }

  /**
   * Create a radial gradient
   */
  createRadialGradient(
    x0: number, y0: number, r0: number,
    x1: number, y1: number, r1: number
  ): CanvasGradient {
    return this.ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  }

  // ==================== TEXT HELPERS ====================

  /**
   * Set font
   */
  setFont(font: string): this {
    this.ctx.font = font;
    return this;
  }

  /**
   * Set text align
   */
  setTextAlign(align: CanvasTextAlign): this {
    this.ctx.textAlign = align;
    return this;
  }

  /**
   * Fill text
   */
  fillText(text: string, x: number, y: number, color?: string): this {
    if (color) {
      this.ctx.fillStyle = color;
    }
    this.ctx.fillText(text, x, y);
    return this;
  }

  /**
   * Stroke text
   */
  strokeText(text: string, x: number, y: number, color?: string): this {
    if (color) {
      this.ctx.strokeStyle = color;
    }
    this.ctx.strokeText(text, x, y);
    return this;
  }

  // ==================== CLEAR ====================

  /**
   * Clear the entire canvas
   */
  clear(color?: string): this {
    if (color) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    } else {
      this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }
    return this;
  }

  /**
   * Clear a rectangle
   */
  clearRect(x: number, y: number, width: number, height: number): this {
    this.ctx.clearRect(x, y, width, height);
    return this;
  }

  // ==================== UTILITY ====================

  /**
   * Get the underlying context
   */
  getContext(): Ctx {
    return this.ctx;
  }

  /**
   * Get canvas dimensions
   */
  getDimensions(): { width: number; height: number } {
    return {
      width: this.ctx.canvas.width,
      height: this.ctx.canvas.height,
    };
  }
}

// ==================== STANDALONE HELPER FUNCTIONS ====================

/**
 * Draw a curved stem and return the end position
 * Standalone function for backward compatibility
 */
export function drawStem(
  ctx: Ctx,
  x: number,
  y: number,
  height: number,
  thickness: number,
  color: string,
  lean: number,
  growth: number
): { x: number; y: number } | null {
  if (growth <= 0) return null;

  const h = height * Math.min(1, growth);

  ctx.beginPath();
  ctx.moveTo(x, y);

  const cp1x = x + lean * h * GEOMETRY.STEM_CP1_LEAN;
  const cp1y = y - h * GEOMETRY.STEM_CP1_HEIGHT;
  const cp2x = x + lean * h * GEOMETRY.STEM_CP2_LEAN;
  const cp2y = y - h * GEOMETRY.STEM_CP2_HEIGHT;
  const endX = x + lean * h;
  const endY = y - h;

  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = CANVAS_STYLE.LINE_CAP;
  ctx.stroke();

  return { x: endX, y: endY };
}

/**
 * Draw a leaf shape
 * Standalone function for backward compatibility
 */
export function drawLeaf(
  ctx: Ctx,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string
): void {
  if (size < 1) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(size * 0.3, -size * 0.15, size * 0.7, -size * 0.15, size, 0);
  ctx.bezierCurveTo(size * 0.7, size * 0.15, size * 0.3, size * 0.15, 0, 0);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a pair of leaves
 * Standalone function for use in renderers
 */
export function drawLeafPair(
  ctx: Ctx,
  x: number,
  y: number,
  leftAngle: number,
  rightAngle: number,
  leftSize: number,
  rightSize: number,
  color: string,
  offsetX: number = 3
): void {
  drawLeaf(ctx, x - offsetX, y, leftAngle, leftSize, color);
  drawLeaf(ctx, x + offsetX, y, rightAngle, rightSize, color);
}
