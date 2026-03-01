import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import AccessModeSelector from '../AccessModeSelector';

describe('AccessModeSelector', () => {
  const defaultProps = {
    accessMode: 'open' as const,
    listed: true,
    buddyGroupId: null as string | null,
    buddyGroupName: null as string | null,
    buddyGroups: [] as Array<{ id: string; name: string }>,
    onAccessModeChange: vi.fn(),
    onListedChange: vi.fn(),
    onGroupChange: vi.fn(),
  };

  it('renders four option cards', () => {
    render(() => <AccessModeSelector {...defaultProps} />);
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByText('Approval Required')).toBeTruthy();
    expect(screen.getByText('Invite Only')).toBeTruthy();
    expect(screen.getByText('Buddy Group')).toBeTruthy();
  });

  it('marks open as selected with aria-pressed', () => {
    render(() => <AccessModeSelector {...defaultProps} accessMode="open" />);
    const openButton = screen.getByText('Open').closest('button');
    expect(openButton?.getAttribute('aria-pressed')).toBe('true');
  });

  it('does not show listed toggle for open mode', () => {
    render(() => <AccessModeSelector {...defaultProps} accessMode="open" />);
    expect(screen.queryByText('Let players find this')).toBeNull();
  });

  it('shows listed toggle for invite-only mode', () => {
    render(() => <AccessModeSelector {...defaultProps} accessMode="invite-only" />);
    expect(screen.getByText('Let players find this')).toBeTruthy();
  });

  it('shows group dropdown for group mode', () => {
    render(() => (
      <AccessModeSelector
        {...defaultProps}
        accessMode="group"
        buddyGroups={[{ id: 'g1', name: 'Tuesday Crew' }]}
      />
    ));
    expect(screen.getByLabelText('Select Group')).toBeTruthy();
  });

  it('shows inline group creation when no groups exist', () => {
    render(() => <AccessModeSelector {...defaultProps} accessMode="group" buddyGroups={[]} />);
    expect(screen.getByPlaceholderText('Name your group')).toBeTruthy();
  });
});
