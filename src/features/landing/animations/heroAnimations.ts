import { gsap } from 'gsap';

export interface HeroElements {
  logo: HTMLElement;
  headline: HTMLElement;
  subtext: HTMLElement;
  ctas: HTMLElement;
  card: HTMLElement;
  headlineWords: HTMLElement[];
}

export function createHeroEntrance(els: HeroElements) {
  const tl = gsap.timeline({ delay: 0.1 });

  // Glass card scales in with overshoot
  gsap.set(els.card, { opacity: 0, scale: 0.85 });
  tl.to(els.card, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.4)' });

  // Logo drops with bounce
  gsap.set(els.logo, { opacity: 0, y: -30 });
  tl.to(els.logo, { opacity: 1, y: 0, duration: 0.4, ease: 'bounce.out' }, 0.2);

  // Headline words animate individually
  gsap.set(els.headlineWords, { opacity: 0, y: 30, rotateX: 10 });
  tl.to(els.headlineWords, {
    opacity: 1, y: 0, rotateX: 0,
    duration: 0.3, ease: 'power3.out',
    stagger: 0.08,
  }, 0.4);

  // Subtext fades
  gsap.set(els.subtext, { opacity: 0, y: 20 });
  tl.to(els.subtext, { opacity: 1, y: 0, duration: 0.3 }, 0.9);

  // CTAs spring in
  gsap.set(els.ctas.children, { opacity: 0, scale: 0.8 });
  tl.to(els.ctas.children, {
    opacity: 1, scale: 1,
    duration: 0.4, ease: 'elastic.out(1, 0.5)',
    stagger: 0.15,
  }, 1.1);

  return tl;
}
