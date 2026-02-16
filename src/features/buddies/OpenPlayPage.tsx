import { Show, For, createSignal, createEffect, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../data/firebase/config';
import { getSessionDisplayStatus } from './engine/sessionHelpers';
import type { GameSession } from '../../data/types';

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

function OpenSessionCard(props: { session: GameSession }) {
  return (
    <A
      href={`/buddies/session/${props.session.id}`}
      class="block bg-surface-light rounded-2xl p-4 active:scale-[0.98] transition-transform"
    >
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-on-surface text-lg">{props.session.title}</h3>
        <span class="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {getSessionDisplayStatus(props.session)}
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-3 mt-2 text-sm text-on-surface-muted">
        {/* Date */}
        <span class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatSessionDate(props.session.scheduledDate)}
        </span>

        {/* Location */}
        <Show when={props.session.location}>
          <span class="flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {props.session.location}
          </span>
        </Show>

        {/* Spots */}
        <span class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {props.session.spotsConfirmed}/{props.session.spotsTotal} confirmed
        </span>
      </div>

      <div class="mt-3 text-right">
        <span class="inline-block bg-primary text-surface text-sm font-semibold px-4 py-1.5 rounded-xl">
          Join
        </span>
      </div>
    </A>
  );
}

const OpenPlayPage: Component = () => {
  const [sessions, setSessions] = createSignal<GameSession[]>([]);
  const [loading, setLoading] = createSignal(true);

  let unsubscribe: (() => void) | null = null;

  createEffect(() => {
    setLoading(true);

    const q = query(
      collection(firestore, 'gameSessions'),
      where('visibility', '==', 'open'),
      where('status', 'in', ['proposed', 'confirmed']),
      orderBy('scheduledDate', 'asc'),
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as GameSession));
      setLoading(false);
    });
  });

  onCleanup(() => unsubscribe?.());

  return (
    <div class="max-w-lg mx-auto px-4 pt-4 pb-24">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-on-surface font-display">Open Play</h1>
        <button
          type="button"
          onClick={() => alert('Standalone open sessions are coming soon! For now, create a session within a group and set visibility to "open".')}
          class="bg-primary text-surface px-4 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
        >
          + Create Open Session
        </button>
      </div>

      <Show when={!loading()} fallback={
        <div class="space-y-3">
          <For each={[1, 2, 3]}>
            {() => <div class="bg-surface-light rounded-2xl h-28 animate-pulse" />}
          </For>
        </div>
      }>
        <Show when={sessions().length > 0} fallback={
          <div class="text-center py-16">
            <div class="text-5xl mb-4">&#127934;</div>
            <h2 class="text-lg font-bold text-on-surface mb-2">No open games right now</h2>
            <p class="text-on-surface-muted text-sm mb-6">
              Check back later or create a session in your group and set it to open
            </p>
            <A
              href="/buddies"
              class="inline-block bg-primary text-surface px-6 py-3 rounded-xl font-semibold active:scale-95 transition-transform"
            >
              Back to Buddies
            </A>
          </div>
        }>
          <div class="space-y-3">
            <For each={sessions()}>
              {(session) => <OpenSessionCard session={session} />}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default OpenPlayPage;
