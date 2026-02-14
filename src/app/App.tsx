import type { Component, JSX } from 'solid-js';
import { Suspense } from 'solid-js';
import BottomNav from '../shared/components/BottomNav';

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
      <Suspense fallback={<div role="status" aria-label="Loading page" class="flex items-center justify-center min-h-screen text-on-surface-muted">Loading...</div>}>
        {props.children}
      </Suspense>
      <BottomNav />
    </div>
  );
};

export default App;
