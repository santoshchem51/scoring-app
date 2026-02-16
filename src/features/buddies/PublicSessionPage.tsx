import { Show, For, createResource, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { firestoreGameSessionRepository } from '../../data/firebase/firestoreGameSessionRepository';
import { getSessionDisplayStatus } from './engine/sessionHelpers';
import type { GameSession, SessionRsvp } from '../../data/types';

// --- Helper functions ---

function formatSessionDate(session: GameSession): string {
  const confirmed = session.confirmedSlot;
  const dateVal = confirmed ? confirmed.date : session.scheduledDate;
  if (!dateVal) return 'Date TBD';
  const d = new Date(dateVal);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatSessionTime(session: GameSession): string {
  const confirmed = session.confirmedSlot;
  if (confirmed) return `${confirmed.startTime} - ${confirmed.endTime}`;
  if (session.scheduledDate) {
    const d = new Date(session.scheduledDate);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return 'Time TBD';
}

function rsvpResponseLabel(rsvp: SessionRsvp): string {
  if (rsvp.response === 'in') return 'In';
  if (rsvp.response === 'maybe') return 'Maybe';
  return 'Out';
}

function rsvpResponseColor(rsvp: SessionRsvp): string {
  if (rsvp.response === 'in') return 'text-emerald-400';
  if (rsvp.response === 'maybe') return 'text-amber-400';
  return 'text-gray-400';
}

// --- Sub-components ---

function PublicSpotsTracker(props: { confirmed: number; total: number }) {
  const percentage = createMemo(() =>
    props.total > 0 ? Math.min(100, Math.round((props.confirmed / props.total) * 100)) : 0,
  );

  return (
    <div class="bg-surface-light rounded-2xl p-5">
      <div class="flex items-center justify-between mb-3">
        <span class="text-on-surface-muted text-sm font-medium">Spots</span>
        <span class="text-on-surface font-bold text-lg">
          {props.confirmed} of {props.total} confirmed
        </span>
      </div>
      <div class="w-full h-3 bg-surface-lighter rounded-full overflow-hidden">
        <div
          class="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${percentage()}%` }}
        />
      </div>
    </div>
  );
}

function PublicPlayerList(props: { rsvps: SessionRsvp[] }) {
  const confirmedPlayers = createMemo(() =>
    props.rsvps.filter((r) => r.response === 'in'),
  );
  const otherPlayers = createMemo(() =>
    props.rsvps.filter((r) => r.response !== 'in'),
  );

  return (
    <div class="space-y-2">
      <For each={confirmedPlayers()}>
        {(rsvp) => (
          <div class="flex items-center gap-3 py-2">
            <svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="text-on-surface text-sm font-medium">{rsvp.displayName}</span>
            <span class={`ml-auto text-xs font-semibold ${rsvpResponseColor(rsvp)}`}>
              {rsvpResponseLabel(rsvp)}
            </span>
          </div>
        )}
      </For>
      <For each={otherPlayers()}>
        {(rsvp) => (
          <div class="flex items-center gap-3 py-2">
            <Show when={rsvp.response === 'maybe'} fallback={
              <svg class="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            }>
              <svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Show>
            <span class="text-on-surface-muted text-sm">{rsvp.displayName}</span>
            <span class={`ml-auto text-xs font-semibold ${rsvpResponseColor(rsvp)}`}>
              {rsvpResponseLabel(rsvp)}
            </span>
          </div>
        )}
      </For>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div class="space-y-5">
      <div class="bg-surface-light rounded-2xl h-40 animate-pulse" />
      <div class="bg-surface-light rounded-2xl h-20 animate-pulse" />
      <div class="bg-surface-light rounded-2xl h-32 animate-pulse" />
      <div class="bg-surface-light rounded-2xl h-14 animate-pulse" />
    </div>
  );
}

function NotFoundState() {
  return (
    <div class="text-center py-16">
      <div class="text-5xl mb-4">🔍</div>
      <h2 class="text-xl font-bold text-on-surface mb-2">Session Not Found</h2>
      <p class="text-on-surface-muted text-sm mb-6">
        This session may have been deleted, cancelled, or the link is invalid.
      </p>
      <a
        href="/"
        class="inline-block bg-primary text-surface px-6 py-3 rounded-xl font-semibold active:scale-95 transition-transform"
      >
        Back to Home
      </a>
    </div>
  );
}

// --- Main page component ---

const PublicSessionPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();

  // Step 1: Resolve share code to session
  const [session] = createResource(
    () => params.code,
    (code) => firestoreGameSessionRepository.getByShareCode(code),
  );

  // Step 2: Load RSVPs once session is resolved
  const [rsvps] = createResource(
    () => session()?.id,
    (sessionId) => firestoreGameSessionRepository.getRsvps(sessionId),
  );

  const formattedDate = createMemo(() => {
    const s = session();
    if (!s) return '';
    return formatSessionDate(s);
  });

  const formattedTime = createMemo(() => {
    const s = session();
    if (!s) return '';
    return formatSessionTime(s);
  });

  const displayStatus = createMemo(() => {
    const s = session();
    if (!s) return '';
    return getSessionDisplayStatus(s);
  });

  const statusBadgeClass = createMemo(() => {
    const s = session();
    if (!s) return 'bg-primary/20 text-primary';
    if (s.status === 'cancelled') return 'bg-red-500/20 text-red-400';
    if (s.status === 'completed') return 'bg-gray-500/20 text-gray-400';
    if (s.status === 'confirmed') return 'bg-emerald-500/20 text-emerald-400';
    return 'bg-primary/20 text-primary';
  });

  const rsvpList = createMemo(() => rsvps() ?? []);

  const handleJoin = () => {
    const s = session();
    if (!s) return;
    navigate(`/session/${s.id}`);
  };

  return (
    <div class="max-w-lg mx-auto px-4 pt-8 pb-24">
      {/* Loading state */}
      <Show when={!session.loading} fallback={<LoadingSkeleton />}>
        {/* Not found state */}
        <Show when={session()} fallback={<NotFoundState />}>
          {(s) => (
            <div class="space-y-5">
              {/* Session header card */}
              <div class="bg-surface-light rounded-2xl p-6">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <h1 class="text-2xl font-bold text-on-surface">{s().title}</h1>
                  </div>
                  <span class={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadgeClass()}`}>
                    {displayStatus()}
                  </span>
                </div>

                <div class="mt-4 space-y-2">
                  {/* Date */}
                  <div class="flex items-center gap-2 text-on-surface-muted text-sm">
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formattedDate()}</span>
                  </div>

                  {/* Time */}
                  <div class="flex items-center gap-2 text-on-surface-muted text-sm">
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formattedTime()}</span>
                  </div>

                  {/* Location */}
                  <div class="flex items-center gap-2 text-on-surface-muted text-sm">
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{s().location}</span>
                  </div>

                  {/* Courts */}
                  <Show when={s().courtsAvailable > 0}>
                    <div class="flex items-center gap-2 text-on-surface-muted text-sm">
                      <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      <span>{s().courtsAvailable} court{s().courtsAvailable > 1 ? 's' : ''} available</span>
                    </div>
                  </Show>
                </div>
              </div>

              {/* Spots tracker */}
              <PublicSpotsTracker confirmed={s().spotsConfirmed} total={s().spotsTotal} />

              {/* Who's playing */}
              <div class="bg-surface-light rounded-2xl p-5">
                <h2 class="text-on-surface font-bold text-sm mb-3">
                  Who's Playing ({rsvpList().length})
                </h2>
                <Show when={rsvpList().length > 0} fallback={
                  <p class="text-on-surface-muted text-sm text-center py-3">No RSVPs yet — be the first!</p>
                }>
                  <PublicPlayerList rsvps={rsvpList()} />
                </Show>
              </div>

              {/* CTA Button */}
              <Show when={s().status !== 'cancelled' && s().status !== 'completed'}>
                <button
                  class="w-full bg-primary text-surface font-bold py-4 rounded-xl text-lg active:scale-[0.98] transition-transform"
                  onClick={handleJoin}
                >
                  Join on PickleScore
                </button>
              </Show>

              {/* Cancelled / Completed info */}
              <Show when={s().status === 'cancelled'}>
                <div class="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">
                  <p class="text-red-400 font-semibold">This session has been cancelled</p>
                </div>
              </Show>
              <Show when={s().status === 'completed'}>
                <div class="bg-gray-500/10 border border-gray-500/20 rounded-xl px-4 py-3 text-center">
                  <p class="text-gray-400 font-semibold">This session has already been played</p>
                </div>
              </Show>
            </div>
          )}
        </Show>
      </Show>
    </div>
  );
};

export default PublicSessionPage;
