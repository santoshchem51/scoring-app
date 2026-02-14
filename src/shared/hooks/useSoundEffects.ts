import { settings } from '../../stores/settingsStore';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (settings().soundEffects === 'off') return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, volume: number) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const level = settings().soundEffects;
  const gain = level === 'subtle' ? volume * 0.3 : volume;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  gainNode.gain.value = gain;
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

export function useSoundEffects() {
  const scorePoint = () => playTone(880, 0.15, 0.3);
  const sideOut = () => playTone(440, 0.2, 0.2);
  const gamePoint = () => {
    playTone(660, 0.1, 0.3);
    setTimeout(() => playTone(880, 0.15, 0.3), 120);
  };
  const gameWin = () => {
    playTone(523, 0.12, 0.3);
    setTimeout(() => playTone(659, 0.12, 0.3), 140);
    setTimeout(() => playTone(784, 0.2, 0.3), 280);
  };
  const undo = () => playTone(330, 0.1, 0.15);

  return { scorePoint, sideOut, gamePoint, gameWin, undo };
}
