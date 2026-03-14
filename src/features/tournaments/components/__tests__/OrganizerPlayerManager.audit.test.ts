import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@solidjs/testing-library';
import type { DocumentReference } from 'firebase/firestore';

// --- Mocks ---

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
vi.mock('firebase/firestore', () => ({
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  doc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

const mockUpdateRegistrationStatus = vi.fn().mockResolvedValue(undefined);
const mockBatchUpdateStatus = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../../data/firebase/firestoreRegistrationRepository', () => ({
  firestoreRegistrationRepository: {
    updateRegistrationStatus: (...args: unknown[]) => mockUpdateRegistrationStatus(...args),
    batchUpdateStatus: (...args: unknown[]) => mockBatchUpdateStatus(...args),
    saveWithStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockBuildAuditEntry = vi.fn();
vi.mock('../../../../data/firebase/firestoreAuditRepository', () => ({
  buildAuditEntry: (...args: unknown[]) => mockBuildAuditEntry(...args),
}));

const mockGetTournamentRole = vi.fn();
vi.mock('../../engine/roleHelpers', () => ({
  getTournamentRole: (...args: unknown[]) => mockGetTournamentRole(...args),
}));

const mockUser = vi.fn();
vi.mock('../../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../../engine/registrationExpiry', () => ({
  getExpiredRegistrationUserIds: () => [],
}));

// Mock lucide-solid to avoid SVG rendering issues in test
vi.mock('lucide-solid', () => ({
  Check: () => null,
  X: () => null,
}));

import type { Tournament, TournamentRegistration } from '../../../../data/types';

function makeTournament(): Tournament {
  return {
    id: 't1',
    name: 'Test Tourney',
    organizerId: 'org1',
    status: 'registration',
    format: 'round_robin',
    teamFormation: 'random',
    maxPlayers: 16,
    pointsToWin: 11,
    bestOf: 1,
    courts: 2,
    createdAt: Date.now(),
    shareCode: 'ABC123',
    accessMode: 'open',
    pendingTTL: 72,
    staff: {},
    templateId: null,
  } as Tournament;
}

function makeReg(userId: string, name: string): TournamentRegistration {
  return {
    id: userId,
    tournamentId: 't1',
    userId,
    playerName: name,
    teamId: null,
    paymentStatus: 'unpaid',
    paymentNote: '',
    lateEntry: false,
    skillRating: null,
    partnerId: null,
    partnerName: null,
    profileComplete: false,
    registeredAt: Date.now(),
    status: 'pending',
    declineReason: null,
    statusUpdatedAt: null,
  };
}

describe('OrganizerPlayerManager audit logging', () => {
  const fakeRef = { id: 'audit-1', path: 'tournaments/t1/auditLog/audit-1' } as unknown as DocumentReference;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockReturnValue({ uid: 'actor-1', displayName: 'Actor One' });
    mockGetTournamentRole.mockReturnValue('admin');
    mockBuildAuditEntry.mockReturnValue({
      id: 'audit-1',
      ref: fakeRef,
      action: 'registration_approve',
      actorId: 'actor-1',
      actorName: 'Actor One',
      actorRole: 'admin',
      targetType: 'registration',
      targetId: 'u1',
      details: { action: 'registration_approve', registrationId: 'u1', playerName: 'Alice' },
      timestamp: 'SERVER_TS',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('calls buildAuditEntry with correct params on approve', async () => {
    const { render, screen, fireEvent } = await import('@solidjs/testing-library');
    const { default: OrganizerPlayerManager } = await import('../OrganizerPlayerManager');

    const tournament = makeTournament();
    const regs = [makeReg('u1', 'Alice')];

    render(() => OrganizerPlayerManager({
      tournament,
      registrations: regs,
      onUpdated: vi.fn(),
    }));

    const approveBtn = screen.getByText('Approve');
    await fireEvent.click(approveBtn);

    await vi.waitFor(() => {
      expect(mockUpdateRegistrationStatus).toHaveBeenCalledWith('t1', 'u1', 'pending', 'confirmed');
    });

    expect(mockBuildAuditEntry).toHaveBeenCalledWith('t1', {
      action: 'registration_approve',
      actorId: 'actor-1',
      actorName: 'Actor One',
      actorRole: 'admin',
      targetType: 'registration',
      targetId: 'u1',
      details: { action: 'registration_approve', registrationId: 'u1', playerName: 'Alice' },
    });

    expect(mockSetDoc).toHaveBeenCalledWith(
      fakeRef,
      expect.objectContaining({
        action: 'registration_approve',
        actorId: 'actor-1',
      }),
    );
  });

  it('calls buildAuditEntry with correct params on decline', async () => {
    mockBuildAuditEntry.mockReturnValue({
      id: 'audit-2',
      ref: fakeRef,
      action: 'registration_decline',
      actorId: 'actor-1',
      actorName: 'Actor One',
      actorRole: 'admin',
      targetType: 'registration',
      targetId: 'u1',
      details: { action: 'registration_decline', registrationId: 'u1', playerName: 'Alice', reason: undefined },
      timestamp: 'SERVER_TS',
    });

    const { render, screen, fireEvent } = await import('@solidjs/testing-library');
    const { default: OrganizerPlayerManager } = await import('../OrganizerPlayerManager');

    const tournament = makeTournament();
    const regs = [makeReg('u1', 'Alice')];

    render(() => OrganizerPlayerManager({
      tournament,
      registrations: regs,
      onUpdated: vi.fn(),
    }));

    // Step 1: Click initial "Decline" to reveal reason input
    const initialDeclineBtn = screen.getByText('Decline');
    await fireEvent.click(initialDeclineBtn);

    // Step 2: Click the confirm "Decline" button (now there are two)
    await vi.waitFor(() => {
      const allDecline = screen.getAllByText('Decline');
      expect(allDecline.length).toBeGreaterThan(1);
    });
    const allDeclineButtons = screen.getAllByText('Decline');
    // The confirm button is the last one (in the inline form)
    const confirmBtn = allDeclineButtons[allDeclineButtons.length - 1];
    await fireEvent.click(confirmBtn);

    await vi.waitFor(() => {
      expect(mockUpdateRegistrationStatus).toHaveBeenCalledWith('t1', 'u1', 'pending', 'declined', undefined);
    });

    expect(mockBuildAuditEntry).toHaveBeenCalledWith('t1', {
      action: 'registration_decline',
      actorId: 'actor-1',
      actorName: 'Actor One',
      actorRole: 'admin',
      targetType: 'registration',
      targetId: 'u1',
      details: { action: 'registration_decline', registrationId: 'u1', playerName: 'Alice', reason: undefined },
    });

    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('skips audit when user is null', async () => {
    mockUser.mockReturnValue(null);

    const { render, screen, fireEvent } = await import('@solidjs/testing-library');
    const { default: OrganizerPlayerManager } = await import('../OrganizerPlayerManager');

    const tournament = makeTournament();
    const regs = [makeReg('u1', 'Alice')];

    render(() => OrganizerPlayerManager({
      tournament,
      registrations: regs,
      onUpdated: vi.fn(),
    }));

    const approveBtn = screen.getByText('Approve');
    await fireEvent.click(approveBtn);

    await vi.waitFor(() => {
      expect(mockUpdateRegistrationStatus).toHaveBeenCalled();
    });

    expect(mockBuildAuditEntry).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
