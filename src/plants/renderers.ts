import type { PlantData, PlantVariation } from '../types';
import { PlantType, PlantCategory } from '../types';
import { seededRandom, createRandom } from '../utils';
import { getPlantCategory } from './generator';
import { getPlantVariation } from './variations';

/**
 * Common drawing context type
 */
type Ctx = CanvasRenderingContext2D;

/**
 * Growth phases for plant animation
 */
interface GrowthPhases {
  progress: number;
  stem: number;
  leaf: number;
  flower: number;
}

/**
 * Calculate growth phases from progress value
 * Extracts the common growth timing logic used by most renderers
 */
function calculateGrowthPhases(time: number, delay: number, growDuration: number): GrowthPhases | null {
  const progress = (time - delay) / growDuration;
  if (progress <= 0) return null;

  return {
    progress,
    stem: Math.min(1, progress * 1.5),
    leaf: Math.max(0, Math.min(1, (progress - 0.3) * 2)),
    flower: Math.max(0, Math.min(1, (progress - 0.5) * 2)),
  };
}

/**
 * Render context for flowering plants
 */
interface FloweringPlantContext {
  x: number;
  baseY: number;
  plantHeight: number;
  phases: GrowthPhases;
}

/**
 * Create render context for a flowering plant
 */
function createFloweringContext(
  plant: PlantData,
  width: number,
  height: number,
  time: number,
  variation: PlantVariation
): FloweringPlantContext | null {
  const phases = calculateGrowthPhases(time, plant.delay, plant.growDuration);
  if (!phases) return null;

  return {
    x: plant.x * width,
    baseY: height,
    plantHeight: plant.maxHeight * height * variation.heightMultiplier,
    phases,
  };
}


/**
 * Draw a curved stem and return the end position
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

  // Control points for natural curve
  const cp1x = x + lean * h * 0.3;
  const cp1y = y - h * 0.4;
  const cp2x = x + lean * h * 0.6;
  const cp2y = y - h * 0.7;
  const endX = x + lean * h;
  const endY = y - h;

  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.stroke();

  return { x: endX, y: endY };
}

/**
 * Draw a leaf shape
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
 * Draw a simple flower with petals
 */
