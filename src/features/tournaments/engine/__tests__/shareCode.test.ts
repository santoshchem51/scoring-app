import { describe, it, expect } from 'vitest';
import { generateShareCode, SHARE_CODE_CHARS } from '../shareCode';

describe('generateShareCode', () => {
  it('returns a 6-character string', () => {
    const code = generateShareCode();
    expect(code).toHaveLength(6);
  });

  it('only contains allowed characters (no ambiguous 0/O/1/I/L)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateShareCode();
      for (const ch of code) {
        expect(SHARE_CODE_CHARS).toContain(ch);
      }
    }
  });

  it('generates unique codes (no duplicates in 100 runs)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateShareCode());
    }
    expect(codes.size).toBe(100);
  });

  it('does not contain ambiguous characters', () => {
    const ambiguous = ['0', 'O', '1', 'I', 'L'];
    for (let i = 0; i < 100; i++) {
      const code = generateShareCode();
      for (const ch of ambiguous) {
        expect(code).not.toContain(ch);
      }
    }
  });
});
