import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import AchievementToast from '../AchievementToast';
import { enqueueToast, dismissToast, clearToasts, pendingToasts } from '../../store/achievementStore';

describe('Achievement toast store', () => {
  beforeEach(() => {
    clearToasts();
  });

  it('enqueueToast adds a toast to the queue', () => {
    expect(pendingToasts()).toHaveLength(0);

    enqueueToast({
      achievementId: 'first_rally',
      name: 'First Rally',
      description: 'Play your first match',
      icon: '\uD83C\uDFD3',
      tier: 'bronze',
    });

    expect(pendingToasts()).toHaveLength(1);
    expect(pendingToasts()[0].name).toBe('First Rally');
  });

  it('dismissToast removes a specific toast', () => {
    enqueueToast({
      achievementId: 'first_rally',
      name: 'First Rally',
      description: 'Play your first match',
      icon: '\uD83C\uDFD3',
      tier: 'bronze',
    });
    enqueueToast({
      achievementId: 'hat_trick',
      name: 'Hat Trick',
      description: 'Win 3 in a row',
      icon: '\uD83C\uDFA9',
      tier: 'bronze',
    });

    expect(pendingToasts()).toHaveLength(2);

    const firstId = pendingToasts()[0].id;
    dismissToast(firstId);

    expect(pendingToasts()).toHaveLength(1);
    expect(pendingToasts()[0].name).toBe('Hat Trick');
  });

  it('clearToasts empties the queue', () => {
    enqueueToast({
      achievementId: 'first_rally',
      name: 'First Rally',
      description: 'Play your first match',
      icon: '\uD83C\uDFD3',
      tier: 'bronze',
    });
    enqueueToast({
      achievementId: 'hat_trick',
      name: 'Hat Trick',
      description: 'Win 3 in a row',
      icon: '\uD83C\uDFA9',
      tier: 'bronze',
    });

    expect(pendingToasts()).toHaveLength(2);

    clearToasts();

    expect(pendingToasts()).toHaveLength(0);
  });

  it('queue cap: does not add more than 10 toasts', () => {
    for (let i = 0; i < 12; i++) {
      enqueueToast({
        achievementId: `badge_${i}`,
        name: `Badge ${i}`,
        description: `Description ${i}`,
        icon: '\uD83C\uDFC6',
        tier: 'bronze',
      });
    }

    expect(pendingToasts()).toHaveLength(10);
  });

  it('each toast gets a unique UUID', () => {
    enqueueToast({
      achievementId: 'first_rally',
      name: 'First Rally',
      description: 'Play your first match',
      icon: '\uD83C\uDFD3',
      tier: 'bronze',
    });
    enqueueToast({
      achievementId: 'hat_trick',
      name: 'Hat Trick',
      description: 'Win 3 in a row',
      icon: '\uD83C\uDFA9',
      tier: 'bronze',
    });

    const ids = pendingToasts().map(t => t.id);
    expect(ids[0]).not.toBe(ids[1]);
    // Verify UUIDs look like valid UUIDs (8-4-4-4-12 hex format)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  });
});

// Gap #9: AchievementToast component render tests
describe('AchievementToast component', () => {
  afterEach(() => {
    clearToasts();
    vi.restoreAllMocks();
  });

  it('renders an sr-only live region in the DOM', () => {
    const { container } = render(() => <AchievementToast />);
    const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
  });

  it('renders dismiss button with accessible label when toast is showing', async () => {
    vi.useFakeTimers();

    render(() => <AchievementToast />);

    enqueueToast({
      achievementId: 'first_rally',
      name: 'First Rally',
      description: 'Play your first match',
      icon: '\uD83C\uDFD3',
      tier: 'bronze',
    });

    // Need to advance timers to let toast appear
    // processNext starts, then APPEAR_DELAY (1500ms) for visible
    await vi.advanceTimersByTimeAsync(1600);

    const dismissBtn = screen.queryByLabelText('Dismiss achievement notification');
    expect(dismissBtn).not.toBeNull();

    vi.useRealTimers();
  });
});
