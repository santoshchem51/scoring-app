import confetti from 'canvas-confetti';
import { useSoundEffects } from './useSoundEffects';
import { settings } from '../../stores/settingsStore';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useCelebration() {
  const sounds = useSoundEffects();

  const gameWin = (teamColor: string) => {
    // Sound (always, if enabled)
    sounds.gameWin();

    // Haptic burst: double buzz
    if (settings().hapticFeedback) {
      try { navigator.vibrate([50, 30, 50]); } catch {}
    }

    // Visual (skip if reduced motion)
    if (prefersReducedMotion()) return;

    // Screen flash
    const flash = document.createElement('div');
    flash.style.cssText = `position:fixed;inset:0;z-index:45;pointer-events:none;background:${teamColor};opacity:0;transition:opacity 150ms;`;
    document.body.appendChild(flash);
    requestAnimationFrame(() => { flash.style.opacity = '0.2'; });
    setTimeout(() => { flash.style.opacity = '0'; }, 150);
    setTimeout(() => { flash.remove(); }, 400);

    // Confetti burst from bottom center
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { x: 0.5, y: 1 },
      colors: [teamColor, '#facc15', '#ffffff'],
      disableForReducedMotion: true,
    });
  };

  const matchWin = (team1Color: string, team2Color: string) => {
    // Sound: fanfare
    const level = settings().soundEffects;
    if (level !== 'off') {
      try {
        const ctx = new AudioContext();
        const notes = [523, 659, 784, 1047];
        const durations = [0.12, 0.12, 0.12, 0.3];
        let time = ctx.currentTime;
        const vol = level === 'subtle' ? 0.1 : 0.3;
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.value = vol;
          gain.gain.exponentialRampToValueAtTime(0.001, time + durations[i]);
          osc.start(time);
          osc.stop(time + durations[i]);
          time += durations[i] * 0.85;
        });
      } catch {}
    }

    // Haptic: triple buzz crescendo
    if (settings().hapticFeedback) {
      try { navigator.vibrate([50, 30, 50, 30, 100]); } catch {}
    }

    if (prefersReducedMotion()) return;

    // Screen flash
    const flash = document.createElement('div');
    flash.style.cssText = `position:fixed;inset:0;z-index:45;pointer-events:none;background:${team1Color};opacity:0;transition:opacity 150ms;`;
    document.body.appendChild(flash);
    requestAnimationFrame(() => { flash.style.opacity = '0.2'; });
    setTimeout(() => { flash.style.opacity = '0'; }, 200);
    setTimeout(() => { flash.remove(); }, 500);

    // Double confetti burst from both sides
    const colors = [team1Color, team2Color, '#facc15', '#ffffff'];
    confetti({ particleCount: 80, spread: 60, origin: { x: 0.2, y: 0.9 }, colors, disableForReducedMotion: true });
    setTimeout(() => {
      confetti({ particleCount: 80, spread: 60, origin: { x: 0.8, y: 0.9 }, colors, disableForReducedMotion: true });
    }, 200);
  };

  return { gameWin, matchWin };
}
