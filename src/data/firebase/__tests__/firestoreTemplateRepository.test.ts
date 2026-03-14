import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ id: `doc-${args.length}`, path: args.join('/') })));
const mockCollection = vi.hoisted(() => vi.fn(() => 'mock-templates-col'));
const mockSetDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetDocs = vi.hoisted(() => vi.fn());
const mockDeleteDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockUpdateDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  setDoc: mockSetDoc,
  getDocs: mockGetDocs,
  deleteDoc: mockDeleteDoc,
  updateDoc: mockUpdateDoc,
  query: vi.fn((...args: unknown[]) => args),
  orderBy: vi.fn(() => 'mock-orderBy'),
  increment: vi.fn((n: number) => ({ _type: 'increment', value: n })),
}));

vi.mock('../config', () => ({ firestore: 'mock-firestore' }));

import {
  saveTemplate,
  getTemplates,
  deleteTemplate,
  incrementUsageCount,
} from '../firestoreTemplateRepository';
import type { TournamentTemplate } from '../../../features/tournaments/engine/templateTypes';

function makeTemplate(overrides: Partial<TournamentTemplate> = {}): TournamentTemplate {
  return {
    id: 'tpl-1',
    name: 'My Template',
    format: 'round-robin',
    gameType: 'doubles',
    config: {
      gameType: 'doubles',
      scoringMode: 'rally',
      matchFormat: 'single',
      pointsToWin: 11,
      poolCount: 2,
      teamsPerPoolAdvancing: 2,
    },
    teamFormation: 'byop',
    maxPlayers: 16,
    accessMode: 'open',
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
    createdAt: 1000,
    updatedAt: 1000,
    usageCount: 0,
    ...overrides,
  };
}

describe('firestoreTemplateRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('saveTemplate', () => {
    it('writes template to correct Firestore path', async () => {
      const template = makeTemplate();

      await saveTemplate('user-1', template);

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'users', 'user-1', 'templates', 'tpl-1');
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.any(String) }),
        template,
      );
    });
  });

  describe('getTemplates', () => {
    it('returns templates sorted by updatedAt desc', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'tpl-2', data: () => ({ name: 'Second', updatedAt: 2000 }) },
          { id: 'tpl-1', data: () => ({ name: 'First', updatedAt: 1000 }) },
        ],
      });

      const templates = await getTemplates('user-1');

      expect(templates).toHaveLength(2);
      expect(templates[0].id).toBe('tpl-2');
      expect(templates[0].name).toBe('Second');
      expect(templates[1].id).toBe('tpl-1');
      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'users', 'user-1', 'templates');
    });

    it('returns empty array when no templates exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const templates = await getTemplates('user-1');

      expect(templates).toEqual([]);
    });
  });

  describe('deleteTemplate', () => {
    it('deletes template at correct Firestore path', async () => {
      await deleteTemplate('user-1', 'tpl-1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'users', 'user-1', 'templates', 'tpl-1');
      expect(mockDeleteDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.any(String) }),
      );
    });
  });

  describe('incrementUsageCount', () => {
    it('increments usageCount field by 1', async () => {
      await incrementUsageCount('user-1', 'tpl-1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'users', 'user-1', 'templates', 'tpl-1');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.any(String) }),
        { usageCount: { _type: 'increment', value: 1 } },
      );
    });
  });
});
