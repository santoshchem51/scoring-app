import { Show, For, createSignal, createResource } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreBuddyGroupRepository } from '../../data/firebase/firestoreBuddyGroupRepository';
import { firestoreGameSessionRepository } from '../../data/firebase/firestoreGameSessionRepository';
import { generateShareCode } from '../tournaments/engine/shareCode';
import type { GameSession, TimeSlot, RsvpStyle } from '../../data/types';

const MAX_TIME_SLOTS = 4;

/** Given a day name (e.g. "Saturday"), return the next occurrence as YYYY-MM-DD. */
function getNextOccurrence(dayName: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetIndex = days.indexOf(dayName);
  if (targetIndex === -1) return '';
  const today = new Date();
  const todayIndex = today.getDay();
  let daysUntil = targetIndex - todayIndex;
  if (daysUntil <= 0) daysUntil += 7;
  const next = new Date(today);
  next.setDate(today.getDate() + daysUntil);
  return next.toISOString().split('T')[0];
}

interface SlotInput {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

const CreateSessionPage: Component = () => {
  const params = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group] = createResource(() => params.groupId, (gid) => firestoreBuddyGroupRepository.get(gid));

  // Form signals
  const [title, setTitle] = createSignal('');
  const [location, setLocation] = createSignal('');
  const [rsvpStyle, setRsvpStyle] = createSignal<RsvpStyle>('simple');
  const [sessionDate, setSessionDate] = createSignal('');
  const [sessionTime, setSessionTime] = createSignal('');
  const [timeSlots, setTimeSlots] = createSignal<SlotInput[]>([]);
  const [courts, setCourts] = createSignal(1);
  const [totalSpots, setTotalSpots] = createSignal(4);
  const [minPlayers, setMinPlayers] = createSignal(4);
  const [autoOpen, setAutoOpen] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [prefilled, setPrefilled] = createSignal(false);

  // Pre-fill from group defaults when loaded
  const applyGroupDefaults = () => {
    const g = group();
    if (!g || prefilled()) return;
    setPrefilled(true);
    if (g.defaultLocation) setLocation(g.defaultLocation);
    if (g.defaultDay) {
      const nextDate = getNextOccurrence(g.defaultDay);
      if (nextDate) setSessionDate(nextDate);
    }
    if (g.defaultTime) setSessionTime(g.defaultTime);
  };

  // Reactive pre-fill: check every render if group loaded
  const groupData = () => {
    const g = group();
    if (g) applyGroupDefaults();
    return g;
  };

  const addTimeSlot = () => {
    if (timeSlots().length >= MAX_TIME_SLOTS) return;
    setTimeSlots((prev) => [
      ...prev,
      { id: crypto.randomUUID(), date: '', startTime: '', endTime: '' },
    ]);
  };

  const removeTimeSlot = (slotId: string) => {
    setTimeSlots((prev) => prev.filter((s) => s.id !== slotId));
  };

