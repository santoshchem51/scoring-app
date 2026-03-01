import { Show, createMemo } from 'solid-js';
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
  const { user } = useAuth();
  const { data, allMatches, hasMore, loadMore, loadingMore } = useProfileData(() => user()?.uid);

  const hasStats = createMemo(() => {
    const stats = data()?.stats;
    return !!stats && stats.totalMatches > 0;
  });

  return (
    <PageLayout title="My Profile">
    <div class="px-4 pt-2">
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
