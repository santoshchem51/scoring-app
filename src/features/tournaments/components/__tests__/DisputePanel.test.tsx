import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import DisputePanel from '../DisputePanel';
import type { MatchDispute } from '../../engine/disputeTypes';

const makeDispute = (overrides: Partial<MatchDispute> = {}): MatchDispute => ({
  id: 'd1', matchId: 'm1', tournamentId: 't1',
  flaggedBy: 'u1', flaggedByName: 'Alice', reason: 'Wrong score',
  status: 'open', resolvedBy: null, resolvedByName: null,
  resolution: null, createdAt: Date.now(), resolvedAt: null,
  ...overrides,
});

describe('DisputePanel', () => {
  it('renders a list of open disputes', () => {
    const disputes = [
      makeDispute({ id: 'd1', flaggedByName: 'Alice', reason: 'Wrong score' }),
      makeDispute({ id: 'd2', flaggedByName: 'Bob', reason: 'Missing game' }),
    ];
    render(() => <DisputePanel disputes={disputes} canResolve={true} onResolve={vi.fn()} />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Wrong score')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Missing game')).toBeTruthy();
  });

  it('shows resolve buttons when canResolve is true', () => {
    render(() => <DisputePanel disputes={[makeDispute()]} canResolve={true} onResolve={vi.fn()} />);
    expect(screen.getByText('Dismiss')).toBeTruthy();
    expect(screen.getByText('Edit Scores')).toBeTruthy();
  });

  it('hides resolve buttons when canResolve is false', () => {
    render(() => <DisputePanel disputes={[makeDispute()]} canResolve={false} onResolve={vi.fn()} />);
    expect(screen.queryByText('Dismiss')).toBeNull();
    expect(screen.queryByText('Edit Scores')).toBeNull();
  });

  it('renders empty state', () => {
    render(() => <DisputePanel disputes={[]} canResolve={true} onResolve={vi.fn()} />);
    expect(screen.getByText('No open disputes')).toBeTruthy();
  });
});
