import type { Component } from 'solid-js';

const App: Component = () => {
  return (
    <div class="min-h-screen bg-surface text-on-surface">
      <h1 class="text-4xl font-bold text-center py-8 text-primary">
        Pickle Score
      </h1>
      <p class="text-center text-on-surface-muted">
        Live pickleball scoring
      </p>
    </div>
  );
};

export default App;
