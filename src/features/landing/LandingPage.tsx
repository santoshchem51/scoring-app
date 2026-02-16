import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Zap, Clock, Trophy, Activity, Share2, UserPlus } from 'lucide-solid';
import TopNav from '../../shared/components/TopNav';
import Logo from '../../shared/components/Logo';

const LandingPage: Component = () => {
  return (
    <div class="min-h-screen bg-surface text-on-surface">
      <TopNav variant="landing" />

      {/* Hero */}
      <section class="relative px-4 pt-12 pb-16 md:pt-20 md:pb-24 text-center overflow-hidden">
        {/* Aurora gradient background */}
        <div
          class="absolute inset-0 -z-10"
          style={{
            background: "radial-gradient(ellipse at 30% 0%, rgba(34,197,94,0.12), transparent 50%), radial-gradient(ellipse at 70% 0%, rgba(249,115,22,0.08), transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(250,204,21,0.06), transparent 50%)"
          }}
        />
        <div class="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl">
          <div class="flex justify-center mb-6">
            <Logo size="xl" showIcon />
          </div>
          <p
            class="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 text-gradient"
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
              class="inline-block bg-primary text-surface font-semibold px-8 py-3.5 rounded-xl text-lg active:scale-[0.97] transition-all duration-200 hover-glow-primary"
            >
              Start Scoring
            </A>
            <A
              href="/tournaments"
              class="inline-block border-2 border-primary text-primary font-semibold px-8 py-3.5 rounded-xl text-lg active:scale-[0.97] transition-all duration-200 hover-glow-primary"
            >
              Manage Tournaments
            </A>
          </div>
        </div>
      </section>

      {/* Features */}
      <section class="px-4 py-12 md:py-16 bg-surface-light/50">
        <div class="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl">
          <h2
            class="text-xl md:text-2xl font-bold text-center mb-8 text-gradient-subtle"
            style={{ "font-family": "var(--font-score)" }}
          >
            Everything You Need
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-in">
            {FEATURES.map((f) => (
              <div class="bg-surface-light rounded-xl p-5 border border-border transition-all duration-200 hover-lift">
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 text-primary">
                  <f.icon size={20} />
                </div>
                <h3 class="font-bold text-on-surface mb-1 text-sm">{f.title}</h3>
                <p class="text-xs text-on-surface-muted">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section class="px-4 py-12 md:py-16">
        <div class="max-w-lg mx-auto md:max-w-3xl lg:max-w-4xl">
          <h2
            class="text-xl md:text-2xl font-bold text-center mb-8 text-gradient-subtle"
            style={{ "font-family": "var(--font-score)" }}
          >
            How It Works
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
            {STEPS.map((step, i) => (
              <div class="text-center">
                <div class="w-10 h-10 rounded-full bg-primary text-surface font-bold text-lg flex items-center justify-center mx-auto mb-3" style={{ "box-shadow": "0 0 20px rgba(34,197,94,0.3)" }}>
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
      <section class="px-4 py-12 md:py-16 bg-surface-light/50 text-center">
        <div class="max-w-lg mx-auto md:max-w-2xl">
          <h2
            class="text-2xl font-bold mb-4"
            style={{ "font-family": "var(--font-score)" }}
          >
            Ready to play?
          </h2>
          <A
            href="/new"
            class="inline-block bg-primary text-surface font-semibold px-8 py-3.5 rounded-xl text-lg active:scale-[0.97] transition-all duration-200 hover-glow-primary"
          >
            Get Started
          </A>
        </div>
      </section>

      {/* Footer */}
      <footer class="px-4 py-8 text-center border-t border-border">
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

const FEATURES: { title: string; description: string; icon: Component<{ size: number; class?: string }> }[] = [
  {
    title: 'Quick Scoring',
    description: 'One-tap start, swipe to score, works offline court-side.',
    icon: Zap,
  },
  {
    title: 'Match History & Stats',
    description: 'Every game saved, win/loss tracking across all your matches.',
    icon: Clock,
  },
  {
    title: 'Tournament Management',
    description: 'Round-robin, elimination, pool-to-bracket formats with full bracket control.',
    icon: Trophy,
  },
  {
    title: 'Live Real-Time Scores',
    description: 'Point-by-point updates, live standings, spectator views.',
    icon: Activity,
  },
  {
    title: 'Sharing & QR Codes',
    description: 'Public links, QR codes, instant tournament access for anyone.',
    icon: Share2,
  },
  {
    title: 'Player Invitations',
    description: 'Search users, send in-app invites, one-tap accept to join.',
    icon: UserPlus,
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
