import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export interface SectionElements {
  features: HTMLElement;
  steps: HTMLElement;
  tournaments: HTMLElement | null;
  finalCta: HTMLElement;
  heroSection?: HTMLElement;
}

export function setupScrollAnimations(sections: SectionElements): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const triggers: ScrollTrigger[] = [];

  // Feature cards: per-card trigger so each reveals when it enters viewport
  const featureCards = sections.features.querySelectorAll(':scope > div > div > div');
  featureCards.forEach((card, i) => {
    gsap.set(card, { opacity: 0, y: 60, scale: 0.85, rotateX: 5 });
    triggers.push(
      ScrollTrigger.create({
        trigger: card as HTMLElement,
        start: 'top 90%',
        onEnter: () => {
          gsap.to(card, {
            opacity: 1, y: 0, scale: 1, rotateX: 0,
            duration: 0.6, ease: 'power3.out',
            delay: i * 0.08,
          });
        },
        once: true,
      })
    );
  });

  // How It Works: alternate slide from left/right, per-card trigger
  const stepCards = sections.steps.querySelectorAll(':scope > div > div');
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
    triggers.forEach(t => t.kill());
  };
}
