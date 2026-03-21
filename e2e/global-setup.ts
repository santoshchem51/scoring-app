// e2e/global-setup.ts

import { AUTH_EMULATOR, FIRESTORE_EMULATOR, PROJECT_ID } from './helpers/emulator-config';

export default async function globalSetup() {
  console.log('[global-setup] Clearing emulators...');
  try {
    const [authRes, firestoreRes] = await Promise.all([
      fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
        method: 'DELETE',
      }),
      fetch(
        `${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
        { method: 'DELETE' },
      ),
    ]);
    if (!authRes.ok || !firestoreRes.ok) {
      throw new Error(
        `Emulators not reachable. Start them first:\n` +
          `  npx firebase emulators:start --only auth,firestore\n` +
          `  Auth: ${authRes.status}, Firestore: ${firestoreRes.status}`,
      );
    }
  } catch (err) {
    throw new Error(
      `Emulators not reachable. Start them first:\n` +
        `  npx firebase emulators:start --only auth,firestore\n` +
        `  Original error: ${err instanceof Error ? err.message : err}`,
    );
  }
  console.log('[global-setup] Emulators cleared.');
}
