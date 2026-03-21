import type { Component, JSX } from 'solid-js';
import { Show, Suspense, createEffect, onMount } from 'solid-js';
import { useLocation } from '@solidjs/router';
import BottomNav from '../shared/components/BottomNav';
import { useTheme } from '../shared/hooks/useTheme';
import { PageSkeleton } from '../shared/components/Skeleton';
import { settings } from '../stores/settingsStore';
import AchievementToast from '../features/achievements/components/AchievementToast';
import SWUpdateToast from '../shared/pwa/SWUpdateToast';
import InstallPromptBanner from '../shared/pwa/InstallPromptBanner';
import { initSWUpdate } from '../shared/pwa/swUpdateStore';
import { showInstallBanner } from '../shared/pwa/installPromptStore';
import { initAppLifecycle } from '../shared/platform/appLifecycle';
import { SplashScreen } from '@capacitor/splash-screen';
import { IS_NATIVE } from '../shared/platform/platform';

interface Props {
  children?: JSX.Element;
}

const App: Component<Props> = (props) => {
  const location = useLocation();
  const showBottomNav = () => location.pathname !== '/';

  // Apply theme CSS variables + theme-color meta
  useTheme();

  createEffect(() => {
    const mode = settings().displayMode;
    document.documentElement.classList.toggle('outdoor', mode === 'outdoor');
  });

  onMount(() => {
    initSWUpdate();
    initAppLifecycle();
    if (IS_NATIVE) {
      SplashScreen.hide().catch(() => {});
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
      <AchievementToast />
      <Show when={!location.pathname.startsWith('/score/')}>
        <SWUpdateToast />
      </Show>
      <Show when={showInstallBanner() && !location.pathname.startsWith('/score/')}>
        <div
          class="fixed z-30 left-4 right-4 max-w-sm mx-auto pointer-events-auto"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <InstallPromptBanner />
        </div>
      </Show>
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
