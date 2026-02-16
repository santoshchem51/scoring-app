import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { Plus, Clock, Users, Sparkles, Heart, Settings } from 'lucide-solid';
import { useAuth } from '../hooks/useAuth';
import { useBuddyNotifications } from '../../features/buddies/hooks/useBuddyNotifications';

const BottomNav: Component = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { unreadCount } = useBuddyNotifications(() => user()?.uid);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const linkClass = (path: string) =>
    `relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[48px] px-2 py-1 text-xs font-medium transition-colors ${
      isActive(path) ? 'text-primary' : 'text-on-surface-muted'
    }`;

  return (
    <nav aria-label="Main navigation" class="fixed bottom-0 left-0 right-0 bg-surface-light border-t border-surface-lighter safe-bottom">
      <div class="max-w-lg mx-auto md:max-w-3xl flex justify-around py-1">
        <A href="/new" class={linkClass('/new')} aria-current={isActive('/new') ? 'page' : undefined} aria-label="New Game">
          <Show when={isActive('/new')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <Plus size={24} class="relative" />
          <span class="relative">New</span>
        </A>
        <A href="/history" class={linkClass('/history')} aria-current={isActive('/history') ? 'page' : undefined} aria-label="Match History">
          <Show when={isActive('/history')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <Clock size={24} class="relative" />
          <span class="relative">History</span>
        </A>
        <A href="/players" class={linkClass('/players')} aria-current={isActive('/players') ? 'page' : undefined} aria-label="Players">
          <Show when={isActive('/players')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <Users size={24} class="relative" />
          <span class="relative">Players</span>
        </A>
        <Show when={user()}>
          <A href="/tournaments" class={linkClass('/tournaments')} aria-current={isActive('/tournaments') ? 'page' : undefined} aria-label="Tournaments">
            <Show when={isActive('/tournaments')}>
              <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
            </Show>
            <Sparkles size={24} class="relative" />
            <span class="relative">Tourneys</span>
          </A>
        </Show>
        <Show when={user()}>
          <A href="/buddies" class={linkClass('/buddies')} aria-current={isActive('/buddies') ? 'page' : undefined} aria-label="Buddies">
            <Show when={isActive('/buddies')}>
              <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
            </Show>
            <Heart size={24} class="relative" />
            <Show when={unreadCount() > 0}>
              <span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1" aria-label={`${unreadCount()} unread notifications`}>
                {unreadCount() > 9 ? '9+' : unreadCount()}
              </span>
            </Show>
            <span class="relative">Buddies</span>
          </A>
        </Show>
        <A href="/settings" class={linkClass('/settings')} aria-current={isActive('/settings') ? 'page' : undefined} aria-label="Settings">
          <Show when={isActive('/settings')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <Settings size={24} class="relative" />
          <span class="relative">Settings</span>
        </A>
      </div>
    </nav>
  );
};

export default BottomNav;
