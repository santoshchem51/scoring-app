import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { useAuth } from '../hooks/useAuth';
import Logo, { LogoIcon } from './Logo';

interface TopNavProps {
  pageTitle?: string;
  variant?: 'app' | 'landing';
}

const TopNav: Component<TopNavProps> = (props) => {
  const { user, loading, signIn, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = createSignal(false);

  const isLanding = () => (props.variant ?? 'app') === 'landing';

  return (
    <header
      class={`px-4 py-2.5 ${isLanding() ? '' : 'bg-surface-light border-b border-surface-lighter'}`}
    >
      <div class="max-w-lg mx-auto md:max-w-3xl flex items-center justify-between">
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
          <Show
            when={user()}
            fallback={
              <button
                type="button"
                onClick={() => signIn()}
                class="text-sm font-semibold text-primary px-3 py-1.5 rounded-lg bg-primary/10 active:scale-95 transition-transform"
              >
                Sign In
              </button>
            }
          >
            <div class="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen())}
                class="flex items-center active:scale-95 transition-transform"
                aria-label="Account menu"
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
              </button>

              {/* Dropdown menu */}
              <Show when={menuOpen()}>
                <div
                  class="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div class="absolute right-0 top-full mt-2 w-56 bg-surface-light rounded-xl shadow-lg border border-surface-lighter z-50 overflow-hidden">
                  <div class="px-4 py-3 border-b border-surface-lighter">
                    <div class="font-semibold text-on-surface text-sm truncate">
                      {user()?.displayName}
                    </div>
                    <div class="text-xs text-on-surface-muted truncate">
                      {user()?.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      setMenuOpen(false);
                    }}
                    class="w-full text-left px-4 py-3 text-sm text-on-surface-muted hover:bg-surface-lighter transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </div>
    </header>
  );
};

export default TopNav;
