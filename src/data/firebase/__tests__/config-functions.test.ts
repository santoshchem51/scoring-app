import { describe, it, expect } from 'vitest';

describe('firebase config exports', () => {
  it('exports a functions instance', async () => {
    const mod = await import('../config');
    expect(mod.functions).toBeDefined();
  });
});
