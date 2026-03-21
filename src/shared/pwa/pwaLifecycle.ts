import { captureInstallEvent, markInstalled, incrementVisitCount, setCompletedMatchCount } from './installPromptStore';
import { db } from '../../data/db';
import { IS_NATIVE } from '../platform/platform';

let _initialized = false;

export function initPWAListeners(): void {
  if (_initialized || IS_NATIVE) return;
  _initialized = true;

  incrementVisitCount();

  // Query completed match count for install trigger
  db.matches.where('status').equals('completed').count()
    .then(count => setCompletedMatchCount(count))
    .catch(() => {}); // Ignore if Dexie fails

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    captureInstallEvent(event);
  });

  window.addEventListener('appinstalled', () => {
    markInstalled();
  });
}
