import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import OptionCard from '../../shared/components/OptionCard';
import { matchRepository } from '../../data/repositories/matchRepository';
import type { GameType, ScoringMode, MatchFormat, Match, MatchConfig } from '../../data/types';
import { settings } from '../../stores/settingsStore';

const GameSetupPage: Component = () => {
  const navigate = useNavigate();

  const [gameType, setGameType] = createSignal<GameType>('doubles');
  const [scoringMode, setScoringMode] = createSignal<ScoringMode>(settings().defaultScoringMode);
  const [matchFormat, setMatchFormat] = createSignal<MatchFormat>(settings().defaultMatchFormat);
  const [pointsToWin, setPointsToWin] = createSignal<11 | 15 | 21>(settings().defaultPointsToWin);
  const [team1Name, setTeam1Name] = createSignal('Team 1');
  const [team2Name, setTeam2Name] = createSignal('Team 2');

  const canStart = () => team1Name().trim() !== '' && team2Name().trim() !== '';

  const startGame = async () => {
    const config: MatchConfig = {
      gameType: gameType(),
      scoringMode: scoringMode(),
      matchFormat: matchFormat(),
      pointsToWin: pointsToWin(),
    };

    const match: Match = {
      id: crypto.randomUUID(),
      config,
      team1PlayerIds: [],
      team2PlayerIds: [],
      team1Name: team1Name().trim(),
      team2Name: team2Name().trim(),
      games: [],
      winningSide: null,
      status: 'in-progress',
      startedAt: Date.now(),
      completedAt: null,
    };

    try {
      await matchRepository.save(match);
      navigate(`/score/${match.id}`);
    } catch (err) {
      console.error('Failed to save match:', err);
      alert('Failed to start game. Please try again.');
    }
  };

  return (
    <PageLayout title="New Game">
      <div class="p-4 space-y-6">
        {/* Game Type */}
        <section>
          <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Game Type</h2>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard label="Singles" description="1 vs 1" selected={gameType() === 'singles'} onClick={() => setGameType('singles')} />
            <OptionCard label="Doubles" description="2 vs 2" selected={gameType() === 'doubles'} onClick={() => setGameType('doubles')} />
          </div>
        </section>

        {/* Scoring Mode */}
        <section>
          <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Scoring</h2>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard label="Side-Out" description="Serving team scores" selected={scoringMode() === 'sideout'} onClick={() => setScoringMode('sideout')} />
            <OptionCard label="Rally" description="Point every rally" selected={scoringMode() === 'rally'} onClick={() => setScoringMode('rally')} />
          </div>
        </section>

        {/* Points to Win */}
        <section>
          <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Points to Win</h2>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="11" selected={pointsToWin() === 11} onClick={() => setPointsToWin(11)} />
            <OptionCard label="15" selected={pointsToWin() === 15} onClick={() => setPointsToWin(15)} />
            <OptionCard label="21" selected={pointsToWin() === 21} onClick={() => setPointsToWin(21)} />
          </div>
        </section>

        {/* Match Format */}
        <section>
          <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Match Format</h2>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="1 Game" selected={matchFormat() === 'single'} onClick={() => setMatchFormat('single')} />
            <OptionCard label="Best of 3" selected={matchFormat() === 'best-of-3'} onClick={() => setMatchFormat('best-of-3')} />
            <OptionCard label="Best of 5" selected={matchFormat() === 'best-of-5'} onClick={() => setMatchFormat('best-of-5')} />
          </div>
        </section>

        {/* Team Names */}
        <section>
          <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Teams</h2>
          <div class="space-y-3">
            <input
              type="text"
              value={team1Name()}
              onInput={(e) => setTeam1Name(e.currentTarget.value)}
              maxLength={30}
              class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary"
              placeholder="Team 1 name"
            />
            <input
              type="text"
              value={team2Name()}
              onInput={(e) => setTeam2Name(e.currentTarget.value)}
              maxLength={30}
              class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary"
              placeholder="Team 2 name"
            />
          </div>
        </section>

        {/* Start Button */}
        <button
          type="button"
          onClick={startGame}
          disabled={!canStart()}
          class={`w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl transition-transform ${canStart() ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
        >
          Start Game
        </button>
      </div>
    </PageLayout>
  );
};

export default GameSetupPage;
