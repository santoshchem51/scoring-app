import { makeNoise2D } from 'open-simplex-noise';

export interface WaveConfig {
  count: number;
  width: number;
  height: number;
}

export interface WavePoint {
  x: number;
  y: number;
}

export interface WaveLine {
  points: WavePoint[];
  opacity: number;
}

const noise2D = makeNoise2D(42);
const STEP = 8; // pixels between sample points
const FREQUENCY = 0.003;
const AMPLITUDE_RATIO = 0.08; // wave amplitude as fraction of height

export function generateWaves(time: number, config: WaveConfig): WaveLine[] {
  const { count, width, height } = config;
  const waves: WaveLine[] = [];
  const t = time * 0.0005;

  for (let i = 0; i < count; i++) {
    const baseY = (height / (count + 1)) * (i + 1);
    const amplitude = height * AMPLITUDE_RATIO;
    const opacity = 0.1 + (i % 3) * 0.04; // varies between 0.10, 0.14, 0.18
    const points: WavePoint[] = [];

    for (let x = 0; x <= width; x += STEP) {
      const n = noise2D(x * FREQUENCY + i * 0.5, t + i * 0.3);
      points.push({ x, y: baseY + n * amplitude });
    }

    // Ensure last point is exactly at width
    if (points[points.length - 1].x !== width) {
      const n = noise2D(width * FREQUENCY + i * 0.5, t + i * 0.3);
      points.push({ x: width, y: baseY + n * amplitude });
    }

    waves.push({ points, opacity });
  }

  return waves;
}
