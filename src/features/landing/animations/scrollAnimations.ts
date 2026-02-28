import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export interface SectionElements {
  features: HTMLElement;
  steps: HTMLElement;
  tournaments: HTMLElement | null;
  finalCta: HTMLElement;
  heroSection?: HTMLElement;
}

/**
 * Creates a border-trace overlay with conic-gradient for the glow animation.
 * Animated from opacity 0→1 to create a "drawing the border" effect.
 */
function createGlowTrace(card: HTMLElement, accentRgb: string): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'glow-trace';
  overlay.style.cssText = `
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    pointer-events: none;
    z-index: 2;
    opacity: 0;
    border: 2px solid transparent;
    background: conic-gradient(from 0deg, rgba(${accentRgb}, 0.8), rgba(${accentRgb}, 0.3) 30%, transparent 50%) border-box;
    -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  `;
  card.style.position = 'relative';
  card.style.overflow = 'hidden';
  card.appendChild(overlay);
  return overlay;
}

/** Reads the accent RGB from the data attribute or falls back to green */
function getAccentRgb(card: HTMLElement): string {
  return card.getAttribute('data-accent-rgb') ?? '34, 197, 94';
}

export function setupScrollAnimations(sections: SectionElements): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const triggers: ScrollTrigger[] = [];
  const glowOverlays: HTMLElement[] = [];

  // Feature cards: glow border trace + blur-to-sharp materialize
  const featureCards = Array.from(
    sections.features.querySelectorAll(':scope > div > div > div')
  ) as HTMLElement[];

  let heroIndex = 0;
  let compactIdx = 0;

  featureCards.forEach((card) => {
    const isHero = card.classList.contains('lg:col-span-2');
    const accentRgb = getAccentRgb(card);
    const overlay = createGlowTrace(card, accentRgb);
    glowOverlays.push(overlay);

    if (isHero) {
      // Hero cards: blur + scale down, dramatic entrance
      gsap.set(card, { opacity: 0, scale: 0.85, filter: 'blur(8px)' });
      gsap.set(overlay, { opacity: 0 });

      const delay = heroIndex * 0.15;
      heroIndex++;

      triggers.push(
        ScrollTrigger.create({
          trigger: card,
          start: 'top 90%',
          onEnter: () => {
            // Phase 1: Border traces in
            gsap.to(overlay, {
              opacity: 1,
              duration: 0.5,
              delay,
              ease: 'power2.inOut',
              onComplete: () => {
                // Phase 3: Glow pulse then fade
                gsap.to(card, {
                  boxShadow: `0 0 30px rgba(${accentRgb}, 0.3), 0 0 60px rgba(${accentRgb}, 0.1)`,
                  duration: 0.3,
                  ease: 'power2.out',
                  onComplete: () => {
                    gsap.to(card, {
                      boxShadow: '0 0 0px transparent',
                      duration: 0.6,
                      ease: 'power2.inOut',
                    });
                    gsap.to(overlay, { opacity: 0, duration: 0.5, delay: 0.3 });
                  },
                });
              },
            });
            // Phase 2: Card materializes (deblur + scale)
            gsap.to(card, {
              opacity: 1, scale: 1, filter: 'blur(0px)',
              duration: 0.6, ease: 'power2.out',
              delay: delay + 0.15,
            });
          },
          once: true,
        })
      );
    } else {
      // Compact cards: rise + deblur, faster border trace
      const staggerDelay = 0.4 + compactIdx * 0.15;
      compactIdx++;
      gsap.set(card, { opacity: 0, y: 30, scale: 0.9, filter: 'blur(6px)' });
      gsap.set(overlay, { opacity: 0 });

      triggers.push(
        ScrollTrigger.create({
          trigger: card,
          start: 'top 90%',
          onEnter: () => {
            // Border trace (faster for compact)
            gsap.to(overlay, {
              opacity: 1,
              duration: 0.35,
              delay: staggerDelay,
              ease: 'power2.inOut',
              onComplete: () => {
                gsap.to(card, {
                  boxShadow: `0 0 20px rgba(${accentRgb}, 0.25)`,
                  duration: 0.25,
                  ease: 'power2.out',
                  onComplete: () => {
                    gsap.to(card, {
                      boxShadow: '0 0 0px transparent',
                      duration: 0.5,
                      ease: 'power2.inOut',
                    });
                    gsap.to(overlay, { opacity: 0, duration: 0.4, delay: 0.2 });
                  },
                });
              },
            });
            // Card materializes
            gsap.to(card, {
              opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
              duration: 0.5, ease: 'power2.out',
              delay: staggerDelay + 0.1,
            });
          },
          once: true,
        })
      );
    }
  });

  // How It Works: alternate slide from left/right, per-card trigger
  const stepCards = sections.steps.querySelectorAll(':scope > div > div > div');
  stepCards.forEach((card, i) => {
    const fromX = i % 2 === 0 ? -80 : 80;
    gsap.set(card, { opacity: 0, x: fromX });
    triggers.push(
      ScrollTrigger.create({
        trigger: card as HTMLElement,
        start: 'top 85%',
        onEnter: () => {
          gsap.to(card, {
            opacity: 1, x: 0,
            duration: 0.6, ease: 'back.out(1.2)',
            delay: i * 0.15,
          });
        },
        once: true,
      })
    );
  });

  // Final CTA: elastic scale
  gsap.set(sections.finalCta, { opacity: 0, scale: 0.8 });
  triggers.push(
    ScrollTrigger.create({
      trigger: sections.finalCta,
      start: 'top 85%',
      onEnter: () => {
        gsap.to(sections.finalCta, {
          opacity: 1, scale: 1,
          duration: 0.8, ease: 'elastic.out(1, 0.5)',
        });
      },
      once: true,
    })
  );

  // Canvas parallax for hero section
  if (sections.heroSection) {
    const canvas = sections.heroSection.querySelector('canvas');
    if (canvas) {
      triggers.push(
        ScrollTrigger.create({
          trigger: sections.heroSection,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          animation: gsap.to(canvas, { y: -100, ease: 'none' }),
        })
      );
    }
  }

  // Refresh after all triggers are set up
  ScrollTrigger.refresh();

  return () => {
    glowOverlays.forEach(el => {
      const parent = el.parentElement;
      el.remove();
      if (parent) {
        parent.style.overflow = '';
        parent.style.position = '';
      }
    });
    triggers.forEach(t => t.kill());
  };
}
