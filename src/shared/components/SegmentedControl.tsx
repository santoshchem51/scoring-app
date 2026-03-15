import { For } from 'solid-js';
import type { Component } from 'solid-js';

export interface Segment {
  id: string;
  label: string;
}

export interface SegmentedControlProps {
  segments: Segment[];
  activeId: string;
  onSelect: (id: string) => void;
  ariaLabel?: string;
}

export const SegmentedControl: Component<SegmentedControlProps> = (props) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const currentIndex = props.segments.findIndex((s) => s.id === props.activeId);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % props.segments.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + props.segments.length) % props.segments.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = props.segments.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const nextSegment = props.segments[nextIndex];
    props.onSelect(nextSegment.id);

    // Focus the newly active tab
    const tablist = (e.currentTarget as HTMLElement).closest('[role="tablist"]');
    if (tablist) {
      const buttons = tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons[nextIndex]?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={props.ariaLabel}
      class="flex gap-1 bg-surface-lighter rounded-xl p-1"
    >
      <For each={props.segments}>
        {(segment) => (
          <button
            role="tab"
            id={`tab-${segment.id}`}
            aria-selected={segment.id === props.activeId}
            aria-controls={`panel-${segment.id}`}
            tabindex={segment.id === props.activeId ? 0 : -1}
            class={`px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
              segment.id === props.activeId
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-on-surface-muted'
            }`}
            onClick={() => props.onSelect(segment.id)}
            onKeyDown={handleKeyDown}
          >
            {segment.label}
          </button>
        )}
      </For>
    </div>
  );
};
