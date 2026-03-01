import { describe, it, expect, vi } from 'vitest';
import { createWaveRenderer } from '../waveRenderer';

function makeMockCtx() {
  const addColorStop = vi.fn();
  const strokeStyles: string[] = [];
  return {
    ctx: {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop })),
      set strokeStyle(v: string) { strokeStyles.push(v); },
      set lineWidth(_v: number) {},
      set globalAlpha(_v: number) {},
      set globalCompositeOperation(_v: string) {},
      set fillStyle(_v: string | CanvasGradient) {},
      canvas: { width: 1600, height: 1200 },
    } as unknown as CanvasRenderingContext2D,
    strokeStyles,
  };
}

describe('createWaveRenderer', () => {
  it('clears the canvas on every draw', () => {
    const { ctx } = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: -1000, y: -1000 });
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
  });

  it('draws stroke paths for each wave line', () => {
    const { ctx } = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: -1000, y: -1000 });
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('creates a radial gradient when cursor is within bounds', () => {
    const { ctx } = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: 400, y: 300 });
    expect(ctx.createRadialGradient).toHaveBeenCalled();
  });

  it('skips glow when cursor is off-screen', () => {
    const { ctx } = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: -1000, y: -1000 });
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  });

  it('respects custom wave count', () => {
    const { ctx } = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 4, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: -1000, y: -1000 });
    // 4 waves = 4 beginPath + 4 stroke calls
    expect(ctx.beginPath).toHaveBeenCalledTimes(4);
    expect(ctx.stroke).toHaveBeenCalledTimes(4);
  });

  it('caches gradient when cursor moves less than 5px', () => {
    const { ctx } = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: 400, y: 300 });
    renderer.draw(0, 800, 600, { x: 402, y: 301 });
    // Only one gradient creation — second draw reuses cached
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(1);
  });

  it('recreates gradient when cursor moves more than 5px', () => {
    const { ctx } = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: 400, y: 300 });
    renderer.draw(0, 800, 600, { x: 420, y: 320 });
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(2);
  });

  it('skips wave points in NAV_CLEARANCE zone (y < 80)', () => {
    const { ctx } = makeMockCtx();
    // With height=200, count=8: baseY positions are ~22, 44, 67, 89, 111...
    // Waves at baseY=22 and 44 are fully in NAV_CLEARANCE (all points < 80).
    // Wave at baseY=67 with amplitude=16 straddles the 80px boundary.
    // Waves below 80 are entirely skipped — no lineTo or moveTo for them.
    // Only waves with points >= 80 produce drawing calls.
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 200, { x: -1000, y: -1000 });

    // With 8 waves total, the first 2 are fully in clearance (baseY ~22, ~44).
    // The renderer calls beginPath for all 8 waves, but only draws for waves with points >= 80.
    // Waves fully in clearance have no moveTo or lineTo. The straddling wave uses
    // moveTo to restart the path after skipped points.
    const moveToCount = vi.mocked(ctx.moveTo).mock.calls.length;
    const lineToCount = vi.mocked(ctx.lineTo).mock.calls.length;

    // The total draw calls should be fewer than if all waves were fully drawn.
    // With 8 waves on an 800px canvas at STEP=8, a fully drawn wave has ~101 points:
    // 1 moveTo + 100 lineTo = 101 calls per wave. 8 waves = 808.
    // With NAV_CLEARANCE skipping, we should have significantly fewer total calls.
    expect(moveToCount + lineToCount).toBeLessThan(808);
    // But we should still have drawing calls for the waves below the nav zone
    expect(moveToCount + lineToCount).toBeGreaterThan(0);
  });
});
