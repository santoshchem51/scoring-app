import { describe, it, expect } from 'vitest';
import { normalizeTournament, normalizeRegistration } from '../tournamentNormalizer';

describe('normalizeTournament', () => {
  it('returns new fields as-is when present', () => {
    const raw = {
      id: 't1',
      accessMode: 'approval',
      listed: false,
      buddyGroupId: null,
      buddyGroupName: null,
      registrationCounts: { confirmed: 5, pending: 2 },
      visibility: 'private',
    };
    const result = normalizeTournament(raw as any);
    expect(result.accessMode).toBe('approval');
    expect(result.listed).toBe(false);
    expect(result.registrationCounts).toEqual({ confirmed: 5, pending: 2 });
  });

  it('defaults accessMode to open when missing', () => {
    const raw = { id: 't1', visibility: 'public' };
    const result = normalizeTournament(raw as any);
    expect(result.accessMode).toBe('open');
  });

  it('infers listed=true from visibility=public when listed missing', () => {
    const raw = { id: 't1', visibility: 'public' };
    const result = normalizeTournament(raw as any);
    expect(result.listed).toBe(true);
  });

  it('infers listed=false from visibility=private when listed missing', () => {
    const raw = { id: 't1', visibility: 'private' };
    const result = normalizeTournament(raw as any);
    expect(result.listed).toBe(false);
  });

  it('defaults registrationCounts to zeros when missing', () => {
    const raw = { id: 't1' };
    const result = normalizeTournament(raw as any);
    expect(result.registrationCounts).toEqual({ confirmed: 0, pending: 0 });
  });

  it('fills missing pending field in partial registrationCounts', () => {
    const raw = { id: 't1', registrationCounts: { confirmed: 5 } };
    const result = normalizeTournament(raw as any);
    expect(result.registrationCounts).toEqual({ confirmed: 5, pending: 0 });
  });

  it('fills missing confirmed field in partial registrationCounts', () => {
    const raw = { id: 't1', registrationCounts: { pending: 3 } };
    const result = normalizeTournament(raw as any);
    expect(result.registrationCounts).toEqual({ confirmed: 0, pending: 3 });
  });

  it('defaults buddyGroupId and buddyGroupName to null when missing', () => {
    const raw = { id: 't1' };
    const result = normalizeTournament(raw as any);
    expect(result.buddyGroupId).toBeNull();
    expect(result.buddyGroupName).toBeNull();
  });

  it('handles listed explicitly set with visibility missing', () => {
    const raw = { id: 't1', listed: true };
    const result = normalizeTournament(raw as any);
    expect(result.listed).toBe(true);
  });
});

describe('normalizeRegistration', () => {
  it('returns status as-is when present', () => {
    const raw = { id: 'r1', status: 'pending' };
    const result = normalizeRegistration(raw as any);
    expect(result.status).toBe('pending');
  });

  it('defaults status to confirmed when missing', () => {
    const raw = { id: 'r1' };
    const result = normalizeRegistration(raw as any);
    expect(result.status).toBe('confirmed');
  });

  it('defaults declineReason to null when missing', () => {
    const raw = { id: 'r1' };
    const result = normalizeRegistration(raw as any);
    expect(result.declineReason).toBeNull();
  });

  it('defaults statusUpdatedAt to null when missing', () => {
    const raw = { id: 'r1' };
    const result = normalizeRegistration(raw as any);
    expect(result.statusUpdatedAt).toBeNull();
  });
});
