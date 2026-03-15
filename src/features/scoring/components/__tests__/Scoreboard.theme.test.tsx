import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import Scoreboard from '../Scoreboard';

describe('Scoreboard theme states', () => {
  const baseProps = {
    team1Name: 'Team A',
    team2Name: 'Team B',
    team1Score: 5,
    team2Score: 3,
    servingTeam: 1 as const,
    serverNumber: 1 as const,
    scoringMode: 'sideout' as const,
    gameType: 'doubles' as const,
    pointsToWin: 11,
    team1Color: '#4ECDC4',
    team2Color: '#E8725A',
  };

  it('applies .serving class on the serving team panel', () => {
    const { container } = render(() => <Scoreboard {...baseProps} servingTeam={1} />);
    const panels = container.querySelectorAll('.score-panel');
    expect(panels[0].classList.contains('serving')).toBe(true);
    expect(panels[1].classList.contains('serving')).toBe(false);
  });

  it('applies .game-point class when team is at game point', () => {
    const { container } = render(() => (
      <Scoreboard {...baseProps} team1Score={10} team2Score={5} servingTeam={2} />
    ));
    const panels = container.querySelectorAll('.score-panel');
    expect(panels[0].classList.contains('game-point')).toBe(true);
  });

  it('renders net divider with aria-hidden', () => {
    const { container } = render(() => <Scoreboard {...baseProps} />);
    const netDivider = container.querySelector('.net-diamond');
    expect(netDivider).toBeTruthy();
    const wrapper = netDivider!.parentElement;
    expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
  });
});
