import type { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';

const BottomNav: Component = () => {
  const location = useLocation();

  const linkClass = (path: string) => {
    const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    return `flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
      active ? 'text-primary' : 'text-on-surface-muted'
    }`;
  };

  return (
    <nav class="fixed bottom-0 left-0 right-0 bg-surface-light border-t border-surface-lighter flex justify-around py-1 safe-bottom">
      <A href="/" class={linkClass('/')}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        <span>New Game</span>
      </A>
      <A href="/history" class={linkClass('/history')}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>History</span>
      </A>
      <A href="/players" class={linkClass('/players')}>
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        <span>Players</span>
      </A>
    </nav>
  );
};

export default BottomNav;
