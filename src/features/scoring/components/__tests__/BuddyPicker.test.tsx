import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import type { BuddyGroupMember } from '../../../../data/types';

const mockLoad = vi.fn().mockResolvedValue(undefined);
const mockBuddies = vi.fn<() => BuddyGroupMember[]>().mockReturnValue([]);
const mockLoading = vi.fn().mockReturnValue(false);
const mockError = vi.fn().mockReturnValue(null);

vi.mock('../../hooks/useBuddyPickerData', () => ({
  useBuddyPickerData: () => ({
    buddies: mockBuddies,
    loading: mockLoading,
    error: mockError,
    load: mockLoad,
  }),
}));

import BuddyPicker from '../BuddyPicker';

function makeMember(userId: string, displayName: string): BuddyGroupMember {
  return { userId, displayName, photoURL: null, role: 'member', joinedAt: 1 };
}

const baseProps = {
  buddyAssignments: {} as Record<string, 1 | 2>,
  scorerRole: 'player' as const,
  scorerTeam: 1 as 1 | 2,
  scorerUid: 'scorer-uid',
  team1Name: 'Hawks',
  team2Name: 'Eagles',
  team1Color: '#22c55e',
  team2Color: '#f97316',
  gameType: 'doubles' as const,
  onAssign: vi.fn(),
  onUnassign: vi.fn(),
};

describe('BuddyPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuddies.mockReturnValue([]);
    mockLoading.mockReturnValue(false);
    mockError.mockReturnValue(null);
  });

  it('renders collapsed by default with "Add Players" text', () => {
    render(() => <BuddyPicker {...baseProps} />);
    expect(screen.getByText(/Add Players/)).toBeInTheDocument();
  });

  it('expands on tap and calls load', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    render(() => <BuddyPicker {...baseProps} />);
    await fireEvent.click(screen.getByText(/Add Players/));
    expect(mockLoad).toHaveBeenCalledOnce();
  });

  it('shows "Done" button when expanded', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    render(() => <BuddyPicker {...baseProps} />);
    await fireEvent.click(screen.getByText(/Add Players/));
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('collapses when Done is tapped', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    render(() => <BuddyPicker {...baseProps} />);
    await fireEvent.click(screen.getByText(/Add Players/));
    await fireEvent.click(screen.getByText('Done'));
    expect(screen.getByText(/Add Players/)).toBeInTheDocument();
  });

  it('shows error message on fetch failure', async () => {
    mockError.mockReturnValue('Failed to load buddies');
    render(() => <BuddyPicker {...baseProps} />);
    await fireEvent.click(screen.getByText(/Add Players/));
    expect(screen.getByText(/Connect to the internet/)).toBeInTheDocument();
  });

  it('shows empty state when no buddy groups', async () => {
    mockBuddies.mockReturnValue([]);
    render(() => <BuddyPicker {...baseProps} />);
    await fireEvent.click(screen.getByText(/Add Players/));
    expect(screen.getByText(/Create a buddy group/)).toBeInTheDocument();
  });

  it('renders buddy avatars when data loaded', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice'), makeMember('u2', 'Bob')]);
    render(() => <BuddyPicker {...baseProps} />);
    await fireEvent.click(screen.getByText(/Add Players/));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows collapsed summary with assigned player names', () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    const assignments = { 'u1': 1 as const };
    render(() => <BuddyPicker {...baseProps} buddyAssignments={assignments} />);
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Change/)).toBeInTheDocument();
  });

  it('shows capacity indicators when expanded', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    render(() => <BuddyPicker {...baseProps} />);
    await fireEvent.click(screen.getByText(/Add Players/));
    expect(screen.getAllByText(/Team 1:/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Team 2:/).length).toBeGreaterThanOrEqual(1);
  });
});
