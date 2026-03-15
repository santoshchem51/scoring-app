import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { SegmentedControl } from '../SegmentedControl';

const segments = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

describe('SegmentedControl', () => {
  it('renders all segments as buttons with role="tab"', () => {
    render(() => (
      <SegmentedControl segments={segments} activeId="a" onSelect={() => {}} />
    ));
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0].textContent).toBe('Alpha');
    expect(tabs[1].textContent).toBe('Beta');
    expect(tabs[2].textContent).toBe('Gamma');
  });

  it('active segment has aria-selected="true"', () => {
    render(() => (
      <SegmentedControl segments={segments} activeId="b" onSelect={() => {}} />
    ));
    const tabs = screen.getAllByRole('tab');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  });

  it('inactive segments have aria-selected="false"', () => {
    render(() => (
      <SegmentedControl segments={segments} activeId="b" onSelect={() => {}} />
    ));
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[2].getAttribute('aria-selected')).toBe('false');
  });

  it('active segment has tabindex="0", inactive have tabindex="-1"', () => {
    render(() => (
      <SegmentedControl segments={segments} activeId="a" onSelect={() => {}} />
    ));
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('tabindex')).toBe('-1');
    expect(tabs[2].getAttribute('tabindex')).toBe('-1');
  });

  it('calls onSelect when a tab is clicked', async () => {
    const onSelect = vi.fn();
    render(() => (
      <SegmentedControl segments={segments} activeId="a" onSelect={onSelect} />
    ));
    const tabs = screen.getAllByRole('tab');
    await fireEvent.click(tabs[1]);
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('container has role="tablist"', () => {
    render(() => (
      <SegmentedControl segments={segments} activeId="a" onSelect={() => {}} />
    ));
    expect(screen.getByRole('tablist')).toBeDefined();
  });

  it('container has aria-label when provided', () => {
    render(() => (
      <SegmentedControl
        segments={segments}
        activeId="a"
        onSelect={() => {}}
        ariaLabel="View mode"
      />
    ));
    expect(screen.getByRole('tablist').getAttribute('aria-label')).toBe('View mode');
  });
});
