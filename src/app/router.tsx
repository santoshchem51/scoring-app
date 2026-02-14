import { lazy } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import App from './App';

const GameSetupPage = lazy(() => import('../features/scoring/GameSetupPage'));
const ScoringPage = lazy(() => import('../features/scoring/ScoringPage'));
const HistoryPage = lazy(() => import('../features/history/HistoryPage'));
const PlayersPage = lazy(() => import('../features/players/PlayersPage'));

export default function AppRouter() {
  return (
    <Router root={App}>
      <Route path="/" component={GameSetupPage} />
      <Route path="/score/:matchId" component={ScoringPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/players" component={PlayersPage} />
    </Router>
  );
}
