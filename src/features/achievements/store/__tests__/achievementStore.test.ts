import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  pendingToasts,
  enqueueToast,
  dismissToast,
  clearToasts,
  onToastDismissed,
} from '../achievementStore';

describe('achievementStore', () => {
  beforeEach(() => {
    clearToasts();
  });

  it('dismissToast calls onToastDismissed callbacks with achievementId', () => {
    const cb = vi.fn();
    onToastDismissed(cb);

    enqueueToast({ achievementId: 'test', name: 'Test', description: 'Desc', icon: '🏆', tier: 'gold' });
    const toast = pendingToasts()[0];
    dismissToast(toast.id);

    expect(cb).toHaveBeenCalledWith('test');
  });

  it('multiple callbacks are all invoked', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    onToastDismissed(cb1);
    onToastDismissed(cb2);

    enqueueToast({ achievementId: 'test', name: 'Test', description: 'Desc', icon: '🏆', tier: 'gold' });
    dismissToast(pendingToasts()[0].id);

    expect(cb1).toHaveBeenCalledWith('test');
    expect(cb2).toHaveBeenCalledWith('test');
  });
});
