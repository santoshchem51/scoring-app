import { render, screen, fireEvent } from '@solidjs/testing-library';
import { describe, it, expect, vi } from 'vitest';

// Mock @solidjs/router — A renders as an anchor, useNavigate returns a no-op
vi.mock('@solidjs/router', () => ({
  A: (props: any) => <a href={props.href}>{props.children}</a>,
  useNavigate: () => vi.fn(),
}));

// Mock Firebase and auth
vi.mock('../../../data/firebase/config', () => ({
  auth: { currentUser: null },
  firestore: {},
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

vi.mock('../../../data/firebase/cloudSync', () => ({
  cloudSync: {
    syncUserProfile: vi.fn(() => Promise.resolve()),
    pushLocalMatchesToCloud: vi.fn(() => Promise.resolve(0)),
    pullCloudMatchesToLocal: vi.fn(() => Promise.resolve(0)),
    syncMatchToCloud: vi.fn(),
    syncScoreEventToCloud: vi.fn(),
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  getDoc: vi.fn(),
  doc: vi.fn(),
}));

vi.mock('../../../data/firebase/firestoreBuddyGroupRepository', () => ({
  firestoreBuddyGroupRepository: {
    create: vi.fn(() => Promise.resolve()),
    addMember: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../../tournaments/engine/shareCode', () => ({
  generateShareCode: vi.fn(() => 'TEST123'),
}));

// Import component after mocks
import CreateGroupPage from '../CreateGroupPage';

describe('CreateGroupPage', () => {
  it('renders form fields (name, description, location)', () => {
    render(() => <CreateGroupPage />);
    expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/default location/i)).toBeInTheDocument();
  });

  it('shows error on empty name submit', async () => {
    render(() => <CreateGroupPage />);
    const submitButton = screen.getByRole('button', { name: 'Create Group' });
    await fireEvent.click(submitButton);
    expect(screen.getByText('Group name is required')).toBeInTheDocument();
  });
});
