import { Show, For, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Users, MapPin } from 'lucide-solid';
import { useAuth } from '../../shared/hooks/useAuth';
import { useBuddyGroups } from './hooks/useBuddyGroups';
import type { BuddyGroup } from '../../data/types';

function GroupCard(props: { group: BuddyGroup }) {
  return (
    <A href={`/buddies/${props.group.id}`} class="block bg-surface-light rounded-2xl p-4 active:scale-[0.98] transition-transform">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-on-surface text-lg">{props.group.name}</h3>
          <p class="text-on-surface-muted text-sm mt-0.5">{props.group.description}</p>
        </div>
        <div class="flex items-center gap-1 text-on-surface-muted text-sm">
          <Users size={16} />
          <span>{props.group.memberCount}</span>
        </div>
      </div>
      <Show when={props.group.defaultLocation}>
        <p class="text-on-surface-muted text-xs mt-2 flex items-center gap-1">
          <MapPin size={12} />
          {props.group.defaultLocation}
        </p>
      </Show>
    </A>
  );
}

const BuddiesPage: Component = () => {
  const { user } = useAuth();
  const { groups, loading } = useBuddyGroups(() => user()?.uid);

  let containerRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!containerRef) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      containerRef.style.opacity = '1';
      return;
    }
    containerRef.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 200, easing: 'ease-out', fill: 'forwards' },
    );
  });

  return (
    <div ref={containerRef} style={{ opacity: '0' }} class="max-w-lg mx-auto px-4 pt-4 pb-24">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-on-surface font-display">Buddies</h1>
        <A href="/buddies/new" class="bg-primary text-surface px-4 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-transform">
          + New Group
        </A>
      </div>

      <Show when={!loading()} fallback={
        <div class="space-y-3">
          <For each={[1, 2, 3]}>
            {() => <div class="bg-surface-light rounded-2xl h-24 animate-pulse" />}
          </For>
        </div>
      }>
        <Show when={groups().length > 0} fallback={
          <div class="text-center py-16">
            <div class="text-5xl mb-4">&#127955;</div>
            <h2 class="text-lg font-bold text-on-surface mb-2">No groups yet</h2>
            <p class="text-on-surface-muted text-sm mb-6">Create a group to start organizing games with your crew</p>
            <A href="/buddies/new" class="inline-block bg-primary text-surface px-6 py-3 rounded-xl font-semibold active:scale-95 transition-transform">
              Create Your First Group
            </A>
          </div>
        }>
          <div class="space-y-3">
            <For each={groups()}>
              {(group) => <GroupCard group={group} />}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default BuddiesPage;
