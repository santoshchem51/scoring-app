import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import Podium from '../Podium';
import { makeLeaderboardEntry } from '../../../../test/factories';

describe('Podium', () => {
  it('renders top 3 entries with correct names', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u1', displayName: 'Gold' }),
      makeLeaderboardEntry({ uid: 'u2', displayName: 'Silver' }),
      makeLeaderboardEntry({ uid: 'u3', displayName: 'Bronze' }),
    ];
    render(() => <Podium entries={entries} />);
    expect(screen.getByText('Gold')).toBeTruthy();
    expect(screen.getByText('Silver')).toBeTruthy();
    expect(screen.getByText('Bronze')).toBeTruthy();
  });

  it('renders rank labels for each position', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u1', displayName: 'First' }),
      makeLeaderboardEntry({ uid: 'u2', displayName: 'Second' }),
      makeLeaderboardEntry({ uid: 'u3', displayName: 'Third' }),
    ];
    render(() => <Podium entries={entries} />);
    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
    expect(screen.getByText('#3')).toBeTruthy();
  });

  it('handles fewer than 3 entries gracefully', () => {
    const entries = [makeLeaderboardEntry({ uid: 'u1', displayName: 'Only One' })];
    render(() => <Podium entries={entries} />);
    expect(screen.getByText('Only One')).toBeTruthy();
    expect(screen.getByText('#1')).toBeTruthy();
  });

  it('handles empty entries list', () => {
    const { container } = render(() => <Podium entries={[]} />);
    // Should render the grid container but no cards
    expect(container.querySelector('.grid')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid]').length).toBe(0);
  });

  it('shows composite score for each entry', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u1', displayName: 'A', compositeScore: 85.5 }),
    ];
    const { container } = render(() => <Podium entries={entries} />);
    expect(container.textContent).toContain('85.5');
  });

  it('renders avatar initial when no photoURL', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u1', displayName: 'Zara', photoURL: null }),
    ];
    render(() => <Podium entries={entries} />);
    expect(screen.getByText('Z')).toBeTruthy();
  });

  it('renders avatar image when photoURL provided', () => {
    const entries = [
      makeLeaderboardEntry({
        uid: 'u1',
        displayName: 'Alice',
        photoURL: 'https://example.com/alice.jpg',
      }),
    ];
    const { container } = render(() => <Podium entries={entries} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe('https://example.com/alice.jpg');
  });

  it('renders tier badge for each entry', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u1', displayName: 'Pro', tier: 'expert', tierConfidence: 'high' }),
    ];
    render(() => <Podium entries={entries} />);
    expect(screen.getByText('expert')).toBeTruthy();
  });

  it('applies scale-105 only to first place', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u1', displayName: 'First' }),
      makeLeaderboardEntry({ uid: 'u2', displayName: 'Second' }),
      makeLeaderboardEntry({ uid: 'u3', displayName: 'Third' }),
    ];
    const { container } = render(() => <Podium entries={entries} />);
    const cards = container.querySelectorAll('.rounded-xl');
    expect(cards[0].className).toContain('scale-105');
    expect(cards[1].className).not.toContain('scale-105');
    expect(cards[2].className).not.toContain('scale-105');
  });
});
