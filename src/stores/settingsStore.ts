import { createSignal } from 'solid-js';

export type ScoringUIMode = 'simple' | 'detailed';

interface Settings {
  defaultScoringMode: 'sideout' | 'rally';
  defaultPointsToWin: 11 | 15 | 21;
  defaultMatchFormat: 'single' | 'best-of-3' | 'best-of-5';
  scoringUIMode: ScoringUIMode;
  keepScreenAwake: boolean;
  soundEffects: 'off' | 'subtle' | 'full';
  hapticFeedback: boolean;
  voiceAnnouncements: 'off' | 'scores' | 'full';
  displayMode: 'dark' | 'outdoor';
}

const SETTINGS_KEY = 'pickle-score-settings';

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore parse errors
  }
  return {
    defaultScoringMode: 'sideout',
    defaultPointsToWin: 11,
    defaultMatchFormat: 'single',
    scoringUIMode: 'simple',
    keepScreenAwake: true,
    soundEffects: 'off',
    hapticFeedback: false,
    voiceAnnouncements: 'off',
    displayMode: 'dark',
  };
}

const [settings, setSettingsInternal] = createSignal<Settings>(loadSettings());

function setSettings(update: Partial<Settings>) {
  setSettingsInternal((prev) => {
    const next = { ...prev, ...update };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
    return next;
  });
}

export { settings, setSettings };
