import { describe, it, expect } from 'vitest';
import { hexToRgb } from '../colorUtils';

describe('hexToRgb', () => {
  it('converts 6-char hex with #', () => {
    expect(hexToRgb('#4ECDC4')).toBe('78, 205, 196');
  });

  it('converts 6-char hex without #', () => {
    expect(hexToRgb('E8725A')).toBe('232, 114, 90');
  });

  it('converts 3-char hex with #', () => {
    expect(hexToRgb('#fff')).toBe('255, 255, 255');
  });

  it('converts 3-char hex without #', () => {
    expect(hexToRgb('000')).toBe('0, 0, 0');
  });

  it('handles uppercase', () => {
    expect(hexToRgb('#AABBCC')).toBe('170, 187, 204');
  });

  it('handles lowercase', () => {
    expect(hexToRgb('#aabbcc')).toBe('170, 187, 204');
  });

  it('returns 0, 0, 0 for invalid input', () => {
    expect(hexToRgb('')).toBe('0, 0, 0');
    expect(hexToRgb('xyz')).toBe('0, 0, 0');
    expect(hexToRgb('#gggggg')).toBe('0, 0, 0');
  });
});
