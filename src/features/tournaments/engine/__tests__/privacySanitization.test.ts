import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DocumentSnapshot } from 'firebase/firestore';

// Mock firebase/firestore before importing the module under test
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...pathSegments: string[]) => pathSegments.join('/')),
  getDoc: vi.fn(),
}));

vi.mock('../../../../data/firebase/config', () => ({
  firestore: {},
}));

import { getSanitizedTeamNames } from '../privacySanitization';
import { getDoc } from 'firebase/firestore';

const mockedGetDoc = vi.mocked(getDoc);

function makeTierSnap(profileVisibility: string): DocumentSnapshot {
  return {
    exists: () => true,
    data: () => ({ profileVisibility }),
  } as unknown as DocumentSnapshot;
}

function makeMissingSnap(): DocumentSnapshot {
  return {
    exists: () => false,
    data: () => undefined,
  } as unknown as DocumentSnapshot;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSanitizedTeamNames', () => {
  it('returns real names when all players have profileVisibility: public', async () => {
    mockedGetDoc.mockResolvedValue(makeTierSnap('public'));

    const result = await getSanitizedTeamNames(
      ['player1', 'player2'],
      ['player3', 'player4'],
      'Eagles',
      'Hawks',
    );

    expect(result).toEqual({
      publicTeam1Name: 'Eagles',
      publicTeam2Name: 'Hawks',
    });
  });

  it('returns "Team A" / "Team B" when any player is private', async () => {
    // player1 public, player2 private, player3 public, player4 public
    mockedGetDoc
      .mockResolvedValueOnce(makeTierSnap('public'))
      .mockResolvedValueOnce(makeTierSnap('private'))
      .mockResolvedValueOnce(makeTierSnap('public'))
      .mockResolvedValueOnce(makeTierSnap('public'));

    const result = await getSanitizedTeamNames(
      ['player1', 'player2'],
      ['player3', 'player4'],
      'Eagles',
      'Hawks',
    );

    expect(result).toEqual({
      publicTeam1Name: 'Team A',
      publicTeam2Name: 'Hawks',
    });
  });

  it('returns "Team A" when player public tier doc does not exist', async () => {
    mockedGetDoc
      .mockResolvedValueOnce(makeMissingSnap()) // team1 player missing
      .mockResolvedValueOnce(makeTierSnap('public'))
      .mockResolvedValueOnce(makeTierSnap('public'));

    const result = await getSanitizedTeamNames(
      ['player1'],
      ['player2', 'player3'],
      'Eagles',
      'Hawks',
    );

    expect(result).toEqual({
      publicTeam1Name: 'Team A',
      publicTeam2Name: 'Hawks',
    });
  });

  it('returns real names when playerIds array is empty', async () => {
    const result = await getSanitizedTeamNames(
      [],
      [],
      'Eagles',
      'Hawks',
    );

    expect(result).toEqual({
      publicTeam1Name: 'Eagles',
      publicTeam2Name: 'Hawks',
    });
    expect(mockedGetDoc).not.toHaveBeenCalled();
  });

  it('handles Firestore errors gracefully (defaults to anonymized)', async () => {
    mockedGetDoc.mockRejectedValue(new Error('Firestore unavailable'));

    const result = await getSanitizedTeamNames(
      ['player1'],
      ['player2'],
      'Eagles',
      'Hawks',
    );

    expect(result).toEqual({
      publicTeam1Name: 'Team A',
      publicTeam2Name: 'Team B',
    });
  });
});
