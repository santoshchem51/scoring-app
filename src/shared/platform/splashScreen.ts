import { SplashScreen } from '@capacitor/splash-screen';
import { IS_NATIVE } from './platform';
import { logger } from '../observability/logger';

export function hideSplashScreen(): void {
  if (!IS_NATIVE) return;
  SplashScreen.hide().catch((err) => logger.warn('SplashScreen.hide failed', err));
}
