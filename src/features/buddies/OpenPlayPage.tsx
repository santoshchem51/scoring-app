import type { Component } from 'solid-js';
import { A } from '@solidjs/router';

const OpenPlayPage: Component = () => {
  return (
    <div class="max-w-lg mx-auto px-4 pt-4 pb-24">
      <h1 class="text-2xl font-bold text-on-surface font-display mb-6">Open Play</h1>
      <div class="text-center py-16">
        <div class="text-5xl mb-4">🎯</div>
        <h2 class="text-lg font-bold text-on-surface mb-2">Coming Soon</h2>
        <p class="text-on-surface-muted text-sm mb-6">Browse open games near you</p>
        <A href="/buddies" class="inline-block bg-primary text-surface px-6 py-3 rounded-xl font-semibold active:scale-95 transition-transform">
          Back to Buddies
        </A>
      </div>
    </div>
  );
};

export default OpenPlayPage;
