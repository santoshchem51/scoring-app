import type { Component } from 'solid-js';

const SpectatorFooter: Component = () => {
  return (
    <footer class="text-center text-xs text-on-surface-muted py-4 mt-8">
      <a
        href="/privacy"
        class="underline hover:text-on-surface transition-colors"
        target="_blank"
        rel="noopener noreferrer"
      >
        Privacy Policy
      </a>
      <span class="mx-2">·</span>
      <span>Powered by PickleScore</span>
    </footer>
  );
};

export default SpectatorFooter;
