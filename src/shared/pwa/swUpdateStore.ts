import { createSignal } from 'solid-js';
import { registerSW } from 'virtual:pwa-register';
import { IS_NATIVE } from '../platform/platform';
import { logger } from '../observability/logger';

const DISMISS_KEY = 'sw-update-dismissed-at';
const SNOOZE_MS = 24 * 60 * 60 * 1000; // 24 hours
const PENDING_ACK_KEY = 'sw-updated-pending-ack';

const [swWaiting, setSwWaiting] = createSignal(false);
const [_updateAcknowledged, setUpdateAcknowledged] = createSignal(false);
let _updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
let _initialized = false;

export function initSWUpdate(): void {
  if (_initialized || IS_NATIVE) return;
  _initialized = true;

  _updateSW = registerSW({
    onNeedRefresh() {
      setSwWaiting(true);
    },
    onRegisterError(error: unknown) {
      logger.error('SW registration failed', error);
    },
  });

  // Post-update acknowledgment from previous session
  const pendingAck = localStorage.getItem(PENDING_ACK_KEY);
  if (pendingAck) {
    localStorage.removeItem(PENDING_ACK_KEY);
    setUpdateAcknowledged(true);
  }
}

export function applyUpdate(): void {
  localStorage.setItem(PENDING_ACK_KEY, '1');
  _updateSW?.(true);
}

export function dismissUpdate(): void {
  localStorage.setItem(DISMISS_KEY, Date.now().toString());
  setSwWaiting(false);
}

export function clearUpdateAck(): void {
  setUpdateAcknowledged(false);
}

export const updateAcknowledged = (): boolean => _updateAcknowledged();

export const swUpdateVisible = (): boolean => {
  if (!swWaiting()) return false;
  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (!dismissedAt) return true;
  return Date.now() - Number(dismissedAt) > SNOOZE_MS;
};

export { swWaiting };
