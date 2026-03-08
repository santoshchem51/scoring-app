import { createSignal } from 'solid-js';

export interface PendingToast {
  id: string;
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
}

type ToastDismissCallback = (achievementId: string) => void;
const _onDismissCallbacks: ToastDismissCallback[] = [];

const MAX_TOAST_QUEUE = 10;

const [pendingToasts, setPendingToasts] = createSignal<PendingToast[]>([]);

export { pendingToasts };

export function enqueueToast(toast: Omit<PendingToast, 'id'>): void {
  const id = crypto.randomUUID();
  setPendingToasts(prev => {
    if (prev.length >= MAX_TOAST_QUEUE) return prev;
    return [...prev, { ...toast, id }];
  });
}

export function dismissToast(id: string): void {
  const toast = pendingToasts().find(t => t.id === id);
  if (toast) {
    _onDismissCallbacks.forEach(cb => cb(toast.achievementId));
  }
  setPendingToasts(prev => prev.filter(t => t.id !== id));
}

export function onToastDismissed(cb: ToastDismissCallback): void {
  _onDismissCallbacks.push(cb);
}

export function clearToasts(): void {
  setPendingToasts([]);
}
