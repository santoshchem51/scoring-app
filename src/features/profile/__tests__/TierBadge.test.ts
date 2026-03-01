import { describe, it, expect } from 'vitest';
import { getTierColor, getConfidenceDots } from '../components/TierBadge';

describe('getTierColor', () => {
  it('returns slate classes for beginner', () => {
    const color = getTierColor('beginner');
    expect(color).toEqual({ bg: 'bg-slate-500/20', text: 'text-slate-400', dot: 'bg-slate-400' });
  });

  it('returns green classes for intermediate', () => {
    const color = getTierColor('intermediate');
    expect(color).toEqual({ bg: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-400' });
  });

  it('returns orange classes for advanced', () => {
    const color = getTierColor('advanced');
    expect(color).toEqual({ bg: 'bg-orange-400/20', text: 'text-orange-400', dot: 'bg-orange-400' });
  });

  it('returns yellow classes for expert', () => {
    const color = getTierColor('expert');
    expect(color).toEqual({ bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400' });
  });
});

describe('getConfidenceDots', () => {
  it('returns 1 filled dot for low confidence', () => {
    const dots = getConfidenceDots('low');
    expect(dots.filter((d) => d.filled)).toHaveLength(1);
    expect(dots).toHaveLength(3);
  });

  it('returns 2 filled dots for medium confidence', () => {
    const dots = getConfidenceDots('medium');
    expect(dots.filter((d) => d.filled)).toHaveLength(2);
  });

  it('returns 3 filled dots for high confidence', () => {
    const dots = getConfidenceDots('high');
    expect(dots.filter((d) => d.filled)).toHaveLength(3);
  });
});
