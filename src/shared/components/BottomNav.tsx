import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { useAuth } from '../hooks/useAuth';

const BottomNav: Component = () => {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const linkClass = (path: string) =>
    `relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[48px] px-2 py-1 text-xs font-medium transition-colors ${
      isActive(path) ? 'text-primary' : 'text-on-surface-muted'
    }`;

  return (
    <nav aria-label="Main navigation" class="fixed bottom-0 left-0 right-0 bg-surface-light border-t border-surface-lighter safe-bottom">
      <div class="max-w-lg mx-auto md:max-w-3xl flex justify-around py-1">
        <A href="/" class={linkClass('/')} aria-current={isActive('/') ? 'page' : undefined} aria-label="New Game">
          <Show when={isActive('/')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <svg aria-hidden="true" class="relative w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          <span class="relative">New</span>
        </A>
        <A href="/history" class={linkClass('/history')} aria-current={isActive('/history') ? 'page' : undefined} aria-label="Match History">
          <Show when={isActive('/history')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <svg aria-hidden="true" class="relative w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span class="relative">History</span>
        </A>
        <A href="/players" class={linkClass('/players')} aria-current={isActive('/players') ? 'page' : undefined} aria-label="Players">
          <Show when={isActive('/players')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <svg aria-hidden="true" class="relative w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span class="relative">Players</span>
        </A>
        <Show when={user()}>
          <A href="/tournaments" class={linkClass('/tournaments')} aria-current={isActive('/tournaments') ? 'page' : undefined} aria-label="Tournaments">
            <Show when={isActive('/tournaments')}>
              <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
            </Show>
            <svg aria-hidden="true" class="relative w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            <span class="relative">Tourneys</span>
          </A>
        </Show>
        <A href="/settings" class={linkClass('/settings')} aria-current={isActive('/settings') ? 'page' : undefined} aria-label="Settings">
          <Show when={isActive('/settings')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <svg aria-hidden="true" class="relative w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span class="relative">Settings</span>
        </A>
      </div>
    </nav>
  );
};

export default BottomNav;
