import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import UserRankCard from '../UserRankCard';
import { makeLeaderboardEntry } from '../../../../test/factories';

describe('UserRankCard', () => {
  it('renders rank and score when entry exists', () => {
    const entry = makeLeaderboardEntry({
      uid: 'me',
      displayName: 'MyName',
      compositeScore: 78.5,
      tier: 'intermediate',
    });
    render(() => <UserRankCard entry={entry} rank={12} totalMatches={10} />);
    expect(screen.getByText('#12')).toBeTruthy();
    expect(screen.getByText('MyName')).toBeTruthy();
    expect(screen.getByText('78.5')).toBeTruthy();
  });

  it('renders tier badge when entry exists', () => {
    const entry = makeLeaderboardEntry({
      uid: 'me',
      displayName: 'Pro',
      tier: 'expert',
      tierConfidence: 'high',
    });
    render(() => <UserRankCard entry={entry} rank={1} totalMatches={20} />);
    expect(screen.getByText('expert')).toBeTruthy();
  });

  it('shows qualification message when totalMatches < 5', () => {
    render(() => <UserRankCard entry={null} rank={null} totalMatches={2} />);
    expect(screen.getByText(/Play 3 more matches to qualify/)).toBeTruthy();
  });

  it('shows qualification message for zero matches', () => {
    render(() => <UserRankCard entry={null} rank={null} totalMatches={0} />);
    expect(screen.getByText(/Play 5 more matches to qualify/)).toBeTruthy();
  });

  it('shows no-ranking message when entry is null and totalMatches >= 5', () => {
    render(() => <UserRankCard entry={null} rank={null} totalMatches={10} />);
    expect(screen.getByText(/No ranking yet/)).toBeTruthy();
  });

  it('renders avatar with initial when no photoURL', () => {
    const entry = makeLeaderboardEntry({
      uid: 'me',
      displayName: 'Kara',
      photoURL: null,
    });
    render(() => <UserRankCard entry={entry} rank={5} totalMatches={15} />);
    expect(screen.getByText('K')).toBeTruthy();
  });

  it('renders avatar image when photoURL provided', () => {
    const entry = makeLeaderboardEntry({
      uid: 'me',
      displayName: 'Kara',
      photoURL: 'https://example.com/kara.jpg',
    });
    const { container } = render(() => <UserRankCard entry={entry} rank={5} totalMatches={15} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe('https://example.com/kara.jpg');
  });

  it('shows "Your Ranking" label', () => {
    const entry = makeLeaderboardEntry({ uid: 'me', displayName: 'Me' });
    render(() => <UserRankCard entry={entry} rank={8} totalMatches={12} />);
    expect(screen.getByText('Your Ranking')).toBeTruthy();
  });
});
