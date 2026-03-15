import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('LiveNowSection expandable overflow', () => {
  const source = readFileSync(
    resolve(__dirname, '../LiveNowSection.tsx'),
    'utf-8',
  );

  it('uses createSignal for expanded state', () => {
    expect(source).toContain('createSignal');
    expect(source).toMatch(/expanded|setExpanded/);
  });

  it('renders a button (not span) for overflow', () => {
    // Old: <span class="text-xs...">N more live</span>
    // New: <button ...>N more live</button>
    expect(source).toContain('<button');
    expect(source).toContain('more live');
  });

  it('has a collapse toggle (Show fewer)', () => {
    expect(source).toContain('Show fewer');
  });

  it('uses LiveMatchCard for rendering', () => {
    expect(source).toContain('LiveMatchCard');
  });
});
