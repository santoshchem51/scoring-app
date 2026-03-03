import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import BuddyAvatar from '../BuddyAvatar';

describe('BuddyAvatar', () => {
  it('renders display name initial when no photo', () => {
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={null} teamColor="#22c55e" onClick={vi.fn()} />
    ));
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders photo when photoURL provided', () => {
    const { container } = render(() => (
      <BuddyAvatar displayName="Alice" photoURL="https://example.com/photo.jpg" team={null} teamColor="#22c55e" onClick={vi.fn()} />
    ));
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute('src')).toBe('https://example.com/photo.jpg');
  });

  it('shows team badge when assigned to team 1', () => {
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={1} teamColor="#22c55e" onClick={vi.fn()} />
    ));
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('shows team badge when assigned to team 2', () => {
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={2} teamColor="#f97316" onClick={vi.fn()} />
    ));
    expect(screen.getByText('T2')).toBeInTheDocument();
  });

  it('shows no badge when unassigned', () => {
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={null} teamColor="#22c55e" onClick={vi.fn()} />
    ));
    expect(screen.queryByText('T1')).not.toBeInTheDocument();
    expect(screen.queryByText('T2')).not.toBeInTheDocument();
  });

  it('calls onClick when tapped', async () => {
    const onClick = vi.fn();
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={null} teamColor="#22c55e" onClick={onClick} />
    ));
    await fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows truncated name below avatar', () => {
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={null} teamColor="#22c55e" onClick={vi.fn()} />
    ));
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={1} teamColor="#22c55e" onClick={vi.fn()} />
    ));
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('Alice');
    expect(btn.getAttribute('aria-label')).toContain('Team 1');
  });
});
