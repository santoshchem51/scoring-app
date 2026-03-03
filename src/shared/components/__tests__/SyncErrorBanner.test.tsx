import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

const mockSyncError = vi.fn(() => false);
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'u1' }),
    loading: () => false,
    syncing: () => false,
    syncError: () => mockSyncError(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../../../data/firebase/cloudSync', () => ({
  cloudSync: { pullCloudMatchesToLocal: vi.fn(() => Promise.resolve(0)) },
}));

describe('SyncErrorBanner', () => {
  it('shows nothing when syncError is false', async () => {
    mockSyncError.mockReturnValue(false);
    const { SyncErrorBanner } = await import('../SyncErrorBanner');
    const { container } = render(() => <SyncErrorBanner />);
    expect(container.textContent).toBe('');
  });

  it('shows error message when syncError is true', async () => {
    mockSyncError.mockReturnValue(true);
    const { SyncErrorBanner } = await import('../SyncErrorBanner');
    render(() => <SyncErrorBanner />);
    expect(screen.getByText(/couldn't load cloud matches/i)).toBeDefined();
  });
});
