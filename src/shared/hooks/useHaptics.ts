import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { IS_NATIVE } from '../platform/platform';
import { settings } from '../../stores/settingsStore';

function vibrateNative(style: ImpactStyle) {
  if (!settings().hapticFeedback) return;
  Haptics.impact({ style }).catch(() => {});
}

function vibrateWeb(pattern: number | number[]) {
  if (!settings().hapticFeedback) return;
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Silently fail on unsupported devices
  }
}

export function useHaptics() {
  const light = () => IS_NATIVE ? vibrateNative(ImpactStyle.Light) : vibrateWeb(10);
  const medium = () => IS_NATIVE ? vibrateNative(ImpactStyle.Medium) : vibrateWeb(25);
  const heavy = () => IS_NATIVE ? vibrateNative(ImpactStyle.Heavy) : vibrateWeb(50);
  const double = async () => {
    if (!settings().hapticFeedback) return;
    if (IS_NATIVE) {
      await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      await new Promise(r => setTimeout(r, 50));
      await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    } else {
      vibrateWeb([15, 50, 15]);
    }
  };

  return { light, medium, heavy, double };
}
