import { Show, createSignal, createResource, createEffect, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams, useNavigate, A } from '@solidjs/router';
import { Users, MapPin, Calendar, Clock } from 'lucide-solid';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreBuddyGroupRepository } from '../../data/firebase/firestoreBuddyGroupRepository';
import type { BuddyGroupMember } from '../../data/types';

const GroupInvitePage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  let containerRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!containerRef) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      containerRef.style.opacity = '1';
      return;
    }
    containerRef.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 200, easing: 'ease-out', fill: 'forwards' },
    );
  });

  const [joining, setJoining] = createSignal(false);
  const [joinError, setJoinError] = createSignal<string | null>(null);
  const [isMember, setIsMember] = createSignal<boolean | null>(null);
  const [memberCheckDone, setMemberCheckDone] = createSignal(false);

  // Fetch group by share code
  const [group] = createResource(
    () => params.code,
    (code) => firestoreBuddyGroupRepository.getByShareCode(code),
  );

  // Check membership once group is loaded and user is available
  createEffect(async () => {
    const g = group();
    const u = user();
    if (!g || !u) {
      setIsMember(null);
      setMemberCheckDone(!authLoading());
      return;
    }

    try {
      const member = await firestoreBuddyGroupRepository.getMember(g.id, u.uid);
      setIsMember(member !== null);
    } catch {
      setIsMember(false);
    } finally {
      setMemberCheckDone(true);
    }
  });

  const handleJoin = async () => {
    const g = group();
    if (!g) return;

    const u = user();
    if (!u) {
      // Not logged in: navigate to group detail; RequireAuth will handle sign-in
      navigate(`/buddies/${g.id}`);
      return;
    }

    setJoining(true);
    setJoinError(null);

    try {
      const member: BuddyGroupMember = {
        userId: u.uid,
        displayName: u.displayName ?? 'Player',
        photoURL: u.photoURL ?? null,
        role: 'member',
        joinedAt: Date.now(),
      };
      await firestoreBuddyGroupRepository.addMember(g.id, member);
      navigate(`/buddies/${g.id}`);
    } catch (err) {
      console.error('Failed to join group:', err);
      setJoinError('Something went wrong. Please try again.');
      setJoining(false);
    }
  };

  return (
    <div ref={containerRef} style={{ opacity: '0' }} class="max-w-lg mx-auto px-4 pt-8 pb-24">
      {/* Loading state */}
      <Show when={!group.loading} fallback={
        <div class="space-y-4 animate-pulse">
          <div class="bg-surface-light rounded-2xl h-48" />
          <div class="bg-surface-light rounded-2xl h-14" />
        </div>
      }>
        {/* Not found or error state */}
        <Show when={!group.error && group()} fallback={
          <div class="text-center py-16">
            <div class="text-5xl mb-4">🔍</div>
            <h1 class="text-xl font-bold text-on-surface mb-2">Group Not Found</h1>
            <p class="text-on-surface-muted text-sm mb-6">
              This invite link is invalid or the group no longer exists.
            </p>
            <A
              href="/buddies"
              class="inline-block bg-primary text-surface px-6 py-3 rounded-xl font-semibold active:scale-95 transition-transform"
            >
              Go to Buddies
            </A>
          </div>
        }>
          {(g) => (
            <>
              {/* Group info card */}
              <div class="bg-surface-light rounded-2xl p-6">
                <div class="text-center mb-4">
                  <div class="text-4xl mb-3">🤝</div>
                  <h1 class="text-2xl font-bold text-on-surface font-display">
                    {g().name}
                  </h1>
                </div>

                <Show when={g().description}>
                  <p class="text-on-surface-muted text-sm text-center mb-4">
                    {g().description}
                  </p>
                </Show>

                {/* Group details */}
                <div class="space-y-2 text-sm text-on-surface-muted">
                  {/* Member count */}
                  <div class="flex items-center gap-2">
                    <Users size={16} class="flex-shrink-0" />
                    <span>
                      {g().memberCount} {g().memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </div>

                  {/* Default location */}
                  <Show when={g().defaultLocation}>
                    <div class="flex items-center gap-2">
                      <MapPin size={16} class="flex-shrink-0" />
                      <span>{g().defaultLocation}</span>
                    </div>
                  </Show>

                  {/* Default day */}
                  <Show when={g().defaultDay}>
                    <div class="flex items-center gap-2">
                      <Calendar size={16} class="flex-shrink-0" />
                      <span>
                        {g().defaultDay}
                        <Show when={g().defaultTime}>
                          {' '}at {g().defaultTime}
                        </Show>
                      </span>
                    </div>
                  </Show>

                  {/* Default time (only shown alone when no defaultDay) */}
                  <Show when={g().defaultTime && !g().defaultDay}>
                    <div class="flex items-center gap-2">
                      <Clock size={16} class="flex-shrink-0" />
                      <span>{g().defaultTime}</span>
                    </div>
                  </Show>
                </div>
              </div>

              {/* CTA section */}
              <div class="mt-6">
                <Show when={memberCheckDone()} fallback={
                  <div class="bg-surface-light rounded-xl h-14 animate-pulse" />
                }>
                  {/* Already a member */}
                  <Show when={isMember()} fallback={
                    <>
                      {/* Join button */}
                      <button
                        type="button"
                        onClick={handleJoin}
                        disabled={joining()}
                        class="w-full bg-primary text-surface font-bold py-4 rounded-xl text-lg active:scale-[0.98] transition-transform disabled:opacity-60"
                      >
                        <Show when={!joining()} fallback="Joining...">
                          Join Group
                        </Show>
                      </button>

                      <Show when={joinError()}>
                        <p class="text-red-400 text-sm text-center mt-2">
                          {joinError()}
                        </p>
                      </Show>

                      <Show when={!user()}>
                        <p class="text-on-surface-muted text-xs text-center mt-3">
                          You'll be asked to sign in first
                        </p>
                      </Show>
                    </>
                  }>
                    <div class="bg-surface-light rounded-2xl p-5 text-center">
                      <p class="text-on-surface font-semibold mb-1">
                        You're already in this group
                      </p>
                      <A
                        href={`/buddies/${g().id}`}
                        class="text-primary font-semibold text-sm hover:underline"
                      >
                        Go to group &rarr;
                      </A>
                    </div>
                  </Show>
                </Show>
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
};

export default GroupInvitePage;
