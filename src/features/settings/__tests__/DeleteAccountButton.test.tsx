import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

vi.mock('../../../data/firebase/config', () => ({
  auth: { currentUser: { uid: 'test-uid' } },
  firestore: {},
}));

describe('DeleteAccountButton', () => {
  it('shows confirmation dialog before deleting', async () => {
    const { DeleteAccountButton } = await import('../DeleteAccountButton');
    const { getByText, queryByText } = render(() => <DeleteAccountButton />);
    expect(queryByText('This cannot be undone')).toBeNull();
    fireEvent.click(getByText('Delete Account'));
    expect(queryByText('This cannot be undone')).toBeTruthy();
  });

  it('hides confirmation on cancel', async () => {
    const { DeleteAccountButton } = await import('../DeleteAccountButton');
    const { getByText, queryByText } = render(() => <DeleteAccountButton />);
    fireEvent.click(getByText('Delete Account'));
    expect(queryByText('This cannot be undone')).toBeTruthy();
    fireEvent.click(getByText('Cancel'));
    expect(queryByText('This cannot be undone')).toBeNull();
  });
});
