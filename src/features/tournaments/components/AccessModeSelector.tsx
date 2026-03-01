import { createSignal, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { Unlock, ShieldCheck, Ticket, Users } from 'lucide-solid';
import type { TournamentAccessMode } from '../../../data/types';

interface Props {
  accessMode: TournamentAccessMode;
  listed: boolean;
  buddyGroupId: string | null;
  buddyGroupName: string | null;
  buddyGroups: Array<{ id: string; name: string }>;
  onAccessModeChange: (mode: TournamentAccessMode) => void;
  onListedChange: (listed: boolean) => void;
  onGroupChange: (groupId: string, groupName: string) => void;
  onInlineGroupCreate?: (name: string) => Promise<{ id: string; name: string }>;
  disabled?: boolean;
}

const modes: Array<{
  value: TournamentAccessMode;
  label: string;
  subtitle: string;
  icon: typeof Unlock;
}> = [
  { value: 'open', label: 'Open', subtitle: 'Anyone can join', icon: Unlock },
  { value: 'approval', label: 'Approval Required', subtitle: 'You approve each player', icon: ShieldCheck },
  { value: 'invite-only', label: 'Invite Only', subtitle: 'Only players you invite', icon: Ticket },
  { value: 'group', label: 'Buddy Group', subtitle: 'Open to a specific group', icon: Users },
];

const AccessModeSelector: Component<Props> = (props) => {
  const [newGroupName, setNewGroupName] = createSignal('');
  const [creatingGroup, setCreatingGroup] = createSignal(false);

  const showListedToggle = () =>
    props.accessMode === 'invite-only' || props.accessMode === 'group';

  const showGroupSelector = () => props.accessMode === 'group';

  const handleCreateGroup = async () => {
    const name = newGroupName().trim();
    if (!name || !props.onInlineGroupCreate) return;
    setCreatingGroup(true);
    try {
      const group = await props.onInlineGroupCreate(name);
      props.onGroupChange(group.id, group.name);
      setNewGroupName('');
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <fieldset class="space-y-3" disabled={props.disabled}>
      <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
        Who Can Join?
      </legend>

      {/* 2x2 grid — matches OptionCard selected/unselected styles */}
      <div class="grid grid-cols-2 gap-3">
        <For each={modes}>
          {(mode) => {
            const Icon = mode.icon;
            const isSelected = () => props.accessMode === mode.value;
            return (
              <button
                type="button"
                aria-pressed={isSelected()}
                onClick={() => props.onAccessModeChange(mode.value)}
                class={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all active:scale-[0.97] hover-lift ${
                  isSelected()
                    ? 'border-primary bg-primary/20 text-on-surface'
                    : 'border-surface-lighter bg-surface-light text-on-surface-muted hover:border-on-surface-muted'
                }`}
              >
                <Icon size={20} />
                <span class="text-sm font-bold">{mode.label}</span>
                <span class="text-[11px] leading-tight opacity-80">{mode.subtitle}</span>
              </button>
            );
          }}
        </For>
      </div>

      {/* Conditional: Group selector */}
      <Show when={showGroupSelector()}>
        <div class="bg-surface-light rounded-lg p-3 border-l-4 border-blue-400 space-y-2">
          <Show
            when={props.buddyGroups.length > 0}
            fallback={
              <div class="space-y-2">
                <p class="text-xs text-on-surface-muted">You don't have any groups yet. Create one to get started.</p>
                <div class="flex gap-2">
                  <input
                    type="text"
                    placeholder="Name your group"
                    value={newGroupName()}
                    onInput={(e) => setNewGroupName(e.currentTarget.value)}
                    class="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-muted"
                  />
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={!newGroupName().trim() || creatingGroup()}
                    class="px-3 py-2 bg-surface-light border border-border text-on-surface text-sm font-semibold rounded-lg disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            }
          >
            <label class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider">
              Select Group
              <select
                aria-label="Select Group"
                value={props.buddyGroupId ?? ''}
                onChange={(e) => {
                  const g = props.buddyGroups.find((g) => g.id === e.currentTarget.value);
                  if (g) props.onGroupChange(g.id, g.name);
                }}
                class="mt-1 w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-on-surface appearance-none cursor-pointer"
              >
                <option value="">Choose a group...</option>
                <For each={props.buddyGroups}>
                  {(g) => <option value={g.id}>{g.name}</option>}
                </For>
              </select>
            </label>
            <Show when={props.buddyGroupName}>
              <p class="text-xs text-on-surface-muted">
                Members of '{props.buddyGroupName}' can join.
              </p>
            </Show>
          </Show>
        </div>
      </Show>

      {/* Conditional: Listed toggle */}
      <Show when={showListedToggle()}>
        <div class="bg-surface-light rounded-lg p-3 border-l-4 border-primary/50">
          <label class="flex items-center justify-between cursor-pointer">
            <div>
              <span class="text-sm font-semibold text-on-surface">Let players find this</span>
              <p class="text-xs text-on-surface-muted mt-0.5">
                Your tournament will appear in search results
              </p>
            </div>
            <input
              type="checkbox"
              checked={props.listed}
              onChange={(e) => props.onListedChange(e.currentTarget.checked)}
              class="w-10 h-5 rounded-full appearance-none bg-surface border border-border checked:bg-primary relative cursor-pointer
                after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-transform
                checked:after:translate-x-5"
            />
          </label>
        </div>
      </Show>
    </fieldset>
  );
};

export default AccessModeSelector;
