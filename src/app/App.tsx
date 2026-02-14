import type { Component, JSX } from 'solid-js';
import { Suspense } from 'solid-js';
import BottomNav from '../shared/components/BottomNav';
import { PageSkeleton } from '../shared/components/Skeleton';

interface Props {
  children?: JSX.Element;
}

const App: Component<Props> = (props) => {
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
            <div class="max-w-lg mx-auto md:max-w-xl">
              <div class="skeleton h-5 w-24" />
            </div>
          </div>
          <div class="flex-1" role="status" aria-label="Loading page">
            <div class="max-w-lg mx-auto md:max-w-xl">
              <PageSkeleton />
            </div>
          </div>
        </div>
      }>
        {props.children}
      </Suspense>
      <BottomNav />
    </div>
  );
};

export default App;
