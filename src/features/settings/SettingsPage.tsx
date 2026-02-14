import type { Component } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import OptionCard from '../../shared/components/OptionCard';
import { settings, setSettings } from '../../stores/settingsStore';

const SettingsPage: Component = () => {
  return (
    <PageLayout title="Settings">
      <div class="p-4 space-y-6">
        {/* Keep Screen Awake */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
            Screen
          </legend>
          <button
            type="button"
            onClick={() => setSettings({ keepScreenAwake: !settings().keepScreenAwake })}
            class="w-full flex items-center justify-between bg-surface-light rounded-xl p-4"
            role="switch"
            aria-checked={settings().keepScreenAwake}
          >
            <div>
              <div class="font-semibold text-on-surface text-left">Keep Screen Awake</div>
              <div class="text-sm text-on-surface-muted text-left">Prevents screen sleep during scoring</div>
            </div>
            <div
              class={`w-12 h-7 rounded-full transition-colors relative ${
                settings().keepScreenAwake ? 'bg-primary' : 'bg-surface-lighter'
              }`}
            >
              <div
                class={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  settings().keepScreenAwake ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
        </fieldset>

        {/* Sound Effects */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
            Sound Effects
          </legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard
              label="Off"
              selected={settings().soundEffects === 'off'}
              onClick={() => setSettings({ soundEffects: 'off' })}
            />
            <OptionCard
              label="Subtle"
              selected={settings().soundEffects === 'subtle'}
              onClick={() => setSettings({ soundEffects: 'subtle' })}
            />
            <OptionCard
              label="Full"
              selected={settings().soundEffects === 'full'}
              onClick={() => setSettings({ soundEffects: 'full' })}
            />
          </div>
        </fieldset>

        {/* Haptic Feedback */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
            Haptics
          </legend>
          <button
            type="button"
            onClick={() => setSettings({ hapticFeedback: !settings().hapticFeedback })}
            class="w-full flex items-center justify-between bg-surface-light rounded-xl p-4"
            role="switch"
            aria-checked={settings().hapticFeedback}
          >
            <div>
              <div class="font-semibold text-on-surface text-left">Haptic Feedback</div>
              <div class="text-sm text-on-surface-muted text-left">Vibration on score (Android)</div>
            </div>
            <div
              class={`w-12 h-7 rounded-full transition-colors relative ${
                settings().hapticFeedback ? 'bg-primary' : 'bg-surface-lighter'
              }`}
            >
              <div
                class={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  settings().hapticFeedback ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
        </fieldset>

        {/* Default Scoring Mode */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
            Default Scoring
          </legend>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard
              label="Side-Out"
              description="Serving team scores"
              selected={settings().defaultScoringMode === 'sideout'}
              onClick={() => setSettings({ defaultScoringMode: 'sideout' })}
            />
            <OptionCard
              label="Rally"
              description="Point every rally"
              selected={settings().defaultScoringMode === 'rally'}
              onClick={() => setSettings({ defaultScoringMode: 'rally' })}
            />
          </div>
        </fieldset>

        {/* Default Points to Win */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
            Default Points to Win
          </legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="11" selected={settings().defaultPointsToWin === 11} onClick={() => setSettings({ defaultPointsToWin: 11 })} />
            <OptionCard label="15" selected={settings().defaultPointsToWin === 15} onClick={() => setSettings({ defaultPointsToWin: 15 })} />
            <OptionCard label="21" selected={settings().defaultPointsToWin === 21} onClick={() => setSettings({ defaultPointsToWin: 21 })} />
          </div>
        </fieldset>

        {/* Default Match Format */}
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
            Default Match Format
          </legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="1 Game" selected={settings().defaultMatchFormat === 'single'} onClick={() => setSettings({ defaultMatchFormat: 'single' })} />
            <OptionCard label="Best of 3" selected={settings().defaultMatchFormat === 'best-of-3'} onClick={() => setSettings({ defaultMatchFormat: 'best-of-3' })} />
            <OptionCard label="Best of 5" selected={settings().defaultMatchFormat === 'best-of-5'} onClick={() => setSettings({ defaultMatchFormat: 'best-of-5' })} />
          </div>
        </fieldset>

        {/* App Info */}
        <div class="text-center text-xs text-on-surface-muted pt-4">
          <p>PickleScore v1.0</p>
          <p class="mt-1">Offline-first pickleball scoring</p>
        </div>
      </div>
    </PageLayout>
  );
};

export default SettingsPage;
