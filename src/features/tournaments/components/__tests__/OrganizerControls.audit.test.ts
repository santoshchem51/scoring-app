import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mocks ---
const { mockSetDoc, mockBuildAuditEntry, mockUpdateStatus, mockGetTournamentRole, mockUser } = vi.hoisted(() => ({
  mockSetDoc: vi.fn().mockResolvedValue(undefined),
  mockBuildAuditEntry: vi.fn(),
  mockUpdateStatus: vi.fn().mockResolvedValue(undefined),
  mockGetTournamentRole: vi.fn().mockReturnValue('owner'),
  mockUser: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  setDoc: mockSetDoc,
}));

vi.mock('../../../../data/firebase/firestoreAuditRepository', () => ({
  buildAuditEntry: mockBuildAuditEntry,
}));

vi.mock('../../../../data/firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: {
    updateStatus: mockUpdateStatus,
  },
}));

vi.mock('../../engine/roleHelpers', () => ({
  getTournamentRole: mockGetTournamentRole,
}));

vi.mock('../../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Stub out ConfirmDialog to avoid SolidJS rendering issues
vi.mock('../../../../shared/components/ConfirmDialog', () => ({
  default: () => null,
}));

vi.mock('solid-js', async () => {
  const actual = await vi.importActual<typeof import('solid-js')>('solid-js');
  return actual;
});

import type { Tournament, TournamentStatus } from '../../../../data/types';

function makeTournament(overrides?: Partial<Tournament>): Tournament {
  return {
    id: 't1',
    name: 'Test Tourney',
    date: Date.now(),
    location: 'Court 1',
    format: 'round-robin',
    config: {
      gameType: 'singles',
      scoringMode: 'rally',
      matchFormat: 'single',
      pointsToWin: 11,
      poolCount: 1,
      teamsPerPoolAdvancing: 2,
    },
    organizerId: 'user-1',
    staff: {},
    staffUids: [],
    status: 'pool-play',
    maxPlayers: null,
    teamFormation: null,
    minPlayers: null,
    entryFee: null,
    rules: {
      registrationDeadline: null,
      checkInRequired: false,
      checkInOpens: null,
      checkInCloses: null,
      scoringRules: '',
      timeoutRules: '',
      conductRules: '',
      penalties: [],
      additionalNotes: '',
    },
    pausedFrom: null,
    cancellationReason: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    visibility: 'private',
    shareCode: null,
    accessMode: 'open',
    listed: false,
    buddyGroupId: null,
    buddyGroupName: null,
    registrationCounts: { confirmed: 0, pending: 0 },
    ...overrides,
  };
}

const FAKE_USER = { uid: 'user-1', displayName: 'Test User' };
const FAKE_AUDIT_REF = { id: 'audit-ref-id', path: 'tournaments/t1/auditLog/a1' };

function setupAuditMock() {
  mockBuildAuditEntry.mockReturnValue({
    id: 'a1',
    ref: FAKE_AUDIT_REF,
    action: 'status_change',
    actorId: FAKE_USER.uid,
    actorName: FAKE_USER.displayName,
    actorRole: 'owner',
    targetType: 'tournament',
    targetId: 't1',
    details: {},
    timestamp: 'mock-ts',
  });
}

describe('OrganizerControls audit logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockReturnValue(FAKE_USER);
    mockUpdateStatus.mockResolvedValue(undefined);
    setupAuditMock();
  });

  // We test the audit logic by importing the module and calling the handlers.
  // Since this is a SolidJS component, we test via dynamic import + render workaround.
  // Instead, we extract the audit writing logic for unit-level verification.

  it('calls buildAuditEntry with status_change for pause', async () => {
    // Dynamically import to pick up mocks
    const { writeStatusAudit } = await import('../OrganizerControls.audit');

    const tournament = makeTournament({ status: 'pool-play' });
    writeStatusAudit(tournament, FAKE_USER, 'pool-play', 'paused');

    expect(mockBuildAuditEntry).toHaveBeenCalledWith('t1', {
      action: 'status_change',
      actorId: 'user-1',
      actorName: 'Test User',
      actorRole: 'owner',
      targetType: 'tournament',
      targetId: 't1',
      details: { action: 'status_change', oldStatus: 'pool-play', newStatus: 'paused', reason: undefined },
    });
    expect(mockSetDoc).toHaveBeenCalledWith(FAKE_AUDIT_REF, expect.objectContaining({
      action: 'status_change',
      actorId: 'user-1',
    }));
  });

  it('calls buildAuditEntry with status_change for resume', async () => {
    const { writeStatusAudit } = await import('../OrganizerControls.audit');

    const tournament = makeTournament({ status: 'paused', pausedFrom: 'pool-play' });
    writeStatusAudit(tournament, FAKE_USER, 'paused', 'pool-play');

    expect(mockBuildAuditEntry).toHaveBeenCalledWith('t1', expect.objectContaining({
      action: 'status_change',
      details: { action: 'status_change', oldStatus: 'paused', newStatus: 'pool-play', reason: undefined },
    }));
  });

  it('calls buildAuditEntry with status_change for cancel', async () => {
    const { writeStatusAudit } = await import('../OrganizerControls.audit');

    const tournament = makeTournament({ status: 'pool-play' });
    writeStatusAudit(tournament, FAKE_USER, 'pool-play', 'cancelled', 'Cancelled by organizer');

    expect(mockBuildAuditEntry).toHaveBeenCalledWith('t1', expect.objectContaining({
      action: 'status_change',
      details: { action: 'status_change', oldStatus: 'pool-play', newStatus: 'cancelled', reason: 'Cancelled by organizer' },
    }));
  });

  it('calls buildAuditEntry with status_change for end-early', async () => {
    const { writeStatusAudit } = await import('../OrganizerControls.audit');

    const tournament = makeTournament({ status: 'bracket' });
    writeStatusAudit(tournament, FAKE_USER, 'bracket', 'completed');

    expect(mockBuildAuditEntry).toHaveBeenCalledWith('t1', expect.objectContaining({
      action: 'status_change',
      details: { action: 'status_change', oldStatus: 'bracket', newStatus: 'completed', reason: undefined },
    }));
  });

  it('does not write audit when user is null', async () => {
    const { writeStatusAudit } = await import('../OrganizerControls.audit');

    const tournament = makeTournament({ status: 'pool-play' });
    writeStatusAudit(tournament, null, 'pool-play', 'paused');

    expect(mockBuildAuditEntry).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
