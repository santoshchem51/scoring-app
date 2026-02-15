import { lazy } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import App from './App';
import RequireAuth from '../shared/components/RequireAuth';

const GameSetupPage = lazy(() => import('../features/scoring/GameSetupPage'));
const ScoringPage = lazy(() => import('../features/scoring/ScoringPage'));
const HistoryPage = lazy(() => import('../features/history/HistoryPage'));
const PlayersPage = lazy(() => import('../features/players/PlayersPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const TournamentListPage = lazy(() => import('../features/tournaments/TournamentListPage'));
const TournamentCreatePage = lazy(() => import('../features/tournaments/TournamentCreatePage'));
const TournamentDashboardPage = lazy(() => import('../features/tournaments/TournamentDashboardPage'));

function NotFoundPage() {
  return (
    <div class="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
      <p class="text-2xl font-bold text-on-surface">Page Not Found</p>
      <p class="text-on-surface-muted">The page you're looking for doesn't exist.</p>
      <a href="/" class="inline-block px-6 py-3 bg-primary text-surface font-semibold rounded-xl active:scale-95 transition-transform">Back to Home</a>
    </div>
  );
}

export default function AppRouter() {
  return (
    <Router root={App}>
      <Route path="/" component={GameSetupPage} />
      <Route path="/score/:matchId" component={ScoringPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/players" component={PlayersPage} />
      <Route path="/tournaments" component={RequireAuth}>
        <Route path="/" component={TournamentListPage} />
        <Route path="/new" component={TournamentCreatePage} />
        <Route path="/:id" component={TournamentDashboardPage} />
      </Route>
      <Route path="/settings" component={SettingsPage} />
      <Route path="*" component={NotFoundPage} />
    </Router>
  );
}
