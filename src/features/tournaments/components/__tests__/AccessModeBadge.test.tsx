import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import AccessModeBadge from '../AccessModeBadge';

describe('AccessModeBadge', () => {
  it('renders nothing for open mode', () => {
    const { container } = render(() => <AccessModeBadge accessMode="open" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders "Approval Required" for approval mode', () => {
    render(() => <AccessModeBadge accessMode="approval" />);
    expect(screen.getByText('Approval Required')).toBeTruthy();
  });

  it('renders "Invite Only" for invite-only mode', () => {
    render(() => <AccessModeBadge accessMode="invite-only" />);
    expect(screen.getByText('Invite Only')).toBeTruthy();
  });

  it('renders group name for group mode', () => {
    render(() => <AccessModeBadge accessMode="group" groupName="Tuesday Crew" />);
    expect(screen.getByText('Tuesday Crew')).toBeTruthy();
  });

  it('truncates long group names at 20 chars', () => {
    render(() => <AccessModeBadge accessMode="group" groupName="Wednesday Night Warriors League" />);
    // 20 chars max: "Wednesday Night W..." (17 + "...")
    expect(screen.getByText('Wednesday Night W...')).toBeTruthy();
  });

  it('falls back to "Group" when no group name', () => {
    render(() => <AccessModeBadge accessMode="group" />);
    expect(screen.getByText('Group')).toBeTruthy();
  });

  it('has aria-label with full group name on truncated badge', () => {
    render(() => <AccessModeBadge accessMode="group" groupName="Wednesday Night Warriors League" />);
    expect(screen.getByLabelText('Group: Wednesday Night Warriors League')).toBeTruthy();
  });
});
