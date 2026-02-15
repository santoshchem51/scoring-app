import { createSignal, onMount, Show } from 'solid-js';
import type { Component } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import OptionCard from '../../shared/components/OptionCard';
import Logo from '../../shared/components/Logo';
import { settings, setSettings } from '../../stores/settingsStore';
import { useAuth } from '../../shared/hooks/useAuth';

const SettingsPage: Component = () => {
  const [voices, setVoices] = createSignal<SpeechSynthesisVoice[]>([]);
  const { user, loading: authLoading, syncing, signIn, signOut } = useAuth();

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
            {/* Account */}
            <fieldset>
              <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
                Account
              </legend>
              <div class="bg-surface-light rounded-xl p-4">
                <Show
                  when={!authLoading()}
                  fallback={
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-full bg-surface-lighter animate-pulse" />
                      <div class="skeleton h-4 w-24" />
                    </div>
                  }
                >
                  <Show
                    when={user()}
                    fallback={
                      <div class="flex flex-col gap-3">
                        <p class="text-sm text-on-surface-muted">
                          Sign in to sync matches across devices and join tournaments.
                        </p>
                        <button
                          type="button"
                          onClick={() => signIn()}
                          class="w-full flex items-center justify-center gap-2 bg-white text-gray-800 font-semibold text-sm py-3 rounded-lg active:scale-95 transition-transform shadow-sm"
                        >
                          <svg class="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          Sign in with Google
                        </button>
                      </div>
                    }
                  >
                    <div class="flex items-center gap-3">
                      <Show
                        when={user()?.photoURL}
                        fallback={
                          <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-surface font-bold text-lg">
                            {user()?.displayName?.charAt(0) ?? '?'}
                          </div>
                        }
                      >
                        <img
                          src={user()!.photoURL!}
                          alt=""
                          class="w-10 h-10 rounded-full"
                          referrerpolicy="no-referrer"
                        />
                      </Show>
                      <div class="flex-1 min-w-0">
                        <div class="font-semibold text-on-surface truncate">{user()?.displayName}</div>
                        <div class="text-xs text-on-surface-muted truncate">{user()?.email}</div>
                        <Show when={syncing()}>
                          <div class="text-xs text-primary mt-0.5">Syncing matches...</div>
                        </Show>
                      </div>
                      <button
                        type="button"
                        onClick={() => signOut()}
                        class="text-sm text-on-surface-muted hover:text-on-surface px-3 py-1.5 rounded-lg bg-surface-lighter active:scale-95 transition-transform"
                      >
                        Sign out
                      </button>
                    </div>
                  </Show>
                </Show>
              </div>
            </fieldset>

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
