import { Show, For, createSignal, createEffect, on, onMount, onCleanup } from 'solid-js';
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
  let feedRef: HTMLOListElement | undefined;
  let lastScrollTime = 0;
  const [userScrolled, setUserScrolled] = createSignal(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (!feedRef) return;
    feedRef.scrollTo({ top: feedRef.scrollHeight, behavior });
  };

  // Auto-scroll on new events
  createEffect(on(() => props.events.length, (len, prevLen) => {
    if (len === undefined || prevLen === undefined) return;
    if (len <= prevLen) return;
    if (userScrolled()) return;

    const now = Date.now();
    const behavior: ScrollBehavior = (now - lastScrollTime < 400) ? 'instant' : 'smooth';
    lastScrollTime = now;

    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => scrollToBottom(behavior));
  }));

  // Track user scroll intent
  const handleUserScroll = () => {
    if (!feedRef) return;
    const distanceFromBottom = feedRef.scrollHeight - feedRef.scrollTop - feedRef.clientHeight;
    if (distanceFromBottom > 50) {
      setUserScrolled(true);
    } else {
      setUserScrolled(false);
    }
  };

  onMount(() => {
    if (feedRef) {
      feedRef.addEventListener('wheel', handleUserScroll);
      feedRef.addEventListener('touchstart', () => setUserScrolled(true), { passive: true });
      feedRef.addEventListener('scroll', handleUserScroll, { passive: true });
    }
  });

  onCleanup(() => {
    if (feedRef) {
      feedRef.removeEventListener('wheel', handleUserScroll);
      feedRef.removeEventListener('scroll', handleUserScroll);
    }
  });

  const handleJumpToLive = () => {
    setUserScrolled(false);
    scrollToBottom('smooth');
  };

  return (
    <div role="log" aria-relevant="additions" aria-label="Play-by-play events" style={{ position: 'relative' }}>
      <Show
        when={props.events.length > 0}
        fallback={
          <p class="text-center text-on-surface-muted text-sm py-4">No events yet</p>
        }
      >
        <ol
          ref={(el) => { feedRef = el; }}
          class="space-y-1"
          style={{ 'max-height': '60vh', 'overflow-y': 'auto' }}
        >
          <For each={props.events}>
            {(event) => (
              <li
                class="flex items-center gap-2 py-1 px-2 text-sm"
                style={{ contain: 'content' }}
              >
                <span class="text-on-surface-muted text-xs flex-shrink-0 w-12">
                  {formatRelativeTime(event.timestamp)}
                </span>
                <span class="flex-1" style={eventDescription(event, props.team1Name, props.team2Name).style}>
                  {eventDescription(event, props.team1Name, props.team2Name).text}
                </span>
                <span
                  class="font-mono text-xs flex-shrink-0"
                  style={{ 'text-align': 'right', 'min-width': '3ch' }}
                >
                  {event.team1Score}-{event.team2Score}
                </span>
              </li>
            )}
          </For>
        </ol>
      </Show>

      {/* Jump to live button */}
      <Show when={userScrolled() && props.events.length > 0}>
        <button
          type="button"
          onClick={handleJumpToLive}
          class="text-xs font-semibold text-primary bg-white border border-primary/30 rounded-full px-3 py-1 shadow-md"
          style={{
            position: 'sticky',
            bottom: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'block',
            margin: '0 auto',
            cursor: 'pointer',
          }}
        >
          Jump to live
        </button>
      </Show>
    </div>
  );
};

export default PlayByPlayFeed;
