import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (must be before component imports) ---

// Auth mock — default: logged out (user returns null)
const mockUser = vi.fn(() => null as any);
vi.mock('../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: () => false,
    syncing: () => false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Router mock
vi.mock('@solidjs/router', () => ({
  A: (props: any) => <a href={props.href}>{props.children}</a>,
  useNavigate: () => () => {},
}));

// Tournament repository mock
vi.mock('../../../data/firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: {
    getPublicTournaments: vi.fn().mockResolvedValue({ tournaments: [], lastDoc: undefined }),
    getByOrganizer: vi.fn().mockResolvedValue([]),
    getByParticipant: vi.fn().mockResolvedValue([]),
    getByScorekeeper: vi.fn().mockResolvedValue([]),
  },
}));

// Invitation repository mock
vi.mock('../../../data/firebase/firestoreInvitationRepository', () => ({
  firestoreInvitationRepository: {
    getPendingForUser: vi.fn().mockResolvedValue([]),
  },
}));

// User repository mock (used by InvitationInbox inside MyTournamentsTab)
vi.mock('../../../data/firebase/firestoreUserRepository', () => ({
  firestoreUserRepository: {
    getProfile: vi.fn().mockResolvedValue(null),
  },
}));

// Discovery filters mock — pass-through
vi.mock('../engine/discoveryFilters', () => ({
  filterPublicTournaments: vi.fn((tournaments: any[]) => tournaments),
  mergeMyTournaments: vi.fn(() => []),
}));

// Import component after all mocks
import DiscoverPage from '../DiscoverPage';

describe('DiscoverPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: logged out
    mockUser.mockReturnValue(null);
  });

  it('renders page title "Tournaments"', () => {
    render(() => <DiscoverPage />);
    expect(screen.getByText('Tournaments')).toBeInTheDocument();
  });

  it('shows Browse content (search input) when logged out', async () => {
    render(() => <DiscoverPage />);
    const input = await screen.findByPlaceholderText('Search name or location...');
    expect(input).toBeInTheDocument();
  });

  it('hides tab switcher (no tablist role) when logged out', () => {
    render(() => <DiscoverPage />);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('shows tab switcher when logged in', () => {
    mockUser.mockReturnValue({ uid: 'user1', displayName: 'Test User', email: 'test@example.com' });
    render(() => <DiscoverPage />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Browse' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'My Tournaments' })).toBeInTheDocument();
  });
});
