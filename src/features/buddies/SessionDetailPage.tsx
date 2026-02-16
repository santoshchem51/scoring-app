import { Show, For, createSignal, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import { useAuth } from '../../shared/hooks/useAuth';
import { useGameSession } from './hooks/useGameSession';
import { firestoreGameSessionRepository } from '../../data/firebase/firestoreGameSessionRepository';
import { canRsvp, canUpdateDayOfStatus, getSessionDisplayStatus } from './engine/sessionHelpers';
import type { SessionRsvp, RsvpResponse, DayOfStatus, TimeSlot } from '../../data/types';

// --- Sub-components ---

function SpotsTracker(props: { confirmed: number; total: number }) {
  const percentage = createMemo(() =>
    props.total > 0 ? Math.min(100, Math.round((props.confirmed / props.total) * 100)) : 0,
  );

  return (
    <div class="bg-surface-light rounded-xl p-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-on-surface-muted text-sm font-medium">Spots</span>
        <span class="text-on-surface font-bold">
          {props.confirmed} of {props.total} confirmed
        </span>
      </div>
      <div class="w-full h-2.5 bg-surface-lighter rounded-full overflow-hidden">
        <div
          class="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${percentage()}%` }}
        />
      </div>
    </div>
  );
}

function RsvpButtons(props: {
  currentResponse: RsvpResponse | undefined;
  disabled: boolean;
  onSelect: (response: RsvpResponse) => void;
}) {
  const options: { value: RsvpResponse; label: string; active: string; inactive: string }[] = [
    {
      value: 'in',
      label: 'In',
      active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      inactive: 'bg-transparent text-emerald-400/60 border-emerald-500/20',
    },
    {
      value: 'maybe',
      label: 'Maybe',
      active: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      inactive: 'bg-transparent text-amber-400/60 border-amber-500/20',
    },
    {
      value: 'out',
      label: 'Out',
      active: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      inactive: 'bg-transparent text-gray-400/60 border-gray-500/20',
    },
  ];

  return (
    <div class="flex gap-3">
      <For each={options}>
        {(option) => {
          const isActive = createMemo(() => props.currentResponse === option.value);
          return (
            <button
              class={`flex-1 min-h-[48px] rounded-xl font-semibold border-2 transition-all active:scale-95 ${
                isActive() ? option.active : option.inactive
              }`}
              disabled={props.disabled}
              onClick={() => props.onSelect(option.value)}
            >
              {option.label}
            </button>
          );
        }}
      </For>
    </div>
  );
}

function TimeSlotGrid(props: {
  slots: TimeSlot[];
  selectedSlotIds: string[];
  isCreator: boolean;
  sessionId: string;
  onVote: (slotId: string) => void;
  onConfirmSlot: (slot: TimeSlot) => void;
}) {
  return (
    <div class="space-y-2">
      <For each={props.slots}>
        {(slot) => {
          const isSelected = createMemo(() => props.selectedSlotIds.includes(slot.id));
          const formattedDate = createMemo(() => {
            const d = new Date(slot.date);
            return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          });

          return (
            <div class="flex items-center gap-3 bg-surface-light rounded-xl p-3">
              <button
                class={`flex-1 text-left rounded-lg p-2 transition-all ${
                  isSelected()
                    ? 'bg-primary/20 border-2 border-primary/40'
                    : 'bg-surface-lighter border-2 border-transparent'
                }`}
                onClick={() => props.onVote(slot.id)}
              >
                <div class="text-on-surface text-sm font-medium">{formattedDate()}</div>
                <div class="text-on-surface-muted text-xs">
                  {slot.startTime} - {slot.endTime}
                </div>
              </button>
              <div class="text-center min-w-[48px]">
                <div class="text-on-surface font-bold text-lg">{slot.voteCount}</div>
                <div class="text-on-surface-muted text-xs">votes</div>
              </div>
              <Show when={props.isCreator}>
                <button
                  class="text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-lg font-semibold active:scale-95 transition-transform"
                  onClick={() => props.onConfirmSlot(slot)}
                >
                  Confirm
                </button>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}

function DayOfButtons(props: {
  currentStatus: DayOfStatus;
  onSelect: (status: DayOfStatus) => void;
}) {
  const options: { value: DayOfStatus; label: string; active: string; inactive: string }[] = [
    {
      value: 'on-my-way',
      label: 'On my way',
      active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      inactive: 'bg-transparent text-blue-400/60 border-blue-500/20',
    },
    {
      value: 'here',
      label: "I'm here",
      active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      inactive: 'bg-transparent text-emerald-400/60 border-emerald-500/20',
    },
    {
      value: 'cant-make-it',
      label: "Can't make it",
      active: 'bg-red-500/20 text-red-400 border-red-500/30',
      inactive: 'bg-transparent text-red-400/60 border-red-500/20',
    },
  ];

  return (
    <div class="flex gap-3">
      <For each={options}>
        {(option) => {
          const isActive = createMemo(() => props.currentStatus === option.value);
          return (
            <button
              class={`flex-1 min-h-[48px] rounded-xl font-semibold border-2 text-sm transition-all active:scale-95 ${
                isActive() ? option.active : option.inactive
              }`}
              onClick={() => props.onSelect(option.value)}
            >
              {option.label}
            </button>
          );
        }}
      </For>
    </div>
  );
}

function statusColor(rsvp: SessionRsvp): string {
  if (rsvp.dayOfStatus === 'here') return 'border-emerald-500';
  if (rsvp.dayOfStatus === 'on-my-way') return 'border-blue-500';
  if (rsvp.response === 'maybe') return 'border-amber-500';
  if (rsvp.response === 'out' || rsvp.dayOfStatus === 'cant-make-it') return 'border-gray-500';
  return 'border-emerald-500/50';
}

function statusLabel(rsvp: SessionRsvp): string {
  if (rsvp.dayOfStatus === 'here') return 'Here';
  if (rsvp.dayOfStatus === 'on-my-way') return 'On my way';
  if (rsvp.dayOfStatus === 'cant-make-it') return "Can't make it";
  if (rsvp.response === 'in') return 'In';
  if (rsvp.response === 'maybe') return 'Maybe';
  return 'Out';
}

function statusTextColor(rsvp: SessionRsvp): string {
  if (rsvp.dayOfStatus === 'here') return 'text-emerald-400';
  if (rsvp.dayOfStatus === 'on-my-way') return 'text-blue-400';
  if (rsvp.dayOfStatus === 'cant-make-it') return 'text-red-400';
  if (rsvp.response === 'in') return 'text-emerald-400';
  if (rsvp.response === 'maybe') return 'text-amber-400';
  return 'text-gray-400';
}

function PlayerList(props: { rsvps: SessionRsvp[] }) {
  return (
    <div class="space-y-2">
      <For each={props.rsvps}>
        {(rsvp) => {
          const initial = createMemo(() =>
            (rsvp.displayName || '?').charAt(0).toUpperCase(),
          );

          return (
            <div class="flex items-center gap-3 bg-surface-light rounded-xl p-3">
              <div
                class={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 ${statusColor(rsvp)} bg-surface-lighter text-on-surface`}
              >
                {initial()}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-on-surface font-medium text-sm truncate">{rsvp.displayName}</div>
              </div>
              <span class={`text-xs font-semibold ${statusTextColor(rsvp)}`}>
                {statusLabel(rsvp)}
              </span>
            </div>
          );
        }}
      </For>
    </div>
  );
}

// --- Main page component ---

const SessionDetailPage: Component = () => {
  const params = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const { session, rsvps, loading } = useGameSession(() => params.sessionId);

  const [shareMessage, setShareMessage] = createSignal('');

  const currentUserRsvp = createMemo(() => {
    const uid = user()?.uid;
    if (!uid) return undefined;
    return rsvps().find((r) => r.userId === uid);
  });

  const currentResponse = createMemo(() => currentUserRsvp()?.response);

  const currentDayOfStatus = createMemo(() => currentUserRsvp()?.dayOfStatus ?? 'none');

  const selectedSlotIds = createMemo(() => currentUserRsvp()?.selectedSlotIds ?? []);

  const isCreator = createMemo(() => {
    const s = session();
    const u = user();
    return s !== null && u !== null && s.createdBy === u.uid;
  });

  const showDayOf = createMemo(() => {
    const s = session();
    const rsvp = currentUserRsvp();
    if (!s || !rsvp) return false;
    return canUpdateDayOfStatus(s, rsvp);
  });

  const formattedDate = createMemo(() => {
    const s = session();
    if (!s) return '';
    const confirmed = s.confirmedSlot;
    const dateVal = confirmed ? confirmed.date : s.scheduledDate;
    if (!dateVal) return 'Date TBD';
    const d = new Date(dateVal);
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  });

  const formattedTime = createMemo(() => {
    const s = session();
    if (!s) return '';
    const confirmed = s.confirmedSlot;
    if (confirmed) return `${confirmed.startTime} - ${confirmed.endTime}`;
    if (s.scheduledDate) {
      const d = new Date(s.scheduledDate);
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    return 'Time TBD';
  });

  const displayStatus = createMemo(() => {
    const s = session();
    if (!s) return '';
    return getSessionDisplayStatus(s);
  });

  const handleRsvp = async (response: RsvpResponse) => {
    const s = session();
    const u = user();
    if (!s || !u) return;

    const rsvp: SessionRsvp = {
      userId: u.uid,
      displayName: u.displayName ?? 'Anonymous',
      photoURL: u.photoURL,
      response,
      dayOfStatus: 'none',
      selectedSlotIds: selectedSlotIds(),
      respondedAt: Date.now(),
      statusUpdatedAt: null,
    };

    await firestoreGameSessionRepository.submitRsvp(s.id, rsvp);
  };

  const handleDayOfStatus = async (status: DayOfStatus) => {
    const s = session();
    const u = user();
    if (!s || !u) return;
    await firestoreGameSessionRepository.updateDayOfStatus(s.id, u.uid, status);
  };

  const handleSlotVote = async (slotId: string) => {
    const s = session();
    const u = user();
    if (!s || !u) return;

    const current = selectedSlotIds();
    const updated = current.includes(slotId)
      ? current.filter((id) => id !== slotId)
      : [...current, slotId];

    const rsvp: SessionRsvp = {
      userId: u.uid,
      displayName: u.displayName ?? 'Anonymous',
      photoURL: u.photoURL,
      response: currentResponse() ?? 'in',
      dayOfStatus: currentDayOfStatus(),
      selectedSlotIds: updated,
      respondedAt: Date.now(),
      statusUpdatedAt: currentUserRsvp()?.statusUpdatedAt ?? null,
    };

    await firestoreGameSessionRepository.submitRsvp(s.id, rsvp);
  };

  const handleConfirmSlot = async (slot: TimeSlot) => {
    const s = session();
    if (!s) return;
    await firestoreGameSessionRepository.update(s.id, {
      confirmedSlot: slot,
      scheduledDate: slot.date,
      status: 'confirmed',
    });
  };

  const handleToggleVisibility = async () => {
    const s = session();
    if (!s) return;
    const newVisibility = s.visibility === 'open' ? 'group' as const : 'open' as const;
    await firestoreGameSessionRepository.update(s.id, { visibility: newVisibility });
  };

  const handleShare = async () => {
    const s = session();
    if (!s) return;

    const shareUrl = `${window.location.origin}/session/${s.shareCode}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: s.title, text: `Join our game: ${s.title}`, url: shareUrl });
      } catch {
        // User cancelled share — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage('Link copied!');
      setTimeout(() => setShareMessage(''), 2000);
    } catch {
      setShareMessage('Could not copy link');
      setTimeout(() => setShareMessage(''), 2000);
    }
  };

  return (
    <div class="max-w-lg mx-auto px-4 pt-4 pb-24">
      {/* Loading state */}
      <Show when={!loading()} fallback={
        <div class="space-y-4">
          <div class="bg-surface-light rounded-2xl h-32 animate-pulse" />
          <div class="bg-surface-light rounded-2xl h-16 animate-pulse" />
          <div class="bg-surface-light rounded-2xl h-24 animate-pulse" />
        </div>
      }>
        {/* Not found state */}
        <Show when={session()} fallback={
          <div class="text-center py-16">
            <h2 class="text-lg font-bold text-on-surface mb-2">Session not found</h2>
            <p class="text-on-surface-muted text-sm">This session may have been deleted or the link is invalid.</p>
          </div>
        }>
          {(s) => (
            <div class="space-y-5">
              {/* Header */}
              <div class="bg-surface-light rounded-2xl p-5">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h1 class="text-xl font-bold text-on-surface truncate">{s().title}</h1>
                    <div class="mt-2 space-y-1">
                      <p class="text-on-surface-muted text-sm flex items-center gap-1.5">
                        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formattedDate()}
                      </p>
                      <p class="text-on-surface-muted text-sm flex items-center gap-1.5">
                        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formattedTime()}
                      </p>
                      <p class="text-on-surface-muted text-sm flex items-center gap-1.5">
                        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {s().location}
                      </p>
                    </div>
                  </div>
                  <span class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/20 text-primary">
                    {displayStatus()}
                  </span>
                </div>
              </div>

              {/* Spots tracker */}
              <SpotsTracker confirmed={s().spotsConfirmed} total={s().spotsTotal} />

              {/* RSVP or Day-of section */}
              <Show when={showDayOf()} fallback={
                <Show when={canRsvp(s())}>
                  <div class="bg-surface-light rounded-2xl p-4">
                    <h2 class="text-on-surface font-bold text-sm mb-3">Your RSVP</h2>
                    <Show when={s().rsvpStyle === 'simple'}>
                      <RsvpButtons
                        currentResponse={currentResponse()}
                        disabled={false}
                        onSelect={handleRsvp}
                      />
                    </Show>
                    <Show when={s().rsvpStyle === 'voting' && s().timeSlots}>
                      <div class="space-y-3">
                        <RsvpButtons
                          currentResponse={currentResponse()}
                          disabled={false}
                          onSelect={handleRsvp}
                        />
                        <div class="pt-2">
                          <h3 class="text-on-surface-muted text-xs font-medium mb-2 uppercase tracking-wide">
                            Vote for time slots
                          </h3>
                          <TimeSlotGrid
                            slots={s().timeSlots!}
                            selectedSlotIds={selectedSlotIds()}
                            isCreator={isCreator()}
                            sessionId={s().id}
                            onVote={handleSlotVote}
                            onConfirmSlot={handleConfirmSlot}
                          />
                        </div>
                      </div>
                    </Show>
                  </div>
                </Show>
              }>
                <div class="bg-surface-light rounded-2xl p-4">
                  <h2 class="text-on-surface font-bold text-sm mb-3">Day-of Status</h2>
                  <DayOfButtons
                    currentStatus={currentDayOfStatus()}
                    onSelect={handleDayOfStatus}
                  />
                </div>
              </Show>

              {/* Who's playing */}
              <div>
                <h2 class="text-on-surface font-bold text-sm mb-3">
                  Who's Playing ({rsvps().length})
                </h2>
                <Show when={rsvps().length > 0} fallback={
                  <p class="text-on-surface-muted text-sm text-center py-4">No RSVPs yet</p>
                }>
                  <PlayerList rsvps={rsvps()} />
                </Show>
              </div>

              {/* Share button */}
              <button
                class="w-full flex items-center justify-center gap-2 bg-surface-light text-on-surface font-semibold rounded-xl py-3 active:scale-[0.98] transition-transform"
                onClick={handleShare}
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share Session
              </button>
              <Show when={shareMessage()}>
                <p class="text-center text-primary text-sm font-medium -mt-3">{shareMessage()}</p>
              </Show>

              {/* Creator-only: Open to community toggle */}
              <Show when={isCreator()}>
                <div class="bg-surface-light rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <h3 class="text-on-surface font-bold text-sm">Open to community</h3>
                    <p class="text-on-surface-muted text-xs mt-0.5">
                      Allow anyone to find and join this session
                    </p>
                  </div>
                  <button
                    class={`relative w-12 h-7 rounded-full transition-colors ${
                      s().visibility === 'open' ? 'bg-primary' : 'bg-surface-lighter'
                    }`}
                    onClick={handleToggleVisibility}
                    aria-label="Toggle open to community"
                    role="switch"
                    aria-checked={s().visibility === 'open'}
                  >
                    <div
                      class={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
                        s().visibility === 'open' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </Show>
            </div>
          )}
        </Show>
      </Show>
    </div>
  );
};

export default SessionDetailPage;
