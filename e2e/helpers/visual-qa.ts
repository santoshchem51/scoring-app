import type { Page, TestInfo } from '@playwright/test';
import { captureScreen } from './screenshots';

// Duplicated from src/stores/settingsStore.ts — keep in sync
export type Theme = 'court-vision-gold' | 'classic' | 'ember';
export type DisplayMode = 'dark' | 'outdoor';

const SETTINGS_KEY = 'pickle-score-settings';

/**
 * Injects theme/displayMode into localStorage via addInitScript.
 * Must be called BEFORE page.goto() — runs before any app JS executes.
 * Note: addInitScript persists for the page lifetime, so subsequent
 * navigations will also use this theme. Use separate tests for different themes.
 */
export async function setTheme(page: Page, theme: Theme, displayMode: DisplayMode) {
  await page.addInitScript(([key, t, m]) => {
    const raw = localStorage.getItem(key);
    const settings = raw ? JSON.parse(raw) : {};
    settings.theme = t;
    settings.displayMode = m;
    localStorage.setItem(key, JSON.stringify(settings));
  }, [SETTINGS_KEY, theme, displayMode]);
}

export const VIEWPORTS = {
  portrait393: { width: 393, height: 851 },
  portrait375: { width: 375, height: 667 },
  landscape: { width: 851, height: 393 },
} as const;

/**
 * Captures the current page at multiple viewports, resetting to portrait393 after.
 */
export async function captureAtViewports(
  page: Page,
  testInfo: TestInfo,
  baseName: string,
  viewports: Array<keyof typeof VIEWPORTS>,
) {
  for (const vp of viewports) {
    await page.setViewportSize(VIEWPORTS[vp]);
    await captureScreen(page, testInfo, `${baseName}-${vp}`);
  }
  await page.setViewportSize(VIEWPORTS.portrait393);
}

/**
 * Build a consistent screenshot name.
 * Pattern: {category}/{screen}-{state}-{viewport}-{theme}-{mode}
 */
export function screenshotName(
  category: string,
  screen: string,
  state: string,
  viewport: string,
  theme: string,
  mode: string,
) {
  return `${category}/${screen}-${state}-${viewport}-${theme}-${mode}`;
}

/**
 * Mock the PWA beforeinstallprompt event.
 * Call before page.goto(). Dispatches the event after page load.
 */
export async function mockPwaInstallPrompt(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const event = new Event('beforeinstallprompt');
        (event as any).prompt = () => Promise.resolve();
        (event as any).userChoice = Promise.resolve({ outcome: 'accepted' });
        window.dispatchEvent(event);
      }, 500);
    });
  });
}

/**
 * Mock a service worker update being available.
 * Call before page.goto().
 */
export async function mockPwaUpdateAvailable(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('sw-update-available'));
      }, 500);
    });
  });
}
