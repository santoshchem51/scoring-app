import { generateWaves } from './waveSystem';

export interface RendererConfig {
  waveCount: number;
  waveOpacity: number;
  glowIntensity?: number;
  glowRadius?: number;
}

interface Cursor {
  x: number;
  y: number;
}

const WAVE_COLOR = '34, 197, 94'; // green RGB
const GLOW_COLOR_PRIMARY = '34, 197, 94';
const GLOW_COLOR_ACCENT = '249, 115, 22';
const NAV_CLEARANCE = 80; // px — no waves in top nav area

export function createWaveRenderer(ctx: CanvasRenderingContext2D, config: RendererConfig) {
  const glowRadius = config.glowRadius ?? 250;
  const glowIntensity = config.glowIntensity ?? 1;
  let lastGlowX = -1000;
  let lastGlowY = -1000;
  let cachedGradient: CanvasGradient | null = null;

  function draw(time: number, w: number, h: number, cursor: Cursor) {
    ctx.clearRect(0, 0, w, h);

    const cursorInBounds = cursor.x >= 0 && cursor.x <= w && cursor.y >= 0 && cursor.y <= h;

    // Draw cursor glow (radial gradient) before waves so waves render on top
    if (cursorInBounds) {
      // Only recreate gradient if cursor moved >5px
      const dx = cursor.x - lastGlowX;
      const dy = cursor.y - lastGlowY;
      if (dx * dx + dy * dy > 25 || !cachedGradient) {
        cachedGradient = ctx.createRadialGradient(
          cursor.x, cursor.y, 0,
          cursor.x, cursor.y, glowRadius,
        );
        cachedGradient.addColorStop(0, `rgba(${GLOW_COLOR_PRIMARY}, ${0.25 * glowIntensity})`);
        cachedGradient.addColorStop(0.5, `rgba(${GLOW_COLOR_ACCENT}, ${0.08 * glowIntensity})`);
        cachedGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lastGlowX = cursor.x;
        lastGlowY = cursor.y;
      }

      ctx.save();
      ctx.fillStyle = cachedGradient;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Generate and draw waves
    const waves = generateWaves(time, { count: config.waveCount, width: w, height: h });

    for (const wave of waves) {
      ctx.beginPath();

      let started = false;
      for (const pt of wave.points) {
        // Skip points in the nav clearance zone
        if (pt.y < NAV_CLEARANCE) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }

      // Calculate opacity — boost near cursor
      let opacity = wave.opacity * (config.waveOpacity / 0.15); // scale to configured opacity
      if (cursorInBounds) {
        // Find closest point in this wave to cursor
        let minDist = Infinity;
        for (const pt of wave.points) {
          const d = Math.hypot(pt.x - cursor.x, pt.y - cursor.y);
          if (d < minDist) minDist = d;
        }
        if (minDist < glowRadius) {
          const boost = (1 - minDist / glowRadius) * 0.25;
          opacity = Math.min(opacity + boost, 0.4);
        }
      }

      ctx.strokeStyle = `rgba(${WAVE_COLOR}, ${opacity})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  return { draw };
}
