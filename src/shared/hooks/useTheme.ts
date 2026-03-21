import { createMemo, createRenderEffect } from 'solid-js';
import { settings } from '../../stores/settingsStore';
import { THEMES } from '../constants/themes';
import { logger } from '../observability/logger';

/** Track which CSS custom properties we've set so we can clean them up on switch */
const appliedKeys = new Set<string>();
let initialized = false;

/**
 * Reactive hook that applies the current theme's CSS custom properties
 * to document.documentElement. Call once in App.tsx.
 */
export function useTheme(): void {
  if (initialized) {
    if (import.meta.env.DEV) {
      logger.warn('useTheme() called multiple times — only the first call is effective');
    }
    return;
  }
  initialized = true;

  // Derived signals so the effect only re-runs when theme or displayMode change,
  // not on every settings mutation (e.g. volume, haptics).
  const themeKey = createMemo(() => settings().theme);
  const displayMode = createMemo(() => settings().displayMode);

  createRenderEffect(() => {
    const theme = THEMES[themeKey()];
    if (!theme) return;
    const isOutdoor = displayMode() === 'outdoor';
    const colors = isOutdoor ? theme.outdoorColors : theme.colors;

    const root = document.documentElement;

    // Single-pass: apply new values (overwrites existing), then remove stale keys.
    // This avoids a flash where removing all keys first would briefly expose @theme defaults.
    const newKeys = new Set<string>();
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(key, value);
      newKeys.add(key);
    }
    for (const key of appliedKeys) {
      if (!newKeys.has(key)) {
        root.style.removeProperty(key);
      }
    }
    appliedKeys.clear();
    for (const key of newKeys) {
      appliedKeys.add(key);
    }

    // Update theme-color meta tag reactively
    const surfaceColor = colors['--color-surface'] ?? '#0A0908';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', surfaceColor);
    }
  });
}
