import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import type { TournamentAccessMode } from '../../../data/types';
import { accessModeBadgeColors } from '../constants';

interface Props {
  accessMode: TournamentAccessMode;
  groupName?: string;
}

const MAX_GROUP_NAME_LENGTH = 20;

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

const AccessModeBadge: Component<Props> = (props) => {
  const label = () => {
    if (props.accessMode === 'open') return null;
    if (props.accessMode === 'approval') return 'Approval Required';
    if (props.accessMode === 'invite-only') return 'Invite Only';
    if (props.accessMode === 'group') {
      return props.groupName ? truncate(props.groupName, MAX_GROUP_NAME_LENGTH) : 'Group';
    }
    return null;
  };

  const fullLabel = () => {
    if (props.accessMode === 'group' && props.groupName) return `Group: ${props.groupName}`;
    return undefined;
  };

  const colorClass = () => accessModeBadgeColors[props.accessMode] ?? '';

  return (
    <Show when={label()}>
      {(text) => (
        <span
          class={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${colorClass()}`}
          aria-label={fullLabel()}
        >
          {text()}
        </span>
      )}
    </Show>
  );
};

export default AccessModeBadge;
