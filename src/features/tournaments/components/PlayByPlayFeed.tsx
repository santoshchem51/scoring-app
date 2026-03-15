import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { ScoreEvent } from '../../../data/types';

interface PlayByPlayFeedProps {
  events: ScoreEvent[];
  team1Name: string;
  team2Name: string;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  return `${diffMin}m ago`;
}

function eventDescription(
  event: ScoreEvent,
  team1Name: string,
  team2Name: string,
): { text: string; style: Record<string, string> } {
  switch (event.type) {
    case 'POINT_SCORED':
      return {
        text: `${event.team === 1 ? team1Name : team2Name} scores`,
        style: {},
      };
    case 'SIDE_OUT':
      return { text: 'Side out', style: { color: '#4B5563' } };
    case 'FAULT':
      return { text: 'Fault', style: { color: '#4B5563' } };
    case 'UNDO':
      return { text: 'Undo', style: { 'font-style': 'italic', color: '#4B5563' } };
  }
}

const PlayByPlayFeed: Component<PlayByPlayFeedProps> = (props) => {
  return (
    <div role="log" aria-relevant="additions" aria-label="Play-by-play events">
      <Show
        when={props.events.length > 0}
        fallback={
          <p class="text-center text-on-surface-muted text-sm py-4">No events yet</p>
        }
      >
        <ol class="space-y-1">
          <For each={props.events}>
            {(event) => {
              const desc = eventDescription(event, props.team1Name, props.team2Name);
              return (
                <li
                  class="flex items-center gap-2 py-1 px-2 text-sm"
                  style={{ contain: 'content' }}
                >
                  <span class="text-on-surface-muted text-xs flex-shrink-0 w-12">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                  <span class="flex-1" style={desc.style}>
                    {desc.text}
                  </span>
                  <span
                    class="font-mono text-xs flex-shrink-0"
                    style={{ 'text-align': 'right', 'min-width': '3ch' }}
                  >
                    {event.team1Score}-{event.team2Score}
                  </span>
                </li>
              );
            }}
          </For>
        </ol>
      </Show>
    </div>
  );
};

export default PlayByPlayFeed;
