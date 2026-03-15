import { describe, it, expect } from 'vitest';
import { generateShareCode, SHARE_CODE_CHARS } from '../shareCode';

describe('generateShareCode', () => {
  it('generates an 8-character code', () => {
    const code = generateShareCode();
    expect(code).toHaveLength(8);
  });

  it('uses only valid characters', () => {
    const code = generateShareCode();
    for (const ch of code) {
      expect(SHARE_CODE_CHARS).toContain(ch);
    }
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateShareCode()));
    expect(codes.size).toBe(100);
  });
});
