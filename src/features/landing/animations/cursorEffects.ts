import { gsap } from 'gsap';

/**
 * Adds a cursor-following radial glow inside the hero glass card.
 * Creates an absolutely-positioned div with a radial gradient that
 * follows the mouse pointer.
 */
export function setupCardSpotlight(card: HTMLElement): () => void {
  // Create spotlight element
  const spotlight = document.createElement('div');
  spotlight.style.cssText = `
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s;
    z-index: 0;
  `;
  card.style.position = 'relative';
  card.style.overflow = 'hidden';
  card.insertBefore(spotlight, card.firstChild);

  // Ensure card content stays above spotlight
  Array.from(card.children).forEach((child) => {
    if (child !== spotlight && child instanceof HTMLElement) {
      child.style.position = 'relative';
      child.style.zIndex = '1';
    }
  });

  let rect: DOMRect;

  const onEnter = () => {
    rect = card.getBoundingClientRect();
    spotlight.style.opacity = '1';
  };

  const onMove = (e: MouseEvent) => {
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spotlight.style.background = `radial-gradient(600px circle at ${x}px ${y}px, rgba(34, 197, 94, 0.08), rgba(249, 115, 22, 0.04) 40%, transparent 70%)`;
  };

  const onLeave = () => {
    spotlight.style.opacity = '0';
  };

  card.addEventListener('mouseenter', onEnter);
  card.addEventListener('mousemove', onMove);
  card.addEventListener('mouseleave', onLeave);

  return () => {
    card.removeEventListener('mouseenter', onEnter);
    card.removeEventListener('mousemove', onMove);
    card.removeEventListener('mouseleave', onLeave);
    spotlight.remove();
  };
}

/**
 * Magnetic effect on CTA buttons -- buttons subtly pull toward cursor on hover.
 */
export function setupMagneticButtons(container: HTMLElement): () => void {
  const buttons = Array.from(container.children) as HTMLElement[];
  const cleanups: (() => void)[] = [];

  for (const btn of buttons) {
    let rect: DOMRect;

    const onEnter = () => {
      rect = btn.getBoundingClientRect();
    };

    const onMove = (e: MouseEvent) => {
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) * 0.15;
      const dy = (e.clientY - cy) * 0.15;
      gsap.to(btn, { x: dx, y: dy, duration: 0.3, ease: 'power2.out' });
    };

    const onLeave = () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    };

    btn.addEventListener('mouseenter', onEnter);
    btn.addEventListener('mousemove', onMove);
    btn.addEventListener('mouseleave', onLeave);

    cleanups.push(() => {
      btn.removeEventListener('mouseenter', onEnter);
      btn.removeEventListener('mousemove', onMove);
      btn.removeEventListener('mouseleave', onLeave);
      gsap.set(btn, { x: 0, y: 0 });
    });
  }

  return () => cleanups.forEach(fn => fn());
}

/**
 * Cursor-following glow on feature cards.
 */
export function setupCardGlow(container: HTMLElement): () => void {
  const cards = Array.from(container.querySelectorAll(':scope > div > div > div')) as HTMLElement[];
  const cleanups: (() => void)[] = [];

  for (const card of cards) {
    card.style.position = 'relative';
    card.style.overflow = 'hidden';

    const glow = document.createElement('div');
    glow.style.cssText = `
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    card.insertBefore(glow, card.firstChild);

    // Push content above glow
    Array.from(card.children).forEach((child) => {
      if (child !== glow && child instanceof HTMLElement) {
        child.style.position = 'relative';
        child.style.zIndex = '1';
      }
    });

    let rect: DOMRect;

    const onEnter = () => {
      rect = card.getBoundingClientRect();
      glow.style.opacity = '1';
    };

    const onMove = (e: MouseEvent) => {
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      glow.style.background = `radial-gradient(300px circle at ${x}px ${y}px, rgba(34, 197, 94, 0.1), transparent 70%)`;
    };

    const onLeave = () => {
      glow.style.opacity = '0';
    };

    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);

    cleanups.push(() => {
      card.removeEventListener('mouseenter', onEnter);
      card.removeEventListener('mousemove', onMove);
      card.removeEventListener('mouseleave', onLeave);
      glow.remove();
    });
  }

  return () => cleanups.forEach(fn => fn());
}
