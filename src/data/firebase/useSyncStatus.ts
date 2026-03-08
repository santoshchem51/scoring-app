import { createSignal } from 'solid-js';
import { getPendingCount, getFailedCount } from './syncQueue';

type SyncStatusValue = 'idle' | 'processing' | 'pending' | 'failed';

const [syncStatus, setSyncStatus] = createSignal<SyncStatusValue>('idle');
const [pendingCount, setPendingCount] = createSignal(0);
const [failedCount, setFailedCount] = createSignal(0);

export { syncStatus, pendingCount, failedCount };

export async function updateSyncStatus(): Promise<void> {
  const pending = await getPendingCount();
  const failed = await getFailedCount();
  setPendingCount(pending);
  setFailedCount(failed);

  if (failed > 0) setSyncStatus('failed');
  else if (pending > 0) setSyncStatus('pending');
  else setSyncStatus('idle');
}

export function setSyncProcessing(): void {
  setSyncStatus('processing');
}

export function resetSyncStatus(): void {
  setSyncStatus('idle');
  setPendingCount(0);
  setFailedCount(0);
}