  const updateTimeSlot = (slotId: string, field: keyof Omit<SlotInput, 'id'>, value: string) => {
    setTimeSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, [field]: value } : s)),
    );
  };

  const handleSubmit = async () => {
    const currentUser = user();
    if (!currentUser || saving()) return;

    // Validation
    if (!title().trim()) {
      setError('Title is required.');
      return;
    }

    if (rsvpStyle() === 'simple') {
      if (!sessionDate()) {
        setError('Please select a date.');
        return;
      }
    } else {
      if (timeSlots().length < 2) {
        setError('Add at least 2 time slots for voting.');
        return;
      }
      const incomplete = timeSlots().some((s) => !s.date || !s.startTime || !s.endTime);
      if (incomplete) {
        setError('All time slots must have date, start time, and end time.');
        return;
      }
    }

    setError('');
    setSaving(true);

    try {
      const sessionId = crypto.randomUUID();
      const now = Date.now();

      let scheduledDate: number | null = null;
      let builtTimeSlots: TimeSlot[] | null = null;

      if (rsvpStyle() === 'simple') {
        const dateStr = sessionDate();
        const timeStr = sessionTime();
        const dateObj = timeStr
          ? new Date(`${dateStr}T${timeStr}`)
          : new Date(`${dateStr}T00:00`);
        scheduledDate = dateObj.getTime();
      } else {
        builtTimeSlots = timeSlots().map((s) => ({
          id: s.id,
          date: new Date(`${s.date}T00:00`).getTime(),
          startTime: s.startTime,
          endTime: s.endTime,
          voteCount: 0,
        }));
      }

      const session: GameSession = {
        id: sessionId,
        groupId: params.groupId,
        createdBy: currentUser.uid,
        title: title().trim(),
        location: location().trim(),
        courtsAvailable: courts(),
        spotsTotal: totalSpots(),
        spotsConfirmed: 0,
        scheduledDate,
        timeSlots: builtTimeSlots,
        confirmedSlot: null,
        rsvpStyle: rsvpStyle(),
        rsvpDeadline: null,
        visibility: 'group',
        shareCode: generateShareCode(),
        autoOpenOnDropout: autoOpen(),
        minPlayers: minPlayers(),
        status: 'proposed',
        createdAt: now,
        updatedAt: now,
      };

      await firestoreGameSessionRepository.create(session);
      navigate(`/session/${sessionId}`);
    } catch (err) {
      console.error('Failed to create session:', err);
      setError('Failed to create session. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout title="New Session">
      {/* Trigger pre-fill */}
      {groupData()}

      <div class="p-4 pb-24 space-y-6">
        {/* RSVP Style Toggle */}
        <div>
          <label class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
            Mode
          </label>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRsvpStyle('simple')}
              class={`py-3 rounded-xl font-semibold transition-colors ${rsvpStyle() === 'simple' ? 'bg-primary text-surface' : 'bg-surface-light text-on-surface-muted'}`}
            >
              Simple RSVP
            </button>
            <button
              type="button"
              onClick={() => setRsvpStyle('voting')}
              class={`py-3 rounded-xl font-semibold transition-colors ${rsvpStyle() === 'voting' ? 'bg-primary text-surface' : 'bg-surface-light text-on-surface-muted'}`}
            >
              Find a Time
            </button>
          </div>
          <p class="text-xs text-on-surface-muted mt-2">
            {rsvpStyle() === 'simple'
              ? 'Pick a single date and time for the session.'
              : 'Let players vote on 2-4 time slots.'}
          </p>
        </div>

        {/* Title */}
        <div>
          <label for="session-title" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
            Title *
          </label>
          <input
            id="session-title"
            type="text"
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            maxLength={80}
            class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
            placeholder='e.g., "Saturday Morning Doubles"'
          />
        </div>

        {/* Location */}
        <div>
          <label for="session-location" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
            Location
          </label>
          <input
            id="session-location"
            type="text"
            value={location()}
            onInput={(e) => setLocation(e.currentTarget.value)}
            class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
            placeholder="e.g., Central Park Courts"
          />
        </div>

        {/* Simple RSVP: Date & Time */}
        <Show when={rsvpStyle() === 'simple'}>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="session-date" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
                Date *
              </label>
              <input
                id="session-date"
                type="date"
                value={sessionDate()}
                onInput={(e) => setSessionDate(e.currentTarget.value)}
                class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
              />
            </div>
            <div>
              <label for="session-time" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
                Time
              </label>
              <input
                id="session-time"
                type="time"
                value={sessionTime()}
                onInput={(e) => setSessionTime(e.currentTarget.value)}
                class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
              />
            </div>
          </div>
        </Show>

        {/* Voting Mode: Time Slots */}
        <Show when={rsvpStyle() === 'voting'}>
          <div>
            <label class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
              Time Slots ({timeSlots().length}/{MAX_TIME_SLOTS})
            </label>

            <div class="space-y-3">
              <For each={timeSlots()}>
                {(slot) => (
                  <div class="bg-surface-light border border-surface-lighter rounded-xl p-3 space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-on-surface-muted font-medium">Slot</span>
                      <button
                        type="button"
                        onClick={() => removeTimeSlot(slot.id)}
                        class="text-red-400 hover:text-red-300 text-sm font-bold w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors"
                        aria-label="Remove time slot"
                      >
                        X
                      </button>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                      <input
                        type="date"
                        value={slot.date}
                        onInput={(e) => updateTimeSlot(slot.id, 'date', e.currentTarget.value)}
                        class="bg-surface border border-surface-lighter rounded-lg px-2 py-2 text-sm text-on-surface focus:border-primary"
                      />
                      <input
                        type="time"
                        value={slot.startTime}
                        onInput={(e) => updateTimeSlot(slot.id, 'startTime', e.currentTarget.value)}
                        class="bg-surface border border-surface-lighter rounded-lg px-2 py-2 text-sm text-on-surface focus:border-primary"
                        placeholder="Start"
                      />
                      <input
                        type="time"
                        value={slot.endTime}
                        onInput={(e) => updateTimeSlot(slot.id, 'endTime', e.currentTarget.value)}
                        class="bg-surface border border-surface-lighter rounded-lg px-2 py-2 text-sm text-on-surface focus:border-primary"
                        placeholder="End"
                      />
                    </div>
                  </div>
                )}
              </For>
            </div>

            <Show when={timeSlots().length < MAX_TIME_SLOTS}>
              <button
                type="button"
                onClick={addTimeSlot}
                class="mt-3 w-full py-2 rounded-xl border border-dashed border-surface-lighter text-on-surface-muted text-sm font-medium hover:border-primary hover:text-primary transition-colors"
              >
                + Add Time Slot
              </button>
            </Show>
          </div>
        </Show>

        {/* Courts / Spots / Min Players */}
        <div class="grid grid-cols-3 gap-3">
          <div class="text-center">
            <label for="session-courts" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
              Courts
            </label>
            <input
              id="session-courts"
              type="number"
              min={1}
              max={20}
              value={courts()}
              onInput={(e) => setCourts(parseInt(e.currentTarget.value, 10) || 1)}
              class="w-20 mx-auto bg-surface-light border border-surface-lighter rounded-xl px-3 py-3 text-on-surface text-center focus:border-primary"
            />
          </div>
          <div class="text-center">
            <label for="session-spots" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
              Total Spots
            </label>
            <input
              id="session-spots"
              type="number"
              min={2}
              max={100}
              value={totalSpots()}
              onInput={(e) => setTotalSpots(parseInt(e.currentTarget.value, 10) || 4)}
              class="w-20 mx-auto bg-surface-light border border-surface-lighter rounded-xl px-3 py-3 text-on-surface text-center focus:border-primary"
            />
          </div>
          <div class="text-center">
            <label for="session-min" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
              Min Players
            </label>
            <input
              id="session-min"
              type="number"
              min={2}
              max={100}
              value={minPlayers()}
              onInput={(e) => setMinPlayers(parseInt(e.currentTarget.value, 10) || 4)}
              class="w-20 mx-auto bg-surface-light border border-surface-lighter rounded-xl px-3 py-3 text-on-surface text-center focus:border-primary"
            />
          </div>
        </div>

        {/* Auto-open on dropout */}
        <div class="flex items-center justify-between bg-surface-light border border-surface-lighter rounded-xl px-4 py-3">
          <div>
            <p class="text-sm font-semibold text-on-surface">Auto-open on dropout</p>
            <p class="text-xs text-on-surface-muted">Open spot to next player when someone drops out</p>
          </div>
          <button
            type="button"
            onClick={() => setAutoOpen((v) => !v)}
            class={`w-12 h-7 rounded-full transition-colors relative ${autoOpen() ? 'bg-primary' : 'bg-surface-lighter'}`}
            role="switch"
            aria-checked={autoOpen()}
          >
            <span
              class={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${autoOpen() ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div class="fixed bottom-16 left-0 right-0 p-4 bg-surface/95 backdrop-blur-sm safe-bottom">
        <div class="max-w-lg mx-auto md:max-w-3xl">
          <Show when={error()}>
            <p class="text-red-500 text-sm text-center mb-2">{error()}</p>
          </Show>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving()}
            class={`w-full bg-primary text-surface font-semibold py-3 rounded-xl transition-transform ${!saving() ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
          >
            {saving() ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      </div>
    </PageLayout>
  );
};

export default CreateSessionPage;
