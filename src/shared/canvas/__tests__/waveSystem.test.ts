import { describe, it, expect } from 'vitest';
import { generateWaves } from '../waveSystem';
import type { WaveConfig } from '../waveSystem';

const config: WaveConfig = { count: 8, width: 800, height: 600 };

describe('generateWaves', () => {
  it('returns the requested number of wave lines', () => {
    const waves = generateWaves(0, config);
    expect(waves).toHaveLength(8);
  });

  it('each wave has points spanning the full width', () => {
    const waves = generateWaves(0, config);
    for (const wave of waves) {
      expect(wave.points.length).toBeGreaterThan(10);
      expect(wave.points[0].x).toBe(0);
      expect(wave.points[wave.points.length - 1].x).toBe(config.width);
    }
  });

  it('all points have y values within reasonable bounds', () => {
    const waves = generateWaves(0, config);
    for (const wave of waves) {
      for (const pt of wave.points) {
        expect(pt.y).toBeGreaterThan(-100);
        expect(pt.y).toBeLessThan(config.height + 100);
      }
    }
  });

  it('produces different output at different timestamps', () => {
    const a = generateWaves(0, config);
    const b = generateWaves(5000, config);
    expect(a[0].points[5].y).not.toBeCloseTo(b[0].points[5].y, 1);
  });

  it('is deterministic — same time produces same output', () => {
    const a = generateWaves(1234, config);
    const b = generateWaves(1234, config);
    expect(a).toEqual(b);
  });

  it('wave opacity values are within 0.08–0.25 range', () => {
    const waves = generateWaves(0, config);
    for (const wave of waves) {
      expect(wave.opacity).toBeGreaterThanOrEqual(0.08);
      expect(wave.opacity).toBeLessThanOrEqual(0.25);
    }
  });

  it('respects custom wave count', () => {
    const waves = generateWaves(0, { ...config, count: 4 });
    expect(waves).toHaveLength(4);
  });

  it('returns empty array when count is 0', () => {
    const waves = generateWaves(0, { ...config, count: 0 });
    expect(waves).toEqual([]);
  });

  it('handles zero-size canvas without throwing', () => {
    expect(() => generateWaves(0, { count: 4, width: 0, height: 0 })).not.toThrow();
    const waves = generateWaves(0, { count: 4, width: 0, height: 0 });
    expect(waves).toHaveLength(4);
  });

  it('generates single wave when count is 1', () => {
    const waves = generateWaves(0, { ...config, count: 1 });
    expect(waves).toHaveLength(1);
    expect(waves[0].points.length).toBeGreaterThan(0);
    expect(waves[0].points[0].x).toBe(0);
    expect(waves[0].points[waves[0].points.length - 1].x).toBe(config.width);
  });
});
