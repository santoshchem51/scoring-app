import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import BuddyActionSheet from '../BuddyActionSheet';

const defaultProps = {
  open: true,
  buddyName: 'Alice',
  team1Name: 'Hawks',
  team2Name: 'Eagles',
  team1Color: '#22c55e',
  team2Color: '#f97316',
  team1Full: false,
  team2Full: false,
  currentTeam: null as 1 | 2 | null,
  onAssign: vi.fn(),
  onUnassign: vi.fn(),
  onClose: vi.fn(),
};

describe('BuddyActionSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(() => <BuddyActionSheet {...defaultProps} open={false} />);
    expect(container.querySelector('.fixed')).not.toBeInTheDocument();
  });

  it('shows buddy name and team options when open', () => {
    render(() => <BuddyActionSheet {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/Hawks/)).toBeInTheDocument();
    expect(screen.getByText(/Eagles/)).toBeInTheDocument();
  });

  it('calls onAssign with team 1 when tapped', async () => {
    const onAssign = vi.fn();
    render(() => <BuddyActionSheet {...defaultProps} onAssign={onAssign} />);
    await fireEvent.click(screen.getByText(/Hawks/));
    expect(onAssign).toHaveBeenCalledWith(1);
  });

  it('calls onAssign with team 2 when tapped', async () => {
    const onAssign = vi.fn();
    render(() => <BuddyActionSheet {...defaultProps} onAssign={onAssign} />);
    await fireEvent.click(screen.getByText(/Eagles/));
    expect(onAssign).toHaveBeenCalledWith(2);
  });

  it('shows Remove option when buddy is assigned', () => {
    render(() => <BuddyActionSheet {...defaultProps} currentTeam={1} />);
    expect(screen.getByText('Remove')).toBeInTheDocument();
  });

  it('hides Remove option when buddy is unassigned', () => {
    render(() => <BuddyActionSheet {...defaultProps} currentTeam={null} />);
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });

  it('calls onUnassign when Remove tapped', async () => {
    const onUnassign = vi.fn();
    render(() => <BuddyActionSheet {...defaultProps} currentTeam={1} onUnassign={onUnassign} />);
    await fireEvent.click(screen.getByText('Remove'));
    expect(onUnassign).toHaveBeenCalledOnce();
  });

  it('disables full team option with aria-disabled', () => {
    render(() => <BuddyActionSheet {...defaultProps} team1Full={true} />);
    const team1Btn = screen.getByText(/Hawks/).closest('button');
    expect(team1Btn?.getAttribute('aria-disabled')).toBe('true');
  });

  it('does not call onAssign when disabled team tapped', async () => {
    const onAssign = vi.fn();
    render(() => <BuddyActionSheet {...defaultProps} team1Full={true} onAssign={onAssign} />);
    await fireEvent.click(screen.getByText(/Hawks/));
    expect(onAssign).not.toHaveBeenCalled();
  });

  it('closes on backdrop tap', async () => {
    const onClose = vi.fn();
    const { container } = render(() => <BuddyActionSheet {...defaultProps} onClose={onClose} />);
    const backdrop = container.querySelector('[data-testid="sheet-backdrop"]');
    await fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
