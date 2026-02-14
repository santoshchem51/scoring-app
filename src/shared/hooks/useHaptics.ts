import { settings } from '../../stores/settingsStore';

function vibrate(pattern: number | number[]) {
  if (!settings().hapticFeedback) return;
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Silently fail on unsupported devices
  }
}

export function useHaptics() {
  const light = () => vibrate(10);
  const medium = () => vibrate(25);
  const heavy = () => vibrate(50);
  const double = () => vibrate([15, 50, 15]);

  return { light, medium, heavy, double };
}
