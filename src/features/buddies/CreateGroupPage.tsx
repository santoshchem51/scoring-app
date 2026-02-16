import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreBuddyGroupRepository } from '../../data/firebase/firestoreBuddyGroupRepository';
import { generateShareCode } from '../tournaments/engine/shareCode';
import { validateGroupName } from './engine/groupHelpers';
import type { BuddyGroup, BuddyGroupMember, BuddyGroupVisibility } from '../../data/types';

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

const CreateGroupPage: Component = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [defaultLocation, setDefaultLocation] = createSignal('');
  const [defaultDay, setDefaultDay] = createSignal('');
  const [defaultTime, setDefaultTime] = createSignal('');
  const [visibility, setVisibility] = createSignal<BuddyGroupVisibility>('private');
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [nameError, setNameError] = createSignal('');

  const handleSubmit = async () => {
    const nameValidation = validateGroupName(name());
    if (nameValidation) {
      setNameError(nameValidation);
      return;
    }
    setNameError('');

    const currentUser = user();
    if (!currentUser || saving()) return;

    setError('');
    setSaving(true);
    try {
      const groupId = crypto.randomUUID();
      const now = Date.now();

      const group: BuddyGroup = {
        id: groupId,
        name: name().trim(),
        description: description().trim(),
        createdBy: currentUser.uid,
        defaultLocation: defaultLocation().trim() || null,
        defaultDay: defaultDay() || null,
        defaultTime: defaultTime() || null,
        memberCount: 1,
        visibility: visibility(),
        shareCode: generateShareCode(),
        createdAt: now,
        updatedAt: now,
      };

      await firestoreBuddyGroupRepository.create(group);

      const member: BuddyGroupMember = {
        userId: currentUser.uid,
        displayName: currentUser.displayName ?? 'Unknown',
        photoURL: currentUser.photoURL ?? null,
        role: 'admin',
        joinedAt: now,
      };

      await firestoreBuddyGroupRepository.addMember(groupId, member);

      navigate(`/buddies/${groupId}`);
    } catch (err) {
      console.error('Failed to create group:', err);
      setError('Failed to create group. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout title="Create Group">
      <div class="p-4 pb-24 space-y-6">
        {/* Group Name */}
        <div>
          <label for="group-name" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
            Group Name *
          </label>
          <input
            id="group-name"
            type="text"
            value={name()}
            onInput={(e) => { setName(e.currentTarget.value); setNameError(''); }}
            maxLength={50}
            class={`w-full bg-surface-light border rounded-xl px-4 py-3 text-on-surface focus:border-primary ${nameError() ? 'border-red-500' : 'border-surface-lighter'}`}
            placeholder="e.g., Sunday Picklers"
          />
          <Show when={nameError()}>
            <p class="text-red-500 text-xs mt-1">{nameError()}</p>
          </Show>
        </div>

        {/* Description */}
        <div>
          <label for="group-desc" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
            Description
          </label>
          <textarea
            id="group-desc"
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            rows={3}
            class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary resize-none"
            placeholder="What's this group about?"
          />
        </div>

        {/* Default Location */}
        <div>
          <label for="group-location" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
            Default Location
          </label>
          <input
            id="group-location"
            type="text"
            value={defaultLocation()}
            onInput={(e) => setDefaultLocation(e.currentTarget.value)}
            class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
            placeholder="e.g., Central Park Courts"
          />
        </div>

        {/* Default Day & Time */}
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="group-day" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
              Default Day
            </label>
            <select
              id="group-day"
              value={defaultDay()}
              onChange={(e) => setDefaultDay(e.currentTarget.value)}
              class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
            >
              <option value="">No fixed day</option>
              {DAYS_OF_WEEK.map((day) => (
                <option value={day}>{day}</option>
              ))}
            </select>
          </div>
          <div>
            <label for="group-time" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
              Default Time
            </label>
            <input
              id="group-time"
              type="time"
              value={defaultTime()}
              onInput={(e) => setDefaultTime(e.currentTarget.value)}
              class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
            />
          </div>
        </div>

        {/* Visibility Toggle */}
        <div>
          <label class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">
            Visibility
          </label>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setVisibility('private')}
              class={`py-3 rounded-xl font-semibold transition-colors ${visibility() === 'private' ? 'bg-primary text-surface' : 'bg-surface-light text-on-surface-muted'}`}
            >
              Private
            </button>
            <button
              type="button"
              onClick={() => setVisibility('public')}
              class={`py-3 rounded-xl font-semibold transition-colors ${visibility() === 'public' ? 'bg-primary text-surface' : 'bg-surface-light text-on-surface-muted'}`}
            >
              Public
            </button>
          </div>
          <p class="text-xs text-on-surface-muted mt-2">
            {visibility() === 'private'
              ? 'Only people with the share code can join.'
              : 'Anyone can find and join this group.'}
          </p>
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
            {saving() ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </PageLayout>
  );
};

export default CreateGroupPage;
