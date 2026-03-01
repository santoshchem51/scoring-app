import { test, expect } from '@playwright/test';
import { GameSetupPage } from '../pages/GameSetupPage';
import { ScoringPage } from '../pages/ScoringPage';
import { NavigationBar } from '../pages/NavigationBar';

test.describe('Device Features (Manual Plan 1.3)', () => {
  let setup: GameSetupPage;
  let scoring: ScoringPage;

  // ── Wake Lock Tests ──

  test('wake lock requested when scoring starts', async ({ page }) => {
    // Mock navigator.wakeLock BEFORE navigation
    await page.addInitScript(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      (window as any).__wakeLockRequests = [];
      (window as any).__wakeLockReleases = [];
      Object.defineProperty(navigator, 'wakeLock', {
        value: {
          request: async (type: any) => {
            (window as any).__wakeLockRequests.push(type);
            const sentinel = {
              type,
              released: false,
              release: async () => {
                sentinel.released = true;
                (window as any).__wakeLockReleases.push(type);
              },
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => true,
            };
            return sentinel;
          },
        },
        configurable: true,
      });
    });

    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);

    await setup.goto();
    // keepScreenAwake defaults to true, so no settings change needed
    await setup.quickGame();
    await scoring.expectOnScoringScreen();

    // Verify wake lock was requested
    const requests = await page.evaluate(() => (window as any).__wakeLockRequests);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests).toContain('screen');
  });

  test('wake lock released when navigating away', async ({ page }) => {
    // Mock navigator.wakeLock BEFORE navigation
    await page.addInitScript(() => {
      (window as any).__wakeLockRequests = [];
      (window as any).__wakeLockReleases = [];
      Object.defineProperty(navigator, 'wakeLock', {
        value: {
          request: async (type: any) => {
            (window as any).__wakeLockRequests.push(type);
            const sentinel = {
              type,
              released: false,
              release: async () => {
                sentinel.released = true;
                (window as any).__wakeLockReleases.push(type);
              },
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => true,
            };
            return sentinel;
          },
        },
        configurable: true,
      });
    });

    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);
    const nav = new NavigationBar(page);

    await setup.goto();
    await setup.quickGame();
    await scoring.expectOnScoringScreen();

    // Confirm wake lock was acquired
    const requestsBefore = await page.evaluate(() => (window as any).__wakeLockRequests);
    expect(requestsBefore.length).toBeGreaterThan(0);

    // Navigate away — app shows a leave confirmation dialog for active games
    await nav.goToHistory();

    // Confirm leaving the active game.
    // The dialog is a bottom-sheet that overlaps the fixed nav bar on mobile viewport,
    // so we use a JS click to bypass Playwright's pointer-intercept check.
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /leave/i }).evaluate((btn) => (btn as HTMLButtonElement).click());

    // Wait for navigation to complete after confirming leave
    await expect(page).toHaveURL(/\/history/);

    // Verify wake lock was released via onCleanup
    const releases = await page.evaluate(() => (window as any).__wakeLockReleases);
    expect(releases.length).toBeGreaterThan(0);
    expect(releases).toContain('screen');
  });

  // ── Voice Announcement Tests ──

  test('voice announces score when enabled', async ({ page }) => {
    // Mock speechSynthesis BEFORE navigation
    await page.addInitScript(() => {
      (window as any).__speechCalls = [];
      (window as any).SpeechSynthesisUtterance = class {
        text: any;
        rate = 1;
        pitch = 1;
        volume = 0.8;
        voice: any = null;
        constructor(text: any) {
          this.text = text;
        }
      };
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          speak: (utterance: any) => {
            (window as any).__speechCalls.push(utterance.text);
          },
          cancel: () => {},
          getVoices: () => [],
          speaking: false,
          pending: false,
          paused: false,
          addEventListener: () => {},
          removeEventListener: () => {},
          onvoiceschanged: null,
          dispatchEvent: () => true,
        },
        configurable: true,
      });
    });

    // Enable voice announcements via localStorage BEFORE app loads settings
    await page.addInitScript(() => {
      localStorage.setItem('pickle-score-settings', JSON.stringify({
        voiceAnnouncements: 'scores',
      }));
    });

    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);

    await setup.goto();
    await setup.quickGame();
    await scoring.expectOnScoringScreen();

    // Score a point
    await scoring.scorePoint('Team 1');
    await scoring.expectScore('1-0-2');

    // Allow time for the speech call to be processed
    await page.waitForTimeout(500);

    // Verify speechSynthesis.speak() was called with score text
    const speechCalls: string[] = await page.evaluate(() => (window as any).__speechCalls);
    expect(speechCalls.length).toBeGreaterThan(0);
    // In sideout doubles mode, score is announced as "serving receiving server"
    // After Team 1 scores: serving=1, score = 1 0 2, so announcement contains "1" and "0"
    expect(speechCalls.some((text) => text.includes('1') && text.includes('0'))).toBe(true);
  });

  // ── Sound Effects Tests ──

  test('sound effects play when enabled', async ({ page }) => {
    // Mock AudioContext BEFORE navigation
    await page.addInitScript(() => {
      (window as any).__audioContextCalls = [];
      (window as any).__oscillatorsCreated = 0;

      class MockAudioContext {
        currentTime = 0;
        destination = {};
        createOscillator() {
          (window as any).__oscillatorsCreated++;
          (window as any).__audioContextCalls.push('createOscillator');
          return {
            frequency: { value: 0 },
            type: 'sine',
            connect: () => {},
            start: () => {},
            stop: () => {},
          };
        }
        createGain() {
          (window as any).__audioContextCalls.push('createGain');
          return {
            gain: {
              value: 0,
              exponentialRampToValueAtTime: () => {},
            },
            connect: () => {},
          };
        }
      }

      (window as any).AudioContext = MockAudioContext;
    });

    // Enable sound effects via localStorage
    await page.addInitScript(() => {
      localStorage.setItem('pickle-score-settings', JSON.stringify({
        soundEffects: 'full',
      }));
    });

    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);

    await setup.goto();
    await setup.quickGame();
    await scoring.expectOnScoringScreen();

    // Score a point — this triggers sounds.scorePoint() in ScoreControls
    await scoring.scorePoint('Team 1');
    await scoring.expectScore('1-0-2');

    // Verify AudioContext was used (oscillator created)
    const oscillatorsCreated = await page.evaluate(() => (window as any).__oscillatorsCreated);
    expect(oscillatorsCreated).toBeGreaterThan(0);

    const audioCalls: string[] = await page.evaluate(() => (window as any).__audioContextCalls);
    expect(audioCalls).toContain('createOscillator');
    expect(audioCalls).toContain('createGain');
  });
});

// Manual-only tests (cannot be automated):
// - Haptic feedback (requires physical device)
// - Voice picker dropdown (requires real speechSynthesis voices)
// - Rate/pitch sliders (UI adjustment, requires audio verification)
