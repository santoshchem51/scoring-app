import { settings } from '../../stores/settingsStore';

function speak(text: string) {
  const level = settings().voiceAnnouncements;
  if (level === 'off') return;
  if (!('speechSynthesis' in window)) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.volume = 0.8;
  speechSynthesis.speak(utterance);
}

interface VoiceConfig {
  team1Name: string;
  team2Name: string;
  scoringMode: 'sideout' | 'rally';
  gameType: 'singles' | 'doubles';
  pointsToWin: number;
}

interface ScoreState {
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;
  gameNumber: number;
  gamesWon: [number, number];
}

export function useVoiceAnnouncements(config: VoiceConfig) {
  const level = () => settings().voiceAnnouncements;

  const announceScore = (state: ScoreState) => {
    if (level() === 'off') return;
    if (config.scoringMode === 'sideout' && config.gameType === 'doubles') {
      const serving = state.servingTeam === 1 ? state.team1Score : state.team2Score;
      const receiving = state.servingTeam === 1 ? state.team2Score : state.team1Score;
      speak(`${serving} ${receiving} ${state.serverNumber}`);
    } else {
      speak(`${state.team1Score} ${state.team2Score}`);
    }
  };

  const announceSideOut = () => {
    if (level() !== 'full') return;
    speak('Side out');
  };

  const announceGamePoint = (teamName: string) => {
    if (level() !== 'full') return;
    speak(`Game point, ${teamName}`);
  };

  const announceMatchPoint = (teamName: string) => {
    if (level() !== 'full') return;
    speak(`Match point, ${teamName}`);
  };

  const announceDeuce = () => {
    if (level() !== 'full') return;
    speak('Deuce');
  };

  const announceGameOver = (teamName: string, gameNumber: number, score1: number, score2: number) => {
    if (level() !== 'full') return;
    speak(`${teamName} wins game ${gameNumber}, ${score1} to ${score2}`);
  };

  const announceMatchOver = (teamName: string, gamesWon1: number, gamesWon2: number) => {
    if (level() !== 'full') return;
    speak(`${teamName} wins the match, ${gamesWon1} to ${gamesWon2}`);
  };

  const announceFirstServer = () => {
    if (level() !== 'full') return;
    speak('First server');
  };

  const announceSecondServer = () => {
    if (level() !== 'full') return;
    speak('Second server');
  };

  return {
    announceScore,
    announceSideOut,
    announceGamePoint,
    announceMatchPoint,
    announceDeuce,
    announceGameOver,
    announceMatchOver,
    announceFirstServer,
    announceSecondServer,
  };
}
