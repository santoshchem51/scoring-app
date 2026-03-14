import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import StaffManager from '../StaffManager';
import type { Tournament, TournamentRole } from '../../../../data/types';
import type { UserProfile } from '../../../../data/types';

const makeTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1', name: 'Test', date: Date.now(), location: '',
  format: 'single-elimination',
  config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 1, teamsPerPoolAdvancing: 2 },
  organizerId: 'owner-1',
  staff: { 'admin-1': 'admin', 'mod-1': 'moderator' } as Record<string, TournamentRole>,
  staffUids: ['admin-1', 'mod-1'],
  status: 'registration', maxPlayers: null, teamFormation: null, minPlayers: null,
  entryFee: null,
  rules: { registrationDeadline: null, checkInRequired: false, checkInOpens: null, checkInCloses: null, scoringRules: '', timeoutRules: '', conductRules: '', penalties: [], additionalNotes: '' },
  pausedFrom: null, cancellationReason: null,
  createdAt: Date.now(), updatedAt: Date.now(),
  visibility: 'private', shareCode: null, accessMode: 'open', listed: true,
  buddyGroupId: null, buddyGroupName: null,
  registrationCounts: { confirmed: 0, pending: 0 },
  ...overrides,
});

const makeProfile = (uid: string, name: string): UserProfile => ({
  id: uid,
  displayName: name,
  displayNameLower: name.toLowerCase(),
  email: `${name.toLowerCase()}@test.com`,
  photoURL: null,
  createdAt: Date.now(),
});

describe('StaffManager', () => {
  it('renders staff list with role badges', () => {
    render(() => (
      <StaffManager
        tournament={makeTournament()}
        currentUserId="owner-1"
        staffProfiles={[
          makeProfile('admin-1', 'Alice'),
          makeProfile('mod-1', 'Bob'),
        ]}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
        onChangeRole={vi.fn()}
      />
    ));
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();
    expect(screen.getByText('Moderator')).toBeTruthy();
  });

  it('shows remove button for staff when viewer is owner', () => {
    render(() => (
      <StaffManager
        tournament={makeTournament()}
        currentUserId="owner-1"
        staffProfiles={[makeProfile('admin-1', 'Alice')]}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
        onChangeRole={vi.fn()}
      />
    ));
    expect(screen.getByLabelText('Remove Alice')).toBeTruthy();
  });

  it('hides remove button when viewer is not admin+', () => {
    render(() => (
      <StaffManager
        tournament={makeTournament()}
        currentUserId="mod-1"
        staffProfiles={[makeProfile('admin-1', 'Alice')]}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
        onChangeRole={vi.fn()}
      />
    ));
    expect(screen.queryByLabelText('Remove Alice')).toBeNull();
  });

  it('shows Add Staff button for admin+', () => {
    render(() => (
      <StaffManager
        tournament={makeTournament()}
        currentUserId="owner-1"
        staffProfiles={[]}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
        onChangeRole={vi.fn()}
      />
    ));
    expect(screen.getByText('Add Staff')).toBeTruthy();
  });

  it('renders empty state when no staff', () => {
    render(() => (
      <StaffManager
        tournament={makeTournament({ staff: {}, staffUids: [] })}
        currentUserId="owner-1"
        staffProfiles={[]}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
        onChangeRole={vi.fn()}
      />
    ));
    expect(screen.getByText('No staff members yet')).toBeTruthy();
  });
});
