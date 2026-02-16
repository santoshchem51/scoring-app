import type { Component, JSX } from 'solid-js';
import { Show, Suspense, createEffect } from 'solid-js';
import { useLocation } from '@solidjs/router';
import BottomNav from '../shared/components/BottomNav';
import { PageSkeleton } from '../shared/components/Skeleton';
import { settings } from '../stores/settingsStore';

interface Props {
  children?: JSX.Element;
}

const App: Component<Props> = (props) => {
  const location = useLocation();
  const showBottomNav = () => location.pathname !== '/';

  createEffect(() => {
    const mode = settings().displayMode;
    document.documentElement.classList.toggle('outdoor', mode === 'outdoor');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', mode === 'outdoor' ? '#ffffff' : '#1e1e2e');
    }
  });

  return (
    <div class="min-h-screen bg-surface text-on-surface">
      <a
        href="#main-content"
        class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-surface focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
      <Suspense fallback={
        <div class="flex flex-col min-h-screen bg-surface">
          <div class="bg-surface-light border-b border-surface-lighter px-4 py-3">
            <div class="max-w-lg mx-auto md:max-w-3xl">
              <div class="skeleton h-5 w-24" />
            </div>
          </div>
          <div class="flex-1" role="status" aria-label="Loading page">
            <div class="max-w-lg mx-auto md:max-w-3xl">
              <PageSkeleton />
            </div>
          </div>
        </div>
      }>
        {props.children}
      </Suspense>
      <Show when={showBottomNav()}>
        <BottomNav />
      </Show>
    </div>
  );
};

export default App;