function drawSimpleFlower(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  petals: number,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;
  const p = Math.max(3, petals + variation.petalCountModifier);

  // Petals
  for (let i = 0; i < p; i++) {
    const angle = (i / p) * Math.PI * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.ellipse(s * 0.5, 0, s * 0.5, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // Center
  ctx.beginPath();
  ctx.arc(x, y, s * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD700';
  ctx.fill();
}

/**
 * Draw a tulip flower
 */
function drawTulip(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;

  ctx.beginPath();
  ctx.moveTo(x - s * 0.3, y);
  ctx.bezierCurveTo(x - s * 0.4, y - s * 0.5, x - s * 0.2, y - s * 0.9, x, y - s);
  ctx.bezierCurveTo(x + s * 0.2, y - s * 0.9, x + s * 0.4, y - s * 0.5, x + s * 0.3, y);
  ctx.bezierCurveTo(x + s * 0.1, y - s * 0.2, x - s * 0.1, y - s * 0.2, x - s * 0.3, y);
  ctx.fillStyle = color;
  ctx.fill();

  // Add stripes for complex variations
  if (variation.complexity > 0.6) {
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.2);
    ctx.lineTo(x, y - s * 0.9);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = s * 0.08;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/**
 * Draw a daisy flower
 */
function drawDaisy(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;
  const petalCount = Math.max(8, 12 + variation.petalCountModifier);

  // Petals
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.ellipse(s * 0.45, 0, s * 0.4, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // Yellow center
  ctx.beginPath();
  ctx.arc(x, y, s * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD700';
  ctx.fill();
}

/**
 * Draw wildflower clusters
 */
function drawWildflower(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;
  const count = Math.max(3, 5 + variation.petalCountModifier);

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + 0.3;
    const dist = s * 0.3;
    const fx = x + Math.cos(angle) * dist;
    const fy = y + Math.sin(angle) * dist;

    ctx.beginPath();
    ctx.arc(fx, fy, s * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(x, y, s * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Draw grass blades
 */
function drawGrass(
  ctx: Ctx,
  x: number,
  y: number,
  height: number,
  color: string,
  seed: number,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const h = height * Math.min(1, growth) * variation.heightMultiplier;
  const thickness = 1.5 * variation.thicknessMultiplier;

  const blades = Math.max(2, 3 + Math.floor(seededRandom(seed) * 3) + variation.petalCountModifier);
  for (let i = 0; i < blades; i++) {
    const rand = seededRandom(seed + i * 10);
    const lean = (rand - 0.5) * 0.4 * variation.leanMultiplier;
    const bladeH = h * (0.6 + rand * 0.4);

    ctx.beginPath();
    ctx.moveTo(x + (i - blades / 2) * 3, y);
    ctx.quadraticCurveTo(
      x + (i - blades / 2) * 3 + lean * bladeH,
      y - bladeH * 0.6,
      x + (i - blades / 2) * 3 + lean * bladeH * 1.5,
      y - bladeH
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Add plumes for pampas grass and similar
  if (variation.complexity > 0.7 && growth > 0.8) {
    const plumeGrowth = (growth - 0.8) / 0.2;
    ctx.globalAlpha = plumeGrowth * 0.7;
    for (let i = 0; i < blades; i++) {
      const rand = seededRandom(seed + i * 10);
      const lean = (rand - 0.5) * 0.4 * variation.leanMultiplier;
      const bladeH = h * (0.6 + rand * 0.4);
      const plumeX = x + (i - blades / 2) * 3 + lean * bladeH * 1.5;
      const plumeY = y - bladeH;

      ctx.beginPath();
      ctx.ellipse(plumeX, plumeY - h * 0.1, h * 0.08, h * 0.15, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#F5F5DC';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Draw fern fronds
 */
function drawFern(
  ctx: Ctx,
  x: number,
  y: number,
  height: number,
  color: string,
  seed: number,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const h = height * Math.min(1, growth) * variation.heightMultiplier;
  const lean = (seededRandom(seed) - 0.5) * 0.3 * variation.leanMultiplier;
  const thickness = 1.5 * variation.thicknessMultiplier;

  // Main stem
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * h * 0.5, y - h * 0.5, x + lean * h, y - h);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.stroke();

  // Fronds
  const frondCount = Math.max(4, 6 + variation.petalCountModifier);
  for (let i = 0; i < frondCount; i++) {
    const t = (i + 1) / (frondCount + 1);
    const fx = x + lean * h * t;
    const fy = y - h * t;
    const side = i % 2 === 0 ? 1 : -1;
    const frondLen = h * 0.25 * (1 - t * 0.5);

    // Curl for curly fern types
    const curlFactor = variation.complexity > 0.7 ? 0.5 : 0.2;

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(
      fx + side * frondLen * 0.7,
      fy - frondLen * curlFactor,
      fx + side * frondLen,
      fy + frondLen * curlFactor
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Draw a bush with leaves and small flowers
 */
function drawBush(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  leafColor: string,
  flowerColor: string,
  seed: number,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * Math.min(1, growth) * variation.sizeMultiplier;

  // Cluster of leaves
  const leafCount = Math.max(5, 8 + variation.petalCountModifier);
  for (let i = 0; i < leafCount; i++) {
    const rand = seededRandom(seed + i * 7);
    const angle = (i / leafCount) * Math.PI * 2 + rand * 0.5;
    const dist = s * (0.3 + rand * 0.4);
    const lx = x + Math.cos(angle) * dist * variation.leanMultiplier;
    const ly = y - s * 0.3 + Math.sin(angle) * dist * 0.5;

    drawLeaf(ctx, lx, ly, angle + Math.PI, s * 0.4, leafColor);
  }

  // Small flowers (more for flowering bush type)
  const flowerThreshold = variation.complexity > 0.8 ? 0.5 : 0.7;
  if (growth > flowerThreshold) {
    const flowerGrowth = (growth - flowerThreshold) / (1 - flowerThreshold);
    const flowerCount = variation.complexity > 0.8 ? 5 : 3;
    for (let i = 0; i < flowerCount; i++) {
      const rand = seededRandom(seed + i * 13);
      const fx = x + (rand - 0.5) * s * 0.6;
      const fy = y - s * 0.3 - rand * s * 0.3;

      ctx.beginPath();
      ctx.arc(fx, fy, s * 0.12 * flowerGrowth, 0, Math.PI * 2);
      ctx.fillStyle = flowerColor;
      ctx.fill();
    }
  }
}

/**
 * Draw a rose
 */
function drawRose(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;
  const petalLayers = variation.complexity > 0.8 ? 4 : 3;

  // Draw petals in layers (outer to inner)
  for (let layer = 0; layer < petalLayers; layer++) {
    const layerSize = s * (1 - layer * 0.2);
    const petalsInLayer = 5 + layer;
    const angleOffset = layer * 0.3;

    for (let i = 0; i < petalsInLayer; i++) {
      const angle = (i / petalsInLayer) * Math.PI * 2 + angleOffset;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.ellipse(layerSize * 0.35, 0, layerSize * 0.4, layerSize * 0.25, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
  }

  // Center
  ctx.beginPath();
  ctx.arc(x, y, s * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD700';
  ctx.fill();
}

/**
 * Draw a lily
 */
function drawLily(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;
  const petals = Math.max(4, 6 + variation.petalCountModifier);

  // Long curved petals
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.2, -s * 0.3, s * 0.6, -s * 0.2, s * 0.8, 0);
    ctx.bezierCurveTo(s * 0.6, s * 0.15, s * 0.2, s * 0.1, 0, 0);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // Stamens
  ctx.beginPath();
  ctx.arc(x, y, s * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#8B4513';
  ctx.fill();
}

/**
 * Draw an orchid
 */
function drawOrchid(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;

  // Three outer petals (sepals)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.ellipse(s * 0.5, 0, s * 0.5, s * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // Two side petals
  for (let i = 0; i < 2; i++) {
    const angle = (i === 0 ? -0.4 : 0.4) + Math.PI / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.ellipse(s * 0.35, 0, s * 0.35, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // Lip (labellum) - distinctive orchid feature
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.3, s * 0.25, s * 0.15, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD700';
  ctx.fill();
}

/**
 * Draw a succulent
 */
function drawSucculent(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;
  const layers = variation.complexity > 0.6 ? 4 : 3;
  const leavesPerLayer = 6 + variation.petalCountModifier;

  // Draw rosette pattern
  for (let layer = 0; layer < layers; layer++) {
    const layerSize = s * (1 - layer * 0.2);
    const angleOffset = layer * 0.5;

    for (let i = 0; i < leavesPerLayer; i++) {
      const angle = (i / leavesPerLayer) * Math.PI * 2 + angleOffset;
      const lx = x + Math.cos(angle) * layerSize * 0.4;
      const ly = y - layer * s * 0.1 + Math.sin(angle) * layerSize * 0.2;

      ctx.beginPath();
      ctx.ellipse(lx, ly, layerSize * 0.2, layerSize * 0.35, angle, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

/**
 * Draw lavender
 */
function drawLavender(
  ctx: Ctx,
  x: number,
  y: number,
  height: number,
  color: string,
  seed: number,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const h = height * Math.min(1, growth) * variation.heightMultiplier;
  const lean = (seededRandom(seed) - 0.5) * 0.2 * variation.leanMultiplier;

  // Stem
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * h * 0.5, y - h * 0.5, x + lean * h, y - h);
  ctx.strokeStyle = '#4A7C40';
  ctx.lineWidth = 1.5 * variation.thicknessMultiplier;
  ctx.stroke();

  // Flower spike at top
  if (growth > 0.5) {
    const flowerGrowth = (growth - 0.5) / 0.5;
    const spikeHeight = h * 0.3 * flowerGrowth;
    const spikeY = y - h + spikeHeight / 2;
    const spikeX = x + lean * h;

    const buds = Math.floor(8 * flowerGrowth);
    for (let i = 0; i < buds; i++) {
      const by = spikeY - (i / buds) * spikeHeight;
      const bx = spikeX + (seededRandom(seed + i) - 0.5) * 4;

      ctx.beginPath();
      ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

/**
 * Draw poppy
 */
function drawPoppy(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;

  // 4 crinkled petals
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Wavy petal edge
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.2, -s * 0.3, s * 0.5, -s * 0.2, s * 0.6, 0);
    ctx.bezierCurveTo(s * 0.5, s * 0.2, s * 0.2, s * 0.3, 0, 0);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // Dark center
  ctx.beginPath();
  ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#2D2D2D';
  ctx.fill();
}

/**
 * Draw sunflower
 */
function drawSunflower(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;
  const petalCount = 16 + variation.petalCountModifier;

  // Ray petals
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(s * 0.3, 0);
    ctx.bezierCurveTo(s * 0.4, -s * 0.08, s * 0.7, -s * 0.05, s * 0.85, 0);
    ctx.bezierCurveTo(s * 0.7, s * 0.05, s * 0.4, s * 0.08, s * 0.3, 0);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // Dark center disc
  ctx.beginPath();
  ctx.arc(x, y, s * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#4A3728';
  ctx.fill();

  // Seeds pattern in center
  ctx.beginPath();
  ctx.arc(x, y, s * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#3D2D20';
  ctx.fill();
}

/**
 * Draw iris
 */
function drawIris(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;

  // 3 upright petals (standards)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.1, -s * 0.4, s * 0.2, -s * 0.6, 0, -s * 0.7);
    ctx.bezierCurveTo(-s * 0.2, -s * 0.6, -s * 0.1, -s * 0.4, 0, 0);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // 3 falls (drooping petals)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.3, s * 0.2, s * 0.4, s * 0.5, s * 0.2, s * 0.6);
    ctx.bezierCurveTo(0, s * 0.5, -s * 0.1, s * 0.2, 0, 0);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Draw peony
 */
function drawPeony(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;
  const layers = 5;

  // Many ruffled petals in layers
  for (let layer = 0; layer < layers; layer++) {
    const layerSize = s * (1 - layer * 0.15);
    const petalsInLayer = 8 + layer * 2;
    const angleOffset = layer * 0.4;

    for (let i = 0; i < petalsInLayer; i++) {
      const angle = (i / petalsInLayer) * Math.PI * 2 + angleOffset;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.ellipse(layerSize * 0.3, 0, layerSize * 0.35, layerSize * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
  }

  // Golden center
  ctx.beginPath();
  ctx.arc(x, y, s * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD700';
  ctx.fill();
}

/**
 * Draw hydrangea
 */
function drawHydrangea(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  seed: number,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;
  const floretCount = 20 + variation.petalCountModifier;

  // Cluster of small 4-petal florets
  for (let i = 0; i < floretCount; i++) {
    const rand1 = seededRandom(seed + i * 7);
    const rand2 = seededRandom(seed + i * 11);
    const angle = rand1 * Math.PI * 2;
    const dist = rand2 * s * 0.4;
    const fx = x + Math.cos(angle) * dist;
    const fy = y + Math.sin(angle) * dist * 0.6 - s * 0.1;

    // Each floret is 4 small petals
    for (let p = 0; p < 4; p++) {
      const pa = (p / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(
        fx + Math.cos(pa) * s * 0.06,
        fy + Math.sin(pa) * s * 0.06,
        s * 0.05,
        s * 0.03,
        pa,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

/**
 * Draw dahlia - spherical flower with many pointed petals
 */
function drawDahlia(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  growth: number,
  variation: PlantVariation
): void {
  if (growth <= 0) return;
  const s = size * growth * variation.sizeMultiplier;
  const layers = 4;

  // Many layers of pointed petals
  for (let layer = 0; layer < layers; layer++) {
    const layerSize = s * (1 - layer * 0.18);
    const petalsInLayer = 10 + layer * 2 + variation.petalCountModifier;
    const angleOffset = layer * 0.25;

    for (let i = 0; i < petalsInLayer; i++) {
      const angle = (i / petalsInLayer) * Math.PI * 2 + angleOffset;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Pointed petal shape
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(
        layerSize * 0.15, -layerSize * 0.08,
        layerSize * 0.35, -layerSize * 0.05,
        layerSize * 0.45, 0
      );
      ctx.bezierCurveTo(
        layerSize * 0.35, layerSize * 0.05,
        layerSize * 0.15, layerSize * 0.08,
        0, 0
      );
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
  }

  // Tight center
  ctx.beginPath();
  ctx.arc(x, y, s * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = '#DAA520';
  ctx.fill();
}

/**
 * Category-based render function lookup
 * More efficient than a 100-case switch statement
 */
type CategoryRenderer = (
  ctx: Ctx,
  plant: PlantData,
  width: number,
  height: number,
  time: number,
  variation: PlantVariation
) => void;

const categoryRenderers: Record<PlantCategory, CategoryRenderer> = {
  [PlantCategory.SimpleFlower]: (ctx, plant, width, height, time, variation) => {
    const rc = createFloweringContext(plant, width, height, time, variation);
    if (!rc) return;

    const { x, baseY, plantHeight, phases } = rc;

    const top = drawStem(
      ctx, x, baseY, plantHeight,
      2 * plant.scale * variation.thicknessMultiplier,
      plant.stemColor,
      plant.lean * variation.leanMultiplier,
      phases.stem
    );

    if (top && phases.leaf > 0) {
      const leafY = baseY - plantHeight * 0.4 * phases.stem;
      const leafX = x + plant.lean * variation.leanMultiplier * plantHeight * 0.4;
      drawLeaf(ctx, leafX - 3, leafY, -0.5 - plant.lean, 15 * plant.scale * phases.leaf, plant.leafColor);
      drawLeaf(ctx, leafX + 3, leafY + 5, 0.5 - plant.lean, 12 * plant.scale * phases.leaf, plant.leafColor);
    }

    if (top && phases.flower > 0) {
      drawSimpleFlower(ctx, top.x, top.y, 18 * plant.scale, plant.flowerColor, plant.petals, phases.flower, variation);
    }
  },

  [PlantCategory.Tulip]: (ctx, plant, width, height, time, variation) => {
    const rc = createFloweringContext(plant, width, height, time, variation);
    if (!rc) return;

    const { x, baseY, plantHeight, phases } = rc;

    const top = drawStem(
      ctx, x, baseY, plantHeight,
      2.5 * plant.scale * variation.thicknessMultiplier,
      plant.stemColor,
      plant.lean * 0.5 * variation.leanMultiplier,
      phases.stem
    );

    if (top && phases.leaf > 0) {
      const leafY = baseY - plantHeight * 0.2 * phases.stem;
      drawLeaf(ctx, x - 2, leafY, -0.8, 25 * plant.scale * phases.leaf, plant.leafColor);
      drawLeaf(ctx, x + 2, leafY, 0.8, 22 * plant.scale * phases.leaf, plant.leafColor);
    }

    if (top && phases.flower > 0) {
      drawTulip(ctx, top.x, top.y, 22 * plant.scale, plant.flowerColor, phases.flower, variation);
    }
  },

  [PlantCategory.Daisy]: (ctx, plant, width, height, time, variation) => {
    const rc = createFloweringContext(plant, width, height, time, variation);
    if (!rc) return;

    const { x, baseY, plantHeight, phases } = rc;

    const top = drawStem(
      ctx, x, baseY, plantHeight,
      1.5 * plant.scale * variation.thicknessMultiplier,
      plant.stemColor,
      plant.lean * variation.leanMultiplier,
      phases.stem
    );

    if (top && phases.leaf > 0) {
      const leafY = baseY - plantHeight * 0.3 * phases.stem;
      const leafX = x + plant.lean * variation.leanMultiplier * plantHeight * 0.3;
      drawLeaf(ctx, leafX, leafY, -0.3, 12 * plant.scale * phases.leaf, plant.leafColor);
    }

    if (top && phases.flower > 0) {
      drawDaisy(ctx, top.x, top.y, 16 * plant.scale, plant.flowerColor, phases.flower, variation);
    }
  },

  [PlantCategory.Wildflower]: (ctx, plant, width, height, time, variation) => {
    const rc = createFloweringContext(plant, width, height, time, variation);
    if (!rc) return;

    const { x, baseY, plantHeight, phases } = rc;

    const top = drawStem(
      ctx, x, baseY, plantHeight * 0.85,
      1.5 * plant.scale * variation.thicknessMultiplier,
      plant.stemColor,
      plant.lean * variation.leanMultiplier,
      phases.stem
    );

    if (top && phases.flower > 0) {
      drawWildflower(ctx, top.x, top.y, 14 * plant.scale, plant.flowerColor, phases.flower, variation);
    }
  },

  [PlantCategory.Grass]: (ctx, plant, width, height, time, variation) => {
    const progress = (time - plant.delay) / plant.growDuration;
    if (progress <= 0) return;

    const x = plant.x * width;
    const baseY = height;
    const plantHeight = plant.maxHeight * height;
    const stemGrowth = Math.min(1, progress * 1.5);

    drawGrass(ctx, x, baseY, plantHeight, plant.leafColor, plant.seed, stemGrowth, variation);
  },

  [PlantCategory.Fern]: (ctx, plant, width, height, time, variation) => {
    const progress = (time - plant.delay) / plant.growDuration;
    if (progress <= 0) return;

    const x = plant.x * width;
    const baseY = height;
    const plantHeight = plant.maxHeight * height;
    const stemGrowth = Math.min(1, progress * 1.5);

    drawFern(ctx, x, baseY, plantHeight, plant.leafColor, plant.seed, stemGrowth, variation);
  },

  [PlantCategory.Bush]: (ctx, plant, width, height, time, variation) => {
    const progress = (time - plant.delay) / plant.growDuration;
    if (progress <= 0) return;

    const x = plant.x * width;
    const baseY = height;
    const plantHeight = plant.maxHeight * height;

    drawBush(
      ctx,
      x,
      baseY - 5,
      plantHeight * 0.7,
      plant.leafColor,
      plant.flowerColor,
      plant.seed,
      Math.min(1, progress * 1.2),
      variation
    );
  },

  [PlantCategory.Rose]: (ctx, plant, width, height, time, variation) => {
    const rc = createFloweringContext(plant, width, height, time, variation);
    if (!rc) return;

    const { x, baseY, plantHeight, phases } = rc;

    const top = drawStem(
      ctx, x, baseY, plantHeight,
      2.5 * plant.scale * variation.thicknessMultiplier,
      plant.stemColor,
      plant.lean * variation.leanMultiplier,
      phases.stem
    );

    if (top && phases.leaf > 0) {
      const leafY = baseY - plantHeight * 0.4 * phases.stem;
      drawLeaf(ctx, x - 4, leafY, -0.6, 18 * plant.scale * phases.leaf, plant.leafColor);
      drawLeaf(ctx, x + 4, leafY + 8, 0.6, 16 * plant.scale * phases.leaf, plant.leafColor);
    }

    if (top && phases.flower > 0) {
      drawRose(ctx, top.x, top.y, 20 * plant.scale, plant.flowerColor, phases.flower, variation);
    }
  },

  [PlantCategory.Lily]: (ctx, plant, width, height, time, variation) => {
    const rc = createFloweringContext(plant, width, height, time, variation);
    if (!rc) return;

    const { x, baseY, plantHeight, phases } = rc;

    const top = drawStem(
      ctx, x, baseY, plantHeight,
      2 * plant.scale * variation.thicknessMultiplier,
      plant.stemColor,
      plant.lean * variation.leanMultiplier,
      phases.stem
    );

    if (top && phases.leaf > 0) {
      const leafY = baseY - plantHeight * 0.3 * phases.stem;
      drawLeaf(ctx, x - 2, leafY, -0.4, 20 * plant.scale * phases.leaf, plant.leafColor);
      drawLeaf(ctx, x + 2, leafY + 10, 0.4, 18 * plant.scale * phases.leaf, plant.leafColor);
    }

    if (top && phases.flower > 0) {
      drawLily(ctx, top.x, top.y, 22 * plant.scale, plant.flowerColor, phases.flower, variation);
    }
  },

  [PlantCategory.Orchid]: (ctx, plant, width, height, time, variation) => {
    const rc = createFloweringContext(plant, width, height, time, variation);
    if (!rc) return;

    const { x, baseY, plantHeight, phases } = rc;

    const top = drawStem(
      ctx, x, baseY, plantHeight,
      1.5 * plant.scale * variation.thicknessMultiplier,
      plant.stemColor,
      plant.lean * variation.leanMultiplier,
      phases.stem
    );

    if (top && phases.flower > 0) {
      drawOrchid(ctx, top.x, top.y, 18 * plant.scale, plant.flowerColor, phases.flower, variation);
    }
  },

  [PlantCategory.Succulent]: (ctx, plant, width, height, time, variation) => {
    const progress = (time - plant.delay) / plant.growDuration;
    if (progress <= 0) return;

    const x = plant.x * width;
    const baseY = height;
    const plantHeight = plant.maxHeight * height;

    drawSucculent(ctx, x, baseY - 5, plantHeight * 0.6, plant.leafColor, Math.min(1, progress * 1.2), variation);
  },

  [PlantCategory.Herb]: (ctx, plant, width, height, time, variation) => {
    const progress = (time - plant.delay) / plant.growDuration;
    if (progress <= 0) return;

    const x = plant.x * width;
    const baseY = height;
    const plantHeight = plant.maxHeight * height;

    drawLavender(ctx, x, baseY, plantHeight, plant.flowerColor, plant.seed, Math.min(1, progress * 1.3), variation);
  },

  [PlantCategory.Specialty]: (ctx, plant, width, height, time, variation) => {
    const rc = createFloweringContext(plant, width, height, time, variation);
    if (!rc) return;

    const { x, baseY, plantHeight, phases } = rc;

    const top = drawStem(
      ctx, x, baseY, plantHeight,
      2.5 * plant.scale * variation.thicknessMultiplier,
      plant.stemColor,
      plant.lean * variation.leanMultiplier,
      phases.stem
    );

    if (top && phases.leaf > 0) {
      const leafY = baseY - plantHeight * 0.35 * phases.stem;
      drawLeaf(ctx, x - 3, leafY, -0.5, 16 * plant.scale * phases.leaf, plant.leafColor);
      drawLeaf(ctx, x + 3, leafY + 6, 0.5, 14 * plant.scale * phases.leaf, plant.leafColor);
    }

    if (top && phases.flower > 0) {
      // Route to specific specialty flower renderer
      switch (plant.type) {
        case PlantType.Poppy:
          drawPoppy(ctx, top.x, top.y, 18 * plant.scale, plant.flowerColor, phases.flower, variation);
          break;
        case PlantType.Sunflower:
          drawSunflower(ctx, top.x, top.y, 25 * plant.scale, plant.flowerColor, phases.flower, variation);
          break;
        case PlantType.Iris:
          drawIris(ctx, top.x, top.y, 20 * plant.scale, plant.flowerColor, phases.flower, variation);
          break;
        case PlantType.Peony:
          drawPeony(ctx, top.x, top.y, 22 * plant.scale, plant.flowerColor, phases.flower, variation);
          break;
        case PlantType.Hydrangea:
          drawHydrangea(ctx, top.x, top.y, 28 * plant.scale, plant.flowerColor, plant.seed, phases.flower, variation);
          break;
        case PlantType.Dahlia:
          drawDahlia(ctx, top.x, top.y, 24 * plant.scale, plant.flowerColor, phases.flower, variation);
          break;
        default:
          drawSimpleFlower(ctx, top.x, top.y, 18 * plant.scale, plant.flowerColor, plant.petals, phases.flower, variation);
      }
    }
  },

  // === TALL CATEGORIES ===

  [PlantCategory.TallFlower]: (ctx, plant, width, height, time, variation) => {
    const rc = createFloweringContext(plant, width, height, time, variation);
    if (!rc) return;

    const { x, baseY, plantHeight, phases } = rc;

    // Draw main tall stem
    const top = drawStem(
      ctx, x, baseY, plantHeight,
      3 * plant.scale * variation.thicknessMultiplier,
      plant.stemColor,
      plant.lean * variation.leanMultiplier * 0.5,
      phases.stem
    );

    // Draw leaves along stem
    if (phases.leaf > 0) {
      const numLeaves = 3 + Math.floor(variation.complexity * 3);
      for (let i = 0; i < numLeaves; i++) {
        const t = 0.2 + (i / numLeaves) * 0.5;
        const leafY = baseY - plantHeight * t * phases.stem;
        const leafX = x + plant.lean * variation.leanMultiplier * plantHeight * t * 0.5;
        const side = i % 2 === 0 ? -1 : 1;
        drawLeaf(ctx, leafX, leafY, side * 0.6, 20 * plant.scale * phases.leaf, plant.leafColor);
      }
    }

    // Draw multiple flowers along the stem (hollyhock style)
    if (top && phases.flower > 0) {
      const numFlowers = 4 + Math.floor(variation.complexity * 4);
      for (let i = 0; i < numFlowers; i++) {
        const t = 0.5 + (i / numFlowers) * 0.45;
        const flowerY = baseY - plantHeight * t * phases.stem;
        const flowerX = x + plant.lean * variation.leanMultiplier * plantHeight * t * 0.5;
        const flowerSize = (8 + i * 1.5) * plant.scale * variation.sizeMultiplier;
        const flowerGrowth = Math.max(0, (phases.flower - i * 0.08) * 1.5);
        if (flowerGrowth > 0) {
          drawSimpleFlower(ctx, flowerX, flowerY, flowerSize, plant.flowerColor, plant.petals, Math.min(1, flowerGrowth), variation);
        }
      }
    }
  },

  [PlantCategory.GiantGrass]: (ctx, plant, width, height, time, variation) => {
    const progress = (time - plant.delay) / plant.growDuration;
    if (progress <= 0) return;

    const x = plant.x * width;
    const baseY = height;
    const plantHeight = plant.maxHeight * height * variation.heightMultiplier;
    const stemGrowth = Math.min(1, progress * 1.3);

    // Draw bamboo-style segmented culms
    const numCulms = 2 + Math.floor(variation.complexity * 3);
    const rand = createRandom(plant.seed);

    for (let c = 0; c < numCulms; c++) {
      const offsetX = (rand() - 0.5) * 20 * variation.sizeMultiplier;
      const culmHeight = plantHeight * (0.7 + rand() * 0.3) * stemGrowth;
      const culmLean = (rand() - 0.5) * 0.15 * variation.leanMultiplier;

      // Draw segmented culm
      const segments = 4 + Math.floor(rand() * 4);
      const segmentHeight = culmHeight / segments;

      ctx.strokeStyle = plant.stemColor;
      ctx.lineWidth = 3 * plant.scale * variation.thicknessMultiplier;
      ctx.lineCap = 'round';

      let currentY = baseY;
      let currentX = x + offsetX;

      for (let s = 0; s < segments; s++) {
        const nextY = currentY - segmentHeight;
        const nextX = currentX + culmLean * segmentHeight;

        ctx.beginPath();
        ctx.moveTo(currentX, currentY);
        ctx.lineTo(nextX, nextY);
        ctx.stroke();

        // Draw node
        if (s < segments - 1) {
          ctx.beginPath();
          ctx.arc(nextX, nextY, 4 * plant.scale, 0, Math.PI * 2);
          ctx.fillStyle = plant.stemColor;
          ctx.fill();
        }

        currentY = nextY;
        currentX = nextX;
      }

      // Draw leaves at top
      if (stemGrowth > 0.5) {
        const leafGrowth = (stemGrowth - 0.5) * 2;
        for (let l = 0; l < 3; l++) {
          const angle = (l - 1) * 0.4 + culmLean;
          drawLeaf(ctx, currentX, currentY, angle, 30 * plant.scale * leafGrowth, plant.leafColor);
        }
      }
    }
  },

  [PlantCategory.Climber]: (ctx, plant, width, height, time, variation) => {
    const progress = (time - plant.delay) / plant.growDuration;
    if (progress <= 0) return;

    const x = plant.x * width;
    const baseY = height;
    const plantHeight = plant.maxHeight * height * variation.heightMultiplier;
    const stemGrowth = Math.min(1, progress * 1.2);

    const rand = createRandom(plant.seed);

    // Draw winding main vine
    ctx.strokeStyle = plant.stemColor;
    ctx.lineWidth = 2 * plant.scale * variation.thicknessMultiplier;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x, baseY);

    const segments = 8;
    let prevX = x;
    let prevY = baseY;

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const targetY = baseY - plantHeight * t * stemGrowth;
      const wave = Math.sin(t * Math.PI * 3) * 15 * variation.leanMultiplier;
      const targetX = x + wave + plant.lean * plantHeight * t * 0.3;

      ctx.quadraticCurveTo(
        (prevX + targetX) / 2 + (rand() - 0.5) * 10,
        (prevY + targetY) / 2,
        targetX,
        targetY
      );

      // Draw leaves
      if (t > 0.1 && stemGrowth > t) {
        const leafSize = 12 * plant.scale * Math.min(1, (stemGrowth - t) * 3);
        if (i % 2 === 0) {
          drawLeaf(ctx, targetX - 5, targetY, -0.8, leafSize, plant.leafColor);
        } else {
          drawLeaf(ctx, targetX + 5, targetY, 0.8, leafSize, plant.leafColor);
        }
      }

      prevX = targetX;
      prevY = targetY;
    }

    ctx.stroke();

    // Draw flowers for flowering vines
    if (stemGrowth > 0.6 && variation.complexity > 0.6) {
      const flowerGrowth = (stemGrowth - 0.6) * 2.5;
      const numFlowers = 3 + Math.floor(variation.petalCountModifier);
      for (let f = 0; f < numFlowers; f++) {
        const t = 0.3 + rand() * 0.5;
        const fy = baseY - plantHeight * t * stemGrowth;
        const fx = x + Math.sin(t * Math.PI * 3) * 15 * variation.leanMultiplier + plant.lean * plantHeight * t * 0.3;
        drawSimpleFlower(ctx, fx, fy, 10 * plant.scale, plant.flowerColor, 5, Math.min(1, flowerGrowth), variation);
      }
    }
  },

  [PlantCategory.SmallTree]: (ctx, plant, width, height, time, variation) => {
    const progress = (time - plant.delay) / plant.growDuration;
    if (progress <= 0) return;

    const x = plant.x * width;
    const baseY = height;
    const plantHeight = plant.maxHeight * height * variation.heightMultiplier;
    const trunkGrowth = Math.min(1, progress * 1.2);
    const foliageGrowth = Math.max(0, (progress - 0.4) * 1.7);

    const rand = createRandom(plant.seed);

    // Draw trunk
    const trunkHeight = plantHeight * 0.6 * trunkGrowth;
    const trunkWidth = 6 * plant.scale * variation.thicknessMultiplier;

    ctx.fillStyle = plant.stemColor;
    ctx.beginPath();
    ctx.moveTo(x - trunkWidth / 2, baseY);
    ctx.lineTo(x + trunkWidth / 2, baseY);
    ctx.lineTo(x + trunkWidth / 4, baseY - trunkHeight);
    ctx.lineTo(x - trunkWidth / 4, baseY - trunkHeight);
    ctx.closePath();
    ctx.fill();

    // Draw branches and foliage
    if (foliageGrowth > 0) {
      const foliageY = baseY - trunkHeight;
      const foliageRadius = 25 * plant.scale * variation.sizeMultiplier * foliageGrowth;

      // Draw foliage clusters
      const clusters = 5 + Math.floor(variation.complexity * 4);
      for (let c = 0; c < clusters; c++) {
        const angle = (c / clusters) * Math.PI * 2 + rand() * 0.5;
        const dist = foliageRadius * (0.4 + rand() * 0.6);
        const cx = x + Math.cos(angle) * dist * 0.8;
        const cy = foliageY - Math.abs(Math.sin(angle)) * dist * 0.6 - foliageRadius * 0.3;
        const clusterSize = foliageRadius * (0.4 + rand() * 0.3);

        ctx.beginPath();
        ctx.arc(cx, cy, clusterSize, 0, Math.PI * 2);
        ctx.fillStyle = plant.leafColor;
        ctx.fill();
      }

      // Draw flowers for ornamental/cherry blossom
      if (variation.petalCountModifier > 4 && foliageGrowth > 0.5) {
        const numFlowers = Math.floor(variation.petalCountModifier);
        for (let f = 0; f < numFlowers; f++) {
          const angle = rand() * Math.PI * 2;
          const dist = foliageRadius * (0.5 + rand() * 0.5);
          const fx = x + Math.cos(angle) * dist * 0.8;
          const fy = foliageY - Math.abs(Math.sin(angle)) * dist * 0.6 - foliageRadius * 0.3;
          drawSimpleFlower(ctx, fx, fy, 6 * plant.scale, plant.flowerColor, 5, foliageGrowth, variation);
        }
      }
    }
  },

  [PlantCategory.Tropical]: (ctx, plant, width, height, time, variation) => {
    const progress = (time - plant.delay) / plant.growDuration;
    if (progress <= 0) return;

    const x = plant.x * width;
    const baseY = height;
    const plantHeight = plant.maxHeight * height * variation.heightMultiplier;
    const growth = Math.min(1, progress * 1.2);

    const rand = createRandom(plant.seed);

    // Draw trunk/stem
    const trunkHeight = plantHeight * 0.5 * growth;
    ctx.strokeStyle = plant.stemColor;
    ctx.lineWidth = 5 * plant.scale * variation.thicknessMultiplier;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + plant.lean * trunkHeight * 0.3, baseY - trunkHeight);
    ctx.stroke();

    // Draw palm fronds
    if (growth > 0.3) {
      const frondGrowth = (growth - 0.3) * 1.4;
      const numFronds = 5 + Math.floor(variation.complexity * 3);
      const crownY = baseY - trunkHeight;
      const crownX = x + plant.lean * trunkHeight * 0.3;

      for (let f = 0; f < numFronds; f++) {
        const angle = (f / numFronds) * Math.PI - Math.PI / 2 + (rand() - 0.5) * 0.3;
        const frondLength = 35 * plant.scale * variation.sizeMultiplier * frondGrowth;
        const droop = 0.3 + rand() * 0.3;

        ctx.strokeStyle = plant.leafColor;
        ctx.lineWidth = 2 * plant.scale;
        ctx.beginPath();
        ctx.moveTo(crownX, crownY);

        const endX = crownX + Math.cos(angle) * frondLength;
        const endY = crownY + Math.sin(angle) * frondLength * 0.5 + frondLength * droop;
        const cpX = crownX + Math.cos(angle) * frondLength * 0.6;
        const cpY = crownY + Math.sin(angle) * frondLength * 0.3;

        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.stroke();

        // Draw leaflets along frond
        const leaflets = 6;
        for (let l = 1; l < leaflets; l++) {
          const t = l / leaflets;
          const lx = crownX + (endX - crownX) * t * 0.8;
          const ly = crownY + (endY - crownY) * t * 0.5 + frondLength * droop * t * t;
          const leafletSize = 8 * plant.scale * (1 - t * 0.5) * frondGrowth;
          drawLeaf(ctx, lx, ly, angle + (l % 2 === 0 ? 0.5 : -0.5), leafletSize, plant.leafColor);
        }
      }
    }
  },

  [PlantCategory.Conifer]: (ctx, plant, width, height, time, variation) => {
    const progress = (time - plant.delay) / plant.growDuration;
    if (progress <= 0) return;

    const x = plant.x * width;
    const baseY = height;
    const plantHeight = plant.maxHeight * height * variation.heightMultiplier;
    const growth = Math.min(1, progress * 1.2);

    // Draw trunk
    const trunkHeight = plantHeight * growth;
    const trunkWidth = 4 * plant.scale * variation.thicknessMultiplier;

    ctx.fillStyle = plant.stemColor;
    ctx.beginPath();
    ctx.moveTo(x - trunkWidth / 2, baseY);
    ctx.lineTo(x + trunkWidth / 2, baseY);
    ctx.lineTo(x + trunkWidth / 4, baseY - trunkHeight);
    ctx.lineTo(x - trunkWidth / 4, baseY - trunkHeight);
    ctx.closePath();
    ctx.fill();

    // Draw conical foliage layers
    if (growth > 0.2) {
      const foliageGrowth = (growth - 0.2) * 1.25;
      const layers = 4 + Math.floor(variation.complexity * 3);
      const baseWidth = 20 * plant.scale * variation.sizeMultiplier;

      ctx.fillStyle = plant.leafColor;

      for (let l = 0; l < layers; l++) {
        const t = l / layers;
        const layerY = baseY - trunkHeight * (0.2 + t * 0.75);
        const layerWidth = baseWidth * (1 - t * 0.7) * foliageGrowth;
        const layerHeight = plantHeight * 0.15 * (1 - t * 0.3);

        ctx.beginPath();
        ctx.moveTo(x, layerY - layerHeight);
        ctx.lineTo(x - layerWidth, layerY);
        ctx.lineTo(x + layerWidth, layerY);
        ctx.closePath();
        ctx.fill();
      }
    }
  },
};

/**
 * Main plant rendering function
 * Uses category-based dispatch for O(1) lookup
 * Optimized to use cached category/variation when available
 */
export function drawPlant(
  ctx: Ctx,
  plant: PlantData,
  width: number,
  height: number,
  time: number
): void {
  // Use cached values for O(1) lookup, fall back to function calls if not cached
  const category = plant.category ?? getPlantCategory(plant.type);
  const variation = plant.variation ?? getPlantVariation(plant.type);
  const renderer = categoryRenderers[category];
  renderer(ctx, plant, width, height, time, variation);
}
