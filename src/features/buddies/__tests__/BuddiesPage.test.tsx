import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect, vi } from 'vitest';
import { createSignal } from 'solid-js';
import type { BuddyGroup } from '../../../data/types';

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

// Mock useBuddyGroups to control loading/groups state
const [mockGroups, setMockGroups] = createSignal<BuddyGroup[]>([]);
const [mockLoading, setMockLoading] = createSignal(false);

vi.mock('../hooks/useBuddyGroups', () => ({
  useBuddyGroups: () => ({
    groups: mockGroups,
    loading: mockLoading,
  }),
}));

// Import component after mocks
import BuddiesPage from '../BuddiesPage';

describe('BuddiesPage', () => {
  it('renders page title "Buddies"', () => {
    setMockGroups([]);
    setMockLoading(false);
    render(() => <BuddiesPage />);
    expect(screen.getByText('Buddies')).toBeInTheDocument();
  });

  it('shows empty state when no groups', () => {
    setMockGroups([]);
    setMockLoading(false);
    render(() => <BuddiesPage />);
    expect(screen.getByText('No groups yet')).toBeInTheDocument();
    expect(screen.getByText('Create Your First Group')).toBeInTheDocument();
  });

  it('shows "+ New Group" link', () => {
    setMockGroups([]);
    setMockLoading(false);
    render(() => <BuddiesPage />);
    expect(screen.getByText('+ New Group')).toBeInTheDocument();
  });
});
