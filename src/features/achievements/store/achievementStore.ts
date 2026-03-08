import { createSignal } from 'solid-js';

export interface PendingToast {
  id: string;
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
}

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
  setPendingToasts(prev => prev.filter(t => t.id !== id));
}

export function clearToasts(): void {
  setPendingToasts([]);
}
