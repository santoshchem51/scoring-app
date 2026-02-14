import type { Component, JSX } from 'solid-js';
import { Suspense } from 'solid-js';
import BottomNav from '../shared/components/BottomNav';

interface Props {
  children?: JSX.Element;
}

const App: Component<Props> = (props) => {
  return (
    <div class="min-h-screen bg-surface text-on-surface">
      <Suspense fallback={<div class="flex items-center justify-center min-h-screen text-on-surface-muted">Loading...</div>}>
        {props.children}
      </Suspense>
      <BottomNav />
    </div>
  );
};

export default App;
