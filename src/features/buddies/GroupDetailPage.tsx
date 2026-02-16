import { Show, For, createSignal, createEffect, createResource, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { A, useParams } from '@solidjs/router';
import { Calendar, MapPin, Users, Share2, ChevronRight, Plus } from 'lucide-solid';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../data/firebase/config';
import { firestoreBuddyGroupRepository } from '../../data/firebase/firestoreBuddyGroupRepository';
import PageLayout from '../../shared/components/PageLayout';
import type { BuddyGroup, BuddyGroupMember, GameSession } from '../../data/types';

function formatSessionDate(timestamp: number | null): string {
  if (!timestamp) return 'TBD';
  return new Date(timestamp).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function MemberAvatar(props: { member: BuddyGroupMember }) {
  const initial = () => (props.member.displayName?.[0] ?? '?').toUpperCase();

  return (
    <div class="flex flex-col items-center gap-1 min-w-[3.5rem]">
      <div class="relative">
        <Show
          when={props.member.photoURL}
          fallback={
            <div class="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">
              {initial()}
            </div>
          }
        >
          <img
            src={props.member.photoURL!}
            alt={props.member.displayName}
            class="w-10 h-10 rounded-full object-cover"
          />
        </Show>
        <Show when={props.member.role === 'admin'}>
          <span class="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[8px] font-bold px-1 rounded-full leading-tight">
            Admin
          </span>
        </Show>
      </div>
      <span class="text-xs text-on-surface-muted truncate max-w-[3.5rem] text-center">
        {props.member.displayName.split(' ')[0]}
      </span>
    </div>
  );
}

function SessionCard(props: { session: GameSession; showRsvp?: boolean }) {
  return (
    <A
      href={`/session/${props.session.id}`}
      class="block bg-surface-light rounded-2xl p-4 active:scale-[0.98] transition-transform"
    >
      <div class="flex items-center justify-between">
        <h4 class="font-bold text-on-surface">{props.session.title}</h4>
        <span class="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {props.session.spotsConfirmed}/{props.session.spotsTotal}
        </span>
      </div>

      <div class="flex items-center gap-3 mt-2 text-sm text-on-surface-muted">
        {/* Date */}
        <span class="flex items-center gap-1">
          <Calendar size={14} />
          {formatSessionDate(props.session.scheduledDate)}
        </span>

        {/* Location */}
        <Show when={props.session.location}>
          <span class="flex items-center gap-1">
            <MapPin size={14} />
            {props.session.location}
          </span>
        </Show>
      </div>

      <Show when={props.session.status === 'cancelled'}>
        <span class="inline-block mt-2 text-xs font-semibold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
          Cancelled
        </span>
      </Show>
    </A>
  );
}

const GroupDetailPage: Component = () => {
  const params = useParams();

  // Group data
  const [group] = createResource(
    () => params.groupId,
    (groupId) => firestoreBuddyGroupRepository.get(groupId),
  );

  // Members (live via onSnapshot)
  const [members, setMembers] = createSignal<BuddyGroupMember[]>([]);
  const [membersLoading, setMembersLoading] = createSignal(true);

  // Sessions (live via onSnapshot)
  const [sessions, setSessions] = createSignal<GameSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = createSignal(true);

  // Past sessions collapsed by default
  const [showPast, setShowPast] = createSignal(false);

  // Clipboard feedback
  const [copied, setCopied] = createSignal(false);

  const unsubs: (() => void)[] = [];

  createEffect(() => {
    const gid = params.groupId;
    if (!gid) return;

    // Clean up previous listeners
    unsubs.forEach((u) => u());
    unsubs.length = 0;

    // Listen to members sub-collection
    setMembersLoading(true);
    unsubs.push(
      onSnapshot(collection(firestore, 'buddyGroups', gid, 'members'), (snap) => {
        setMembers(snap.docs.map((d) => d.data() as BuddyGroupMember));
        setMembersLoading(false);
      }),
    );

    // Listen to sessions for this group
    setSessionsLoading(true);
    const sessionsQuery = query(
      collection(firestore, 'gameSessions'),
      where('groupId', '==', gid),
      orderBy('scheduledDate', 'asc'),
    );
    unsubs.push(
      onSnapshot(sessionsQuery, (snap) => {
        setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GameSession));
        setSessionsLoading(false);
      }),
    );
  });

  onCleanup(() => unsubs.forEach((u) => u()));

  // Derived: split sessions into upcoming vs past
  const upcomingSessions = () =>
    sessions().filter((s) => s.status === 'proposed' || s.status === 'confirmed');

  const pastSessions = () =>
    sessions().filter((s) => s.status === 'completed' || s.status === 'cancelled');

  // Share handler
  const handleShare = async () => {
    const g = group();
    if (!g?.shareCode) return;

    const url = `${window.location.origin}/g/${g.shareCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select-and-copy not possible, just ignore
    }
  };

  return (
    <PageLayout title={group()?.name ?? 'Group'}>
      <div class="p-4 pb-24 space-y-6">
        <Show when={!group.loading} fallback={
          <div class="space-y-3">
            <div class="bg-surface-light rounded-2xl h-24 animate-pulse" />
            <div class="bg-surface-light rounded-2xl h-16 animate-pulse" />
          </div>
        }>
          <Show when={group()} fallback={
            <div class="text-center py-16">
              <p class="text-on-surface-muted">Group not found.</p>
            </div>
          }>
            {(g) => (
              <>
                {/* Header */}
                <div class="bg-surface-light rounded-2xl p-4">
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <h1 class="text-xl font-bold text-on-surface font-display">{g().name}</h1>
                      <Show when={g().description}>
                        <p class="text-on-surface-muted text-sm mt-1">{g().description}</p>
                      </Show>
                      <div class="flex items-center gap-3 mt-2 text-sm text-on-surface-muted">
                        <span class="flex items-center gap-1">
                          <Users size={16} />
                          {g().memberCount} {g().memberCount === 1 ? 'member' : 'members'}
                        </span>
                        <Show when={g().defaultLocation}>
                          <span class="flex items-center gap-1">
                            <MapPin size={14} />
                            {g().defaultLocation}
                          </span>
                        </Show>
                      </div>
                    </div>

                    {/* Share button */}
                    <Show when={g().shareCode}>
                      <button
                        type="button"
                        onClick={handleShare}
                        class="ml-3 flex-shrink-0 p-2 rounded-lg bg-primary/10 text-primary active:scale-95 transition-transform"
                        title="Copy share link"
                      >
                        <Show
                          when={!copied()}
                          fallback={
                            <span class="text-xs font-semibold px-1">Copied!</span>
                          }
                        >
                          <Share2 size={20} />
                        </Show>
                      </button>
                    </Show>
                  </div>
                </div>

                {/* Members Section */}
                <div>
                  <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
                    Members
                  </h2>
                  <Show when={!membersLoading()} fallback={
                    <div class="flex gap-3">
                      <For each={[1, 2, 3]}>
                        {() => <div class="w-10 h-10 rounded-full bg-surface-light animate-pulse" />}
                      </For>
                    </div>
                  }>
                    <Show when={members().length > 0} fallback={
                      <p class="text-on-surface-muted text-sm">No members yet.</p>
                    }>
                      <div class="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                        <For each={members()}>
                          {(member) => <MemberAvatar member={member} />}
                        </For>
                      </div>
                    </Show>
                  </Show>
                </div>

                {/* Upcoming Sessions */}
                <div>
                  <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
                    Upcoming Sessions
                  </h2>
                  <Show when={!sessionsLoading()} fallback={
                    <div class="space-y-3">
                      <For each={[1, 2]}>
                        {() => <div class="bg-surface-light rounded-2xl h-20 animate-pulse" />}
                      </For>
                    </div>
                  }>
                    <Show when={upcomingSessions().length > 0} fallback={
                      <div class="bg-surface-light rounded-2xl p-6 text-center">
                        <p class="text-on-surface-muted text-sm">No upcoming sessions</p>
                        <p class="text-on-surface-muted text-xs mt-1">Tap + to create one</p>
                      </div>
                    }>
                      <div class="space-y-3">
                        <For each={upcomingSessions()}>
                          {(session) => <SessionCard session={session} showRsvp />}
                        </For>
                      </div>
                    </Show>
                  </Show>
                </div>

                {/* Past Sessions (collapsed) */}
                <Show when={pastSessions().length > 0}>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPast(!showPast())}
                      class="flex items-center gap-2 text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3 w-full"
                    >
                      <ChevronRight size={16} class={`transition-transform ${showPast() ? 'rotate-90' : ''}`} />
                      Past Sessions ({pastSessions().length})
                    </button>
                    <Show when={showPast()}>
                      <div class="space-y-3">
                        <For each={pastSessions()}>
                          {(session) => <SessionCard session={session} />}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>
              </>
            )}
          </Show>
        </Show>
      </div>

      {/* FAB: New Session */}
      <Show when={group()}>
        <A
          href={`/buddies/${params.groupId}/session/new`}
          class="fixed bottom-20 right-4 bg-primary text-surface rounded-full w-14 h-14 shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10"
          title="New Session"
        >
          <Plus size={28} />
        </A>
      </Show>
    </PageLayout>
  );
};

export default GroupDetailPage;
