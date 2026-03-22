import { Show, createMemo, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { BarChart3 } from 'lucide-solid';
import { useAuth } from '../../shared/hooks/useAuth';
import { useProfileData } from './hooks/useProfileData';
import ProfileHeader from './components/ProfileHeader';
import StatsOverview from './components/StatsOverview';
import RecentMatches from './components/RecentMatches';
import EmptyState from '../../shared/components/EmptyState';
import Skeleton from '../../shared/components/Skeleton';
import PageLayout from '../../shared/components/PageLayout';
import { SyncErrorBanner } from '../../shared/components/SyncErrorBanner';
import TrophyCase from '../achievements/components/TrophyCase';
import { useAchievements } from '../achievements/hooks/useAchievements';
import { firestoreUserRepository } from '../../data/firebase/firestoreUserRepository';
import { logger } from '../../shared/observability/logger';
import { trackFeatureUsed } from '../../shared/observability/analytics';

const ProfileSkeleton: Component = () => (
  <div class="space-y-4" role="status" aria-label="Loading profile">
    {/* Header skeleton */}
    <div class="flex flex-col items-center gap-2 py-4">
      <Skeleton class="w-16 h-16 rounded-full" />
      <Skeleton class="h-6 w-32" />
      <Skeleton class="h-4 w-40" />
      <Skeleton class="h-3 w-28" />
    </div>
    {/* Stats skeleton */}
    <Skeleton class="h-24 w-full rounded-xl" />
    <div class="grid grid-cols-3 gap-3">
      <Skeleton class="h-20 rounded-xl" />
      <Skeleton class="h-20 rounded-xl" />
      <Skeleton class="h-20 rounded-xl" />
    </div>
    {/* Matches skeleton */}
    <Skeleton class="h-6 w-32" />
    <Skeleton class="h-48 w-full rounded-xl" />
  </div>
);

const ProfilePage: Component = () => {
  trackFeatureUsed('profile_viewed');
  const { user } = useAuth();
  const { data, allMatches, hasMore, loadMore, loadingMore, refetch } = useProfileData(() => user()?.uid);
  const { unlocked } = useAchievements(() => user()?.uid);

  const hasStats = createMemo(() => {
    const stats = data()?.stats;
    return !!stats && stats.totalMatches > 0;
  });

  // Profile visibility toggle
  const [visibilitySaving, setVisibilitySaving] = createSignal(false);
  const isPublic = createMemo(() => data()?.profile?.profileVisibility === 'public');

  const toggleVisibility = async () => {
    const uid = user()?.uid;
    if (!uid || visibilitySaving()) return;
    const newVisibility = isPublic() ? 'private' : 'public';
    setVisibilitySaving(true);
    try {
      await firestoreUserRepository.updateProfileVisibility(uid, newVisibility);
      await refetch();
    } catch (err) {
      logger.warn('Failed to update profile visibility', err);
    } finally {
      setVisibilitySaving(false);
    }
  };

  return (
    <PageLayout title="My Profile">
    <div class="px-4 pt-2">
      <SyncErrorBanner />
      <Show when={!data.loading} fallback={<ProfileSkeleton />}>
        {/* Header always shows (Google info available) */}
        <Show when={data()?.profile}>
          {(profile) => (
            <ProfileHeader
              displayName={profile().displayName}
              email={profile().email}
              photoURL={profile().photoURL}
              createdAt={profile().createdAt}
              tier={data()?.stats?.tier}
              tierConfidence={data()?.stats?.tierConfidence}
              hasStats={hasStats()}
            />
          )}
        </Show>

        {/* Profile Visibility Toggle */}
        <div class="bg-surface-light rounded-xl p-4 mt-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex-1">
              <p class="text-sm font-semibold text-on-surface">Public Profile</p>
              <p class="text-xs text-on-surface-muted mt-1">
                When public, your display name and match scores (including play-by-play timing) will be visible to anyone viewing a public tournament scoreboard.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic()}
              aria-label="Toggle profile visibility"
              disabled={visibilitySaving()}
              onClick={toggleVisibility}
              class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                isPublic() ? 'bg-primary' : 'bg-on-surface-muted/30'
              } ${visibilitySaving() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                class={`inline-block h-4 w-4 rounded-full bg-surface transition-transform ${
                  isPublic() ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Stats + Matches or Empty State */}
        <Show
          when={hasStats()}
          fallback={
            <EmptyState
              icon={<BarChart3 size={28} />}
              title="No matches recorded yet"
              description="Record your first match to see your stats and track progress"
              actionLabel="Start a Match"
              actionHref="/new"
            />
          }
        >
          <div class="space-y-6 mt-4">
            <StatsOverview stats={data()!.stats!} />{/* safe: hasStats() guards non-null */}
            <TrophyCase unlocked={unlocked()} stats={data()?.stats ?? null} />

            <Show when={allMatches().length > 0}>
              <RecentMatches
                matches={allMatches()}
                onLoadMore={loadMore}
                hasMore={hasMore()}
                loadingMore={loadingMore()}
              />
            </Show>
          </div>
        </Show>
      </Show>
    </div>
    </PageLayout>
  );
};

export default ProfilePage;
