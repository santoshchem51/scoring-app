import { describe, it, expect } from 'vitest';
import { formatAuditAction, formatRelativeTime } from '../auditFormatters';
import type { AuditLogEntry } from '../auditTypes';

const makeEntry = (overrides: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: 'log-1',
  action: 'score_edit',
  actorId: 'u1',
  actorName: 'Alice',
  actorRole: 'admin',
  targetType: 'match',
  targetId: 'match-1',
  details: { action: 'score_edit', matchId: 'match-1', oldScores: [[11, 5]], newScores: [[11, 7]], oldWinner: 1, newWinner: 1 },
  timestamp: Date.now(),
  ...overrides,
});

describe('formatAuditAction', () => {
  it('formats score_edit action', () => {
    expect(formatAuditAction(makeEntry({ action: 'score_edit' }))).toBe('Alice edited match scores');
  });

  it('formats role_change action with new role', () => {
    expect(formatAuditAction(makeEntry({
      action: 'role_change',
      details: { action: 'role_change', targetUid: 'u2', targetName: 'Bob', oldRole: null, newRole: 'moderator' },
    }))).toBe('Alice added Bob as moderator');
  });

  it('formats role_change action for removal', () => {
    expect(formatAuditAction(makeEntry({
      action: 'role_change',
      details: { action: 'role_change', targetUid: 'u2', targetName: 'Bob', oldRole: 'moderator', newRole: null },
    }))).toBe('Alice removed Bob from staff');
  });

  it('formats dispute_flag action', () => {
    expect(formatAuditAction(makeEntry({
      action: 'dispute_flag',
      details: { action: 'dispute_flag', matchId: 'm1', reason: 'Wrong score' },
    }))).toBe('Alice flagged a match as disputed');
  });

  it('formats dispute_resolve action', () => {
    expect(formatAuditAction(makeEntry({
      action: 'dispute_resolve',
      details: { action: 'dispute_resolve', matchId: 'm1', disputeId: 'd1', resolution: 'Fixed', type: 'edited' },
    }))).toBe('Alice resolved a dispute (scores edited)');
  });

  it('formats registration_approve action', () => {
    expect(formatAuditAction(makeEntry({
      action: 'registration_approve',
      details: { action: 'registration_approve', registrationId: 'r1', playerName: 'Carol' },
    }))).toBe('Alice approved Carol');
  });

  it('formats registration_decline action', () => {
    expect(formatAuditAction(makeEntry({
      action: 'registration_decline',
      details: { action: 'registration_decline', registrationId: 'r1', playerName: 'Carol' },
    }))).toBe('Alice declined Carol');
  });

  it('formats player_withdraw action', () => {
    expect(formatAuditAction(makeEntry({
      action: 'player_withdraw',
      details: { action: 'player_withdraw', registrationId: 'r1', playerName: 'Carol' },
    }))).toBe('Alice withdrew Carol');
  });

  it('formats status_change action', () => {
    expect(formatAuditAction(makeEntry({
      action: 'status_change',
      details: { action: 'status_change', oldStatus: 'registration', newStatus: 'pool-play' },
    }))).toBe('Alice changed status from registration to pool-play');
  });

  it('formats settings_change action', () => {
    expect(formatAuditAction(makeEntry({
      action: 'settings_change',
      details: { action: 'settings_change', changedFields: ['name', 'date'] },
    }))).toBe('Alice updated tournament settings (name, date)');
  });

  it('formats player_quick_add action', () => {
    expect(formatAuditAction(makeEntry({
      action: 'player_quick_add',
      details: { action: 'player_quick_add', count: 3, names: ['A', 'B', 'C'] },
    }))).toBe('Alice quick-added 3 players');
  });

  it('formats player_claim action', () => {
    expect(formatAuditAction(makeEntry({
      action: 'player_claim',
      details: { action: 'player_claim', registrationId: 'r1', placeholderName: 'John', claimedByUid: 'u3' },
    }))).toBe('Alice claimed placeholder spot "John"');
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for recent timestamps', () => {
    expect(formatRelativeTime(Date.now() - 5000)).toBe('just now');
  });

  it('returns "X min ago" for minutes', () => {
    expect(formatRelativeTime(Date.now() - 3 * 60 * 1000)).toBe('3 min ago');
  });

  it('returns "X hr ago" for hours', () => {
    expect(formatRelativeTime(Date.now() - 2 * 60 * 60 * 1000)).toBe('2 hr ago');
  });

  it('returns "X days ago" for days', () => {
    expect(formatRelativeTime(Date.now() - 3 * 24 * 60 * 60 * 1000)).toBe('3 days ago');
  });
});
