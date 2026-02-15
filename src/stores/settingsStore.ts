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
  voiceUri: string;
  voicePitch: number;
  voiceRate: number;
  displayMode: 'dark' | 'outdoor';
}

const SETTINGS_KEY = 'pickle-score-settings';

const DEFAULTS: Settings = {
  defaultScoringMode: 'sideout',
  defaultPointsToWin: 11,
  defaultMatchFormat: 'single',
  scoringUIMode: 'simple',
  keepScreenAwake: true,
  soundEffects: 'off',
  hapticFeedback: false,
  voiceAnnouncements: 'off',
  voiceUri: '',
  voicePitch: 1.0,
  voiceRate: 1.0,
  displayMode: 'dark',
};

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return { ...DEFAULTS, ...JSON.parse(stored) };
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULTS };
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
