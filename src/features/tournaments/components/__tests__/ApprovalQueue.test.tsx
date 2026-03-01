import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import ApprovalQueue from '../ApprovalQueue';
import type { TournamentRegistration } from '../../../../data/types';

function makePendingReg(userId: string, name: string, daysAgo: number): TournamentRegistration {
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
    registeredAt: Date.now() - daysAgo * 86400000,
    status: 'pending',
    declineReason: null,
    statusUpdatedAt: null,
  };
}

describe('ApprovalQueue', () => {
  const defaultProps = {
    tournamentId: 't1',
    pendingRegistrations: [
      makePendingReg('u1', 'Alice', 1),
      makePendingReg('u2', 'Bob', 3),
    ],
    onApprove: vi.fn(),
    onDecline: vi.fn(),
    onApproveAll: vi.fn(),
    onDeclineAll: vi.fn(),
  };

  it('renders pending count header', () => {
    render(() => <ApprovalQueue {...defaultProps} />);
    expect(screen.getByText('Pending Requests (2)')).toBeTruthy();
  });

  it('renders player names', () => {
    render(() => <ApprovalQueue {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('renders approve buttons', () => {
    render(() => <ApprovalQueue {...defaultProps} />);
    const approveButtons = screen.getAllByText('Approve');
    expect(approveButtons).toHaveLength(2);
  });

  it('shows Approve All and Decline All when 5+ pending', () => {
    const manyRegs = Array.from({ length: 6 }, (_, i) =>
      makePendingReg(`u${i}`, `Player ${i}`, i),
    );
    render(() => <ApprovalQueue {...defaultProps} pendingRegistrations={manyRegs} />);
    expect(screen.getByText('Approve All')).toBeTruthy();
    expect(screen.getByText('Decline All')).toBeTruthy();
  });

  it('renders nothing when no pending registrations', () => {
    const { container } = render(() => <ApprovalQueue {...defaultProps} pendingRegistrations={[]} />);
    expect(container.textContent).toBe('');
  });
});
