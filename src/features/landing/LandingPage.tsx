import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import TopNav from '../../shared/components/TopNav';
import Logo from '../../shared/components/Logo';

const LandingPage: Component = () => {
  return (
    <div class="min-h-screen bg-surface text-on-surface">
      <TopNav variant="landing" />

      {/* Hero */}
      <section class="px-4 pt-12 pb-16 md:pt-20 md:pb-24 text-center bg-gradient-to-b from-primary-glow to-transparent">
        <div class="max-w-lg mx-auto md:max-w-2xl">
          <div class="flex justify-center mb-6">
            <Logo size="xl" showIcon />
          </div>
          <p
            class="text-2xl md:text-3xl font-bold text-on-surface mb-3"
            style={{ "font-family": "var(--font-score)" }}
          >
            Score. Organize. Compete.
          </p>
          <p class="text-on-surface-muted text-lg mb-8 max-w-md mx-auto">
            The all-in-one pickleball app for scoring games, managing tournaments, and sharing live results.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <A
              href="/new"
              class="inline-block bg-primary text-surface font-semibold px-8 py-3.5 rounded-xl text-lg active:scale-95 transition-transform"
            >
              Start Scoring
            </A>
            <A
              href="/tournaments"
              class="inline-block border-2 border-primary text-primary font-semibold px-8 py-3.5 rounded-xl text-lg active:scale-95 transition-transform"
            >
              Manage Tournaments
            </A>
          </div>
        </div>
      </section>

      {/* Features */}
      <section class="px-4 py-12 bg-surface-light">
        <div class="max-w-lg mx-auto md:max-w-3xl">
          <h2
            class="text-xl font-bold text-center mb-8"
            style={{ "font-family": "var(--font-score)" }}
          >
            Everything You Need
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div class="bg-surface rounded-xl p-5">
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 text-primary">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d={f.iconPath}
                    />
                  </svg>
                </div>
                <h3 class="font-bold text-on-surface mb-1 text-sm">{f.title}</h3>
                <p class="text-xs text-on-surface-muted">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section class="px-4 py-12">
        <div class="max-w-lg mx-auto md:max-w-3xl">
          <h2
            class="text-xl font-bold text-center mb-8"
            style={{ "font-family": "var(--font-score)" }}
          >
            How It Works
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div class="text-center">
                <div class="w-10 h-10 rounded-full bg-primary text-surface font-bold text-lg flex items-center justify-center mx-auto mb-3">
                  {i + 1}
                </div>
                <h3 class="font-bold text-on-surface mb-1">{step.title}</h3>
                <p class="text-sm text-on-surface-muted">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section class="px-4 py-12 bg-surface-light text-center">
        <div class="max-w-lg mx-auto">
          <h2
            class="text-2xl font-bold mb-4"
            style={{ "font-family": "var(--font-score)" }}
          >
            Ready to play?
          </h2>
          <A
            href="/new"
            class="inline-block bg-primary text-surface font-semibold px-8 py-3.5 rounded-xl text-lg active:scale-95 transition-transform"
          >
            Get Started
          </A>
        </div>
      </section>

      {/* Footer */}
      <footer class="px-4 py-8 text-center">
        <Logo size="sm" />
        <p class="text-xs text-on-surface-muted mt-2">
          Built for pickleball players and organizers
        </p>
        <p class="text-xs text-on-surface-muted mt-1">
          Install as an app from your browser menu
        </p>
      </footer>
    </div>
  );
};

/* ─── Static Data ─────────────────────────────────────────── */

const FEATURES = [
  {
    title: 'Quick Scoring',
    description: 'One-tap start, swipe to score, works offline court-side.',
    iconPath: 'M12 4v16m8-8H4',
  },
  {
    title: 'Match History & Stats',
    description: 'Every game saved, win/loss tracking across all your matches.',
    iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'Tournament Management',
    description: 'Round-robin, elimination, pool-to-bracket formats with full bracket control.',
    iconPath: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  },
  {
    title: 'Live Real-Time Scores',
    description: 'Point-by-point updates, live standings, spectator views.',
    iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    title: 'Sharing & QR Codes',
    description: 'Public links, QR codes, instant tournament access for anyone.',
    iconPath: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
  },
  {
    title: 'Player Invitations',
    description: 'Search users, send in-app invites, one-tap accept to join.',
    iconPath: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  },
];

const STEPS = [
  {
    title: 'Score',
    description: 'Tap to score, swipe to undo. Works offline.',
  },
  {
    title: 'Organize',
    description: 'Create tournaments, invite players, manage brackets.',
  },
  {
    title: 'Share',
    description: 'QR codes, live links, real-time spectator views.',
  },
];

export default LandingPage;
