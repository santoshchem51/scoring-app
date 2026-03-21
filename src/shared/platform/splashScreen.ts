import { SplashScreen } from '@capacitor/splash-screen';
import { IS_NATIVE } from './platform';

export function hideSplashScreen(): void {
  if (!IS_NATIVE) return;
  SplashScreen.hide().catch((err) => console.warn('SplashScreen.hide failed:', err));
}
