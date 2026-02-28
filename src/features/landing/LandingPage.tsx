import type { Component } from 'solid-js';
import { createResource, Show, For, onMount, onCleanup } from 'solid-js';
import { A } from '@solidjs/router';
import { Zap, Clock, Trophy, Activity, Share2, UserPlus } from 'lucide-solid';
import TopNav from '../../shared/components/TopNav';
import Logo from '../../shared/components/Logo';
import { InteractiveBackground } from '../../shared/canvas';
import { tilt } from '../../shared/directives/tilt';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { filterPublicTournaments } from '../tournaments/engine/discoveryFilters';
import { formatLabels } from '../tournaments/constants';

const _tilt = tilt; // prevent tree-shaking

function TournamentPreview() {
  const [upcoming] = createResource(async () => {
    try {
      const result = await firestoreTournamentRepository.getPublicTournaments(10);
      return filterPublicTournaments(result.tournaments, { status: 'upcoming' }).slice(0, 5);
    } catch {
      return [];
    }
  });

  return (
    <Show when={upcoming() && upcoming()!.length > 0}>
      <section class="px-4 py-12 md:py-16">
        <div class="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl">
          <h2
            class="text-xl md:text-2xl font-bold text-center mb-2 text-gradient-subtle"
            style={{ "font-family": "var(--font-score)" }}
          >
            Upcoming Tournaments
          </h2>
          <p class="text-center text-on-surface-muted text-sm mb-6">
            Find and join public tournaments near you
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <For each={upcoming()}>
              {(t) => (
                <A
                  href={t.shareCode ? `/t/${t.shareCode}` : `/tournaments/${t.id}`}
                  class="block bg-surface-light rounded-xl p-4 border border-border hover-lift transition-all duration-200"
                >
                  <h3 class="font-bold text-on-surface truncate mb-1">{t.name}</h3>
                  <div class="text-sm text-on-surface-muted">
                    {new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {t.location ? ` · ${t.location}` : ''}
                  </div>
                  <span class="inline-block mt-2 text-xs font-semibold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full">
                    {formatLabels[t.format] ?? t.format}
                  </span>
                </A>
              )}
            </For>
          </div>
          <div class="text-center mt-4">
            <A
              href="/tournaments"
              class="text-primary text-sm font-semibold hover:underline"
            >
              Browse All Tournaments →
            </A>
          </div>
        </div>
      </section>
    </Show>
  );
}

const LandingPage: Component = () => {
  let logoEl!: HTMLElement;
  let headlineEl!: HTMLElement;
  let subtextEl!: HTMLElement;
  let ctasEl!: HTMLElement;
  let cardEl!: HTMLElement;
  let word1El!: HTMLElement;
  let word2El!: HTMLElement;
  let word3El!: HTMLElement;
  let heroSectionEl!: HTMLElement;
  let featuresEl!: HTMLElement;
  let stepsEl!: HTMLElement;
  let finalCtaEl!: HTMLElement;

  onMount(async () => {
    const { initLenis } = await import('./animations');
    const { createHeroEntrance } = await import('./animations/heroAnimations');
    const { setupScrollAnimations } = await import('./animations/scrollAnimations');
    const lenisCleanup = initLenis();
    const heroTl = createHeroEntrance({
      logo: logoEl,
      headline: headlineEl,
      subtext: subtextEl,
      ctas: ctasEl,
      card: cardEl,
      headlineWords: [word1El, word2El, word3El],
    });
    const scrollCleanup = setupScrollAnimations({
      features: featuresEl,
      steps: stepsEl,
      tournaments: null,
      finalCta: finalCtaEl,
      heroSection: heroSectionEl,
    });
    const { setupCardSpotlight, setupMagneticButtons, setupCardGlow } = await import('./animations/cursorEffects');
    const spotlightCleanup = setupCardSpotlight(cardEl);
    const magneticCleanup = setupMagneticButtons(ctasEl);
    const cardGlowCleanup = setupCardGlow(featuresEl);
    onCleanup(() => {
      heroTl.kill();
      lenisCleanup();
      scrollCleanup();
      spotlightCleanup();
      magneticCleanup();
      cardGlowCleanup();
    });
  });

  return (
    <div class="min-h-screen bg-surface text-on-surface">
      <TopNav variant="landing" />

      {/* Hero */}
      <section ref={heroSectionEl} class="relative px-4 pt-12 pb-16 md:pt-20 md:pb-24 text-center overflow-hidden">
        <InteractiveBackground mode="animated" />
        <div ref={cardEl} class="relative z-10 max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl rounded-2xl px-8 py-10 backdrop-blur-md border border-white/5" style={{ "background": "rgba(15, 17, 24, 0.5)" }}>
          <div ref={logoEl} class="flex justify-center mb-6">
            <Logo size="xl" showIcon />
          </div>
          <p ref={headlineEl} class="text-2xl md:text-3xl lg:text-4xl font-bold mb-3" style={{ "font-family": "var(--font-score)" }}>
            <span ref={word1El} class="inline-block text-gradient">Score.&nbsp;</span>
            <span ref={word2El} class="inline-block text-gradient">Organize.&nbsp;</span>
            <span ref={word3El} class="inline-block text-gradient">Compete.</span>
          </p>
          <p ref={subtextEl} class="text-on-surface-muted text-lg mb-8 max-w-md mx-auto">
            The all-in-one pickleball app for scoring games, managing tournaments, and sharing live results.
          </p>
          <div ref={ctasEl} class="flex flex-col sm:flex-row gap-3 justify-center">
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

      {/* Divider */}
      <div class="h-px mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl" style={{ "background": "linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.3), rgba(249, 115, 22, 0.2), transparent)" }} />

      {/* Features */}
      <section ref={featuresEl} class="px-4 py-12 md:py-16 bg-surface-light/50">
        <div class="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl">
          <h2
            class="text-xl md:text-2xl font-bold text-center mb-8 text-gradient-animated"
            style={{ "font-family": "var(--font-score)" }}
          >
            Everything You Need
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-auto">
            <For each={FEATURES}>{(f) => (
              <div
                use:tilt={{ maxDeg: f.hero ? 4 : 6, scale: 1.0 }}
                class={`bg-surface-light rounded-xl border border-border transition-all duration-300 hover-lift ${f.hero ? 'lg:col-span-2 p-6 sm:p-8' : 'p-5'}`}
                style={{
                  "transition-property": "transform, box-shadow, background-color, border-color",
                  "--card-accent": `rgba(${f.accentRgb}, 0.1)`,
                  "--card-accent-border": `rgba(${f.accentRgb}, 0.25)`,
                }}
                onMouseEnter={(e: MouseEvent) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.backgroundColor = `rgba(${f.accentRgb}, 0.08)`;
                  el.style.borderColor = `rgba(${f.accentRgb}, 0.25)`;
                }}
                onMouseLeave={(e: MouseEvent) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.backgroundColor = '';
                  el.style.borderColor = '';
                }}
              >
                <div
                  class={`rounded-lg flex items-center justify-center ${f.hero ? 'w-14 h-14 mb-4' : 'w-10 h-10 mb-3'}`}
                  style={{ "background": `rgba(${f.accentRgb}, 0.1)`, "color": `rgba(${f.accentRgb}, 1)` }}
                >
                  <f.icon size={f.hero ? 28 : 20} />
                </div>
                <h3 class={`font-bold text-on-surface ${f.hero ? 'text-lg mb-2' : 'text-sm mb-1'}`}>{f.title}</h3>
                <p class={`text-on-surface-muted ${f.hero ? 'text-sm' : 'text-xs'}`}>{f.description}</p>
              </div>
            )}</For>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div class="h-px mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl" style={{ "background": "linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.3), rgba(249, 115, 22, 0.2), transparent)" }} />

      {/* How It Works */}
      <section ref={stepsEl} class="px-4 py-12 md:py-16">
        <div class="max-w-lg mx-auto md:max-w-3xl lg:max-w-4xl">
          <h2
            class="text-xl md:text-2xl font-bold text-center mb-8 text-gradient-animated"
            style={{ "font-family": "var(--font-score)" }}
          >
            How It Works
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
            <For each={STEPS}>{(step, i) => (
              <div use:tilt={{ maxDeg: 4, scale: 1.0 }} class="text-center" style={{ "transition": "transform 0.3s ease-out" }}>
                <div class="w-10 h-10 rounded-full bg-primary text-surface font-bold text-lg flex items-center justify-center mx-auto mb-3" style={{ "box-shadow": "0 0 20px rgba(34,197,94,0.3)" }}>
                  {i() + 1}
                </div>
                <h3 class="font-bold text-on-surface mb-1">{step.title}</h3>
                <p class="text-sm text-on-surface-muted">{step.description}</p>
              </div>
            )}</For>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div class="h-px mx-auto max-w-lg md:max-w-3xl lg:max-w-5xl" style={{ "background": "linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.3), rgba(249, 115, 22, 0.2), transparent)" }} />

      {/* Upcoming Tournaments */}
      <TournamentPreview />

      {/* Final CTA */}
      <section ref={finalCtaEl} class="px-4 py-12 md:py-16 bg-surface-light/50 text-center">
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

interface Feature {
  title: string;
  description: string;
  icon: Component<{ size: number; class?: string }>;
  accent: string;       // Tailwind color for icon bg/border hover
  accentRgb: string;    // RGB for hover glow
  hero?: boolean;       // Large bento card
}

const FEATURES: Feature[] = [
  {
    title: 'Quick Scoring',
    description: 'One-tap start, swipe to score, works offline court-side. Get your game going in seconds — no setup, no accounts, just play.',
    icon: Zap,
    accent: 'emerald',
    accentRgb: '34, 197, 94',
    hero: true,
  },
  {
    title: 'Match History & Stats',
    description: 'Every game saved automatically. Track wins, losses, and streaks across all your matches with detailed breakdowns.',
    icon: Clock,
    accent: 'amber',
    accentRgb: '245, 158, 11',
    hero: true,
  },
  {
    title: 'Tournament Management',
    description: 'Round-robin, elimination, pool-to-bracket formats with full bracket control.',
    icon: Trophy,
    accent: 'violet',
    accentRgb: '139, 92, 246',
  },
  {
    title: 'Live Real-Time Scores',
    description: 'Point-by-point updates, live standings, spectator views.',
    icon: Activity,
    accent: 'cyan',
    accentRgb: '6, 182, 212',
  },
  {
    title: 'Sharing & QR Codes',
    description: 'Public links, QR codes, instant tournament access for anyone.',
    icon: Share2,
    accent: 'orange',
    accentRgb: '249, 115, 22',
  },
  {
    title: 'Player Invitations',
    description: 'Search users, send in-app invites, one-tap accept to join.',
    icon: UserPlus,
    accent: 'rose',
    accentRgb: '244, 63, 94',
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
