import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import ActivityLog from '../ActivityLog';
import type { AuditLogEntry } from '../../engine/auditTypes';

const makeLogEntry = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: 'log-1',
  action: 'score_edit',
  actorId: 'u1',
  actorName: 'Alice',
  actorRole: 'admin',
  targetType: 'match',
  targetId: 'match-1',
  details: { action: 'score_edit', matchId: 'match-1', oldScores: [[11, 5]], newScores: [[11, 7]], oldWinner: 1, newWinner: 1 },
  timestamp: Date.now() - 60000,
  ...overrides,
});

describe('ActivityLog', () => {
  it('renders a list of audit entries with formatted actions', () => {
    const entries = [
      makeLogEntry({ id: 'log-1', actorName: 'Alice', action: 'score_edit' }),
      makeLogEntry({
        id: 'log-2', actorName: 'Bob', action: 'role_change',
        details: { action: 'role_change', targetUid: 'u3', targetName: 'Carol', oldRole: null, newRole: 'moderator' },
      }),
    ];

    render(() => <ActivityLog entries={entries} />);

    expect(screen.getByText('Alice edited match scores')).toBeTruthy();
    expect(screen.getByText('Bob added Carol as moderator')).toBeTruthy();
  });

  it('renders empty state when no entries', () => {
    render(() => <ActivityLog entries={[]} />);
    expect(screen.getByText('No activity yet')).toBeTruthy();
  });

  it('shows relative timestamps', () => {
    const entries = [makeLogEntry({ timestamp: Date.now() - 5000 })];
    render(() => <ActivityLog entries={entries} />);
    expect(screen.getByText('just now')).toBeTruthy();
  });
});
