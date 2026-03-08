import { createSignal, Show, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { User, Settings } from 'lucide-solid';
import { useAuth } from '../hooks/useAuth';
import Logo, { LogoIcon } from './Logo';
import { syncStatus, failedCount } from '../../data/firebase/useSyncStatus';
import { wakeProcessor } from '../../data/firebase/syncProcessor';

interface TopNavProps {
  pageTitle?: string;
  variant?: 'app' | 'landing';
}

const TopNav: Component<TopNavProps> = (props) => {
  const { user, loading, signIn, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = createSignal(false);

  let triggerRef: HTMLButtonElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  function getMenuItems(): HTMLElement[] {
    if (!menuRef) return [];
    return Array.from(menuRef.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }

  function focusItem(index: number) {
    const items = getMenuItems();
    if (items.length === 0) return;
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    items[clamped].focus();
  }

  function openMenu() {
    setMenuOpen(true);
    // Focus first menuitem after DOM update
    queueMicrotask(() => focusItem(0));
  }

  function closeMenu() {
    setMenuOpen(false);
    triggerRef?.focus();
  }

  function handleTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    }
  }

  function handleMenuKeyDown(e: KeyboardEvent) {
    const items = getMenuItems();
    const currentIndex = items.indexOf(e.target as HTMLElement);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusItem(currentIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusItem(currentIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusItem(0);
        break;
      case 'End':
        e.preventDefault();
        focusItem(items.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        closeMenu();
        break;
      case 'Tab':
        closeMenu();
        break;
    }
  }

  // Close on outside clicks via Escape (global listener)
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && menuOpen()) closeMenu();
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleGlobalKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleGlobalKeyDown));
  }

  const isLanding = () => (props.variant ?? 'app') === 'landing';

  return (
    <header
      class={`px-4 py-2.5 ${isLanding() ? '' : 'bg-surface-light border-b border-surface-lighter'}`}
    >
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        {/* Left: Logo + title or wordmark */}
        <A href="/" class="flex items-center gap-2 no-underline">
          <LogoIcon class="w-7 h-7" />
          <Show
            when={props.pageTitle}
            fallback={<Logo size="sm" />}
          >
            <span class="text-lg font-bold text-on-surface">{props.pageTitle}</span>
          </Show>
        </A>

        {/* Right: Auth */}
        <Show when={!loading()}>
          <div class="relative">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => menuOpen() ? closeMenu() : openMenu()}
              onKeyDown={handleTriggerKeyDown}
              class="relative flex items-center active:scale-95 transition-transform"
              aria-label="Account menu"
              aria-expanded={menuOpen()}
              aria-haspopup="menu"
            >
              <Show
                when={user()}
                fallback={
                  <div class="w-8 h-8 rounded-full bg-on-surface-muted/30 flex items-center justify-center text-on-surface-muted font-bold text-sm">
                    ?
                  </div>
                }
              >
                <Show
                  when={user()?.photoURL}
                  fallback={
                    <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-surface font-bold text-sm">
                      {user()?.displayName?.charAt(0) ?? '?'}
                    </div>
                  }
                >
                  <img
                    src={user()!.photoURL!}
                    alt=""
                    class="w-8 h-8 rounded-full"
                    referrerpolicy="no-referrer"
                  />
                </Show>
              </Show>
              <Show when={syncStatus() !== 'idle'}>
                <span
                  role="status"
                  data-testid="sync-indicator"
                  aria-label={
                    syncStatus() === 'failed'
                      ? 'Sync failed'
                      : syncStatus() === 'processing'
                      ? 'Syncing'
                      : 'Sync pending'
                  }
                  class={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-light ${
                    syncStatus() === 'failed'
                      ? 'bg-amber-400'
                      : syncStatus() === 'processing'
                      ? 'bg-primary animate-pulse'
                      : 'bg-primary'
                  }`}
                />
              </Show>
            </button>

            {/* Dropdown menu */}
            <Show when={menuOpen()}>
              <div
                class="fixed inset-0 z-40"
                onClick={() => closeMenu()}
              />
              <div
                ref={menuRef}
                role="menu"
                aria-label="Account options"
                onKeyDown={handleMenuKeyDown}
                class="absolute right-0 top-full mt-2 w-56 bg-surface-light rounded-xl shadow-lg border border-surface-lighter z-50 overflow-hidden"
              >
                <Show
                  when={user()}
                  fallback={
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        tabindex="-1"
                        onClick={() => {
                          signIn();
                          closeMenu();
                        }}
                        class="w-full text-left px-4 py-3 text-sm text-primary font-semibold hover:bg-surface-lighter transition-colors focus-visible:bg-surface-lighter focus-visible:outline-none"
                      >
                        Sign in with Google
                      </button>
                      <A
                        href="/settings"
                        role="menuitem"
                        tabindex="-1"
                        onClick={() => closeMenu()}
                        class="flex items-center gap-3 px-4 py-3 text-sm text-on-surface hover:bg-surface-lighter transition-colors no-underline focus-visible:bg-surface-lighter focus-visible:outline-none"
                      >
                        <Settings class="w-4 h-4 text-on-surface-muted" />
                        Settings
                      </A>
                    </>
                  }
                >
                  <div class="px-4 py-3 border-b border-surface-lighter">
                    <div class="font-semibold text-on-surface text-sm truncate">
                      {user()?.displayName}
                    </div>
                    <div class="text-xs text-on-surface-muted truncate">
                      {user()?.email}
                    </div>
                  </div>
                  <A
                    href="/profile"
                    role="menuitem"
                    tabindex="-1"
                    onClick={() => closeMenu()}
                    class="flex items-center gap-3 px-4 py-3 text-sm text-on-surface hover:bg-surface-lighter transition-colors no-underline focus-visible:bg-surface-lighter focus-visible:outline-none"
                  >
                    <User class="w-4 h-4 text-on-surface-muted" />
                    My Profile
                  </A>
                  <A
                    href="/settings"
                    role="menuitem"
                    tabindex="-1"
                    onClick={() => closeMenu()}
                    class="flex items-center gap-3 px-4 py-3 text-sm text-on-surface hover:bg-surface-lighter transition-colors no-underline focus-visible:bg-surface-lighter focus-visible:outline-none"
                  >
                    <Settings class="w-4 h-4 text-on-surface-muted" />
                    Settings
                  </A>
                  <Show when={syncStatus() === 'failed'}>
                    <button
                      type="button"
                      role="menuitem"
                      tabindex="-1"
                      onClick={() => {
                        wakeProcessor();
                        closeMenu();
                      }}
                      class="w-full text-left px-4 py-3 text-sm text-amber-400 hover:bg-surface-lighter transition-colors focus-visible:bg-surface-lighter focus-visible:outline-none"
                    >
                      {failedCount()} sync{failedCount() === 1 ? '' : 's'} failed — Retry
                    </button>
                  </Show>
                  <button
                    type="button"
                    role="menuitem"
                    tabindex="-1"
                    onClick={() => {
                      signOut();
                      closeMenu();
                    }}
                    class="w-full text-left px-4 py-3 text-sm text-on-surface-muted hover:bg-surface-lighter transition-colors border-t border-surface-lighter focus-visible:bg-surface-lighter focus-visible:outline-none"
                  >
                    Sign out
                  </button>
                </Show>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </header>
  );
};

export default TopNav;
