import { describe, it, expect, vi } from 'vitest';
import { createWaveRenderer } from '../waveRenderer';

function makeMockCtx() {
  const addColorStop = vi.fn();
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop })),
    set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {},
    set globalAlpha(_v: number) {},
    set globalCompositeOperation(_v: string) {},
    set fillStyle(_v: string | CanvasGradient) {},
    canvas: { width: 1600, height: 1200 },
  } as unknown as CanvasRenderingContext2D;
}

describe('createWaveRenderer', () => {
  it('clears the canvas on every draw', () => {
    const ctx = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: -1000, y: -1000 });
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
  });

  it('draws stroke paths for each wave line', () => {
    const ctx = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: -1000, y: -1000 });
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('creates a radial gradient when cursor is within bounds', () => {
    const ctx = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: 400, y: 300 });
    expect(ctx.createRadialGradient).toHaveBeenCalled();
  });

  it('skips glow when cursor is off-screen', () => {
    const ctx = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 8, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: -1000, y: -1000 });
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  });

  it('respects custom wave count', () => {
    const ctx = makeMockCtx();
    const renderer = createWaveRenderer(ctx, { waveCount: 4, waveOpacity: 0.15 });
    renderer.draw(0, 800, 600, { x: -1000, y: -1000 });
    // 4 waves = 4 beginPath + 4 stroke calls
    expect(ctx.beginPath).toHaveBeenCalledTimes(4);
    expect(ctx.stroke).toHaveBeenCalledTimes(4);
  });
});
