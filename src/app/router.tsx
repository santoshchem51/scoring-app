import { lazy } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import App from './App';
import RequireAuth from '../shared/components/RequireAuth';

const GameSetupPage = lazy(() => import('../features/scoring/GameSetupPage'));
const ScoringPage = lazy(() => import('../features/scoring/ScoringPage'));
const HistoryPage = lazy(() => import('../features/history/HistoryPage'));
const PlayersPage = lazy(() => import('../features/players/PlayersPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const DiscoverPage = lazy(() => import('../features/tournaments/DiscoverPage'));
const TournamentCreatePage = lazy(() => import('../features/tournaments/TournamentCreatePage'));
const TournamentDashboardPage = lazy(() => import('../features/tournaments/TournamentDashboardPage'));
const PublicTournamentPage = lazy(() => import('../features/tournaments/PublicTournamentPage'));
const LandingPage = lazy(() => import('../features/landing/LandingPage'));
const BuddiesPage = lazy(() => import('../features/buddies/BuddiesPage'));
const CreateGroupPage = lazy(() => import('../features/buddies/CreateGroupPage'));
const GroupDetailPage = lazy(() => import('../features/buddies/GroupDetailPage'));
const CreateSessionPage = lazy(() => import('../features/buddies/CreateSessionPage'));
const SessionDetailPage = lazy(() => import('../features/buddies/SessionDetailPage'));
const PublicSessionPage = lazy(() => import('../features/buddies/PublicSessionPage'));
const GroupInvitePage = lazy(() => import('../features/buddies/GroupInvitePage'));
const OpenPlayPage = lazy(() => import('../features/buddies/OpenPlayPage'));

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
      <Route path="/" component={LandingPage} />
      <Route path="/new" component={GameSetupPage} />
      <Route path="/score/:matchId" component={ScoringPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/players" component={PlayersPage} />
      <Route path="/tournaments">
        <Route path="/" component={DiscoverPage} />
        <Route path="/new" component={RequireAuth}>
          <Route path="/" component={TournamentCreatePage} />
        </Route>
        <Route path="/:id" component={RequireAuth}>
          <Route path="/" component={TournamentDashboardPage} />
        </Route>
      </Route>
      <Route path="/t/:code" component={PublicTournamentPage} />
      <Route path="/buddies" component={RequireAuth}>
        <Route path="/" component={BuddiesPage} />
        <Route path="/new" component={CreateGroupPage} />
        <Route path="/:groupId" component={GroupDetailPage} />
        <Route path="/:groupId/session/new" component={CreateSessionPage} />
      </Route>
      <Route path="/session/:sessionId" component={RequireAuth}>
        <Route path="/" component={SessionDetailPage} />
      </Route>
      <Route path="/play" component={RequireAuth}>
        <Route path="/" component={OpenPlayPage} />
      </Route>
      <Route path="/s/:code" component={PublicSessionPage} />
      <Route path="/g/:code" component={GroupInvitePage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="*" component={NotFoundPage} />
    </Router>
  );
}
