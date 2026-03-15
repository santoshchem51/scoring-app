import { createRenderEffect } from 'solid-js';
import { settings } from '../../stores/settingsStore';
import { THEMES } from '../constants/themes';

/** Track which CSS custom properties we've set so we can clean them up on switch */
const appliedKeys = new Set<string>();

export function useTheme(): void {
  createRenderEffect(() => {
    const theme = THEMES[settings().theme];
    if (!theme) return;
    const isOutdoor = settings().displayMode === 'outdoor';
    const colors = isOutdoor ? theme.outdoorColors : theme.colors;

    const root = document.documentElement;

    // Remove previously applied properties to prevent stale values
    for (const key of appliedKeys) {
      root.style.removeProperty(key);
    }
    appliedKeys.clear();

    // Apply new theme properties
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(key, value);
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
