export type SyncJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'awaitingAuth';

export type SyncJobContext =
  | { type: 'match'; ownerId: string; sharedWith: string[] }
  | { type: 'tournament' }
  | { type: 'playerStats'; scorerUid: string };

export interface SyncJob {
  id: string;                    // Deterministic: `${type}:${entityId}`
  type: 'match' | 'tournament' | 'playerStats';
  entityId: string;
  context: SyncJobContext;
  status: SyncJobStatus;
  retryCount: number;
  nextRetryAt: number;           // Unix ms — REQUIRED, never undefined
  createdAt: number;
  processedAt?: number;
  completedAt?: number;
  lastError?: string;
  dependsOn?: string[];
}
