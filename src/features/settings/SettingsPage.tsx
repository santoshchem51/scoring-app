import { createSignal, onMount, Show } from 'solid-js';
import type { Component } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import OptionCard from '../../shared/components/OptionCard';
import Logo from '../../shared/components/Logo';
import { settings, setSettings } from '../../stores/settingsStore';

const SettingsPage: Component = () => {
  const [voices, setVoices] = createSignal<SpeechSynthesisVoice[]>([]);

  onMount(() => {
    if (!('speechSynthesis' in window)) return;
    const load = () => setVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
  });

  const testVoice = () => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance('3, 5, 2');
    utt.rate = settings().voiceRate;
    utt.pitch = settings().voicePitch;
    utt.volume = 0.8;
    const uri = settings().voiceUri;
    if (uri) {
      const match = voices().find((v) => v.voiceURI === uri);
      if (match) utt.voice = match;
    }
    speechSynthesis.speak(utt);
  };

  return (
    <PageLayout title="Settings">
      <div class="p-4">
        <div class="md:grid md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
          {/* Left column */}
          <div class="space-y-6">
            {/* Display Mode */}
            <fieldset>
              <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
                Display
              </legend>
              <div class="grid grid-cols-2 gap-3">
                <OptionCard
                  label="Dark"
                  description="Indoor / night"
                  selected={settings().displayMode === 'dark'}
                  onClick={() => setSettings({ displayMode: 'dark' })}
                />
                <OptionCard
                  label="Outdoor"
                  description="Bright / sunlight"
                  selected={settings().displayMode === 'outdoor'}
                  onClick={() => setSettings({ displayMode: 'outdoor' })}
                />
              </div>
            </fieldset>

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

            {/* Voice Announcements */}
            <fieldset>
              <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
                Voice
              </legend>
              <div class="grid grid-cols-3 gap-3">
                <OptionCard
                  label="Off"
                  selected={settings().voiceAnnouncements === 'off'}
                  onClick={() => setSettings({ voiceAnnouncements: 'off' })}
                />
                <OptionCard
                  label="Scores"
                  selected={settings().voiceAnnouncements === 'scores'}
                  onClick={() => setSettings({ voiceAnnouncements: 'scores' })}
                />
                <OptionCard
                  label="Full"
                  selected={settings().voiceAnnouncements === 'full'}
                  onClick={() => setSettings({ voiceAnnouncements: 'full' })}
                />
              </div>

              <Show when={settings().voiceAnnouncements !== 'off'}>
                <div class="mt-4 space-y-4 bg-surface-light rounded-xl p-4">
                  {/* Voice picker */}
                  <div>
                    <label class="block text-sm font-medium text-on-surface mb-1" for="voice-select">Voice</label>
                    <select
                      id="voice-select"
                      value={settings().voiceUri}
                      onChange={(e) => setSettings({ voiceUri: e.currentTarget.value })}
                      class="w-full bg-surface text-on-surface rounded-lg px-3 py-2 text-sm border border-surface-lighter"
                    >
                      <option value="">System Default</option>
                      {voices().map((v) => (
                        <option value={v.voiceURI}>
                          {v.name} {v.lang ? `(${v.lang})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Speed slider */}
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-sm font-medium text-on-surface" for="voice-rate">Speed</label>
                      <span class="text-xs text-on-surface-muted tabular-nums">{settings().voiceRate.toFixed(1)}x</span>
                    </div>
                    <input
                      id="voice-rate"
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={settings().voiceRate}
                      onInput={(e) => setSettings({ voiceRate: parseFloat(e.currentTarget.value) })}
                      class="w-full accent-primary"
                    />
                  </div>

                  {/* Pitch slider */}
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-sm font-medium text-on-surface" for="voice-pitch">Pitch</label>
                      <span class="text-xs text-on-surface-muted tabular-nums">{settings().voicePitch.toFixed(1)}</span>
                    </div>
                    <input
                      id="voice-pitch"
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={settings().voicePitch}
                      onInput={(e) => setSettings({ voicePitch: parseFloat(e.currentTarget.value) })}
                      class="w-full accent-primary"
                    />
                  </div>

                  {/* Test button */}
                  <button
                    type="button"
                    onClick={testVoice}
                    class="w-full bg-surface-lighter text-on-surface font-semibold text-sm py-2.5 rounded-lg active:scale-95 transition-transform"
                  >
                    Test Voice
                  </button>
                </div>
              </Show>
            </fieldset>
          </div>

          {/* Right column */}
          <div class="space-y-6">
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
          </div>
        </div>

        {/* App Info */}
        <div class="flex flex-col items-center gap-2 pt-8">
          <Logo size="md" />
          <p class="text-xs text-on-surface-muted">v1.0 — Offline-first pickleball scoring</p>
        </div>
      </div>
    </PageLayout>
  );
};

export default SettingsPage;
