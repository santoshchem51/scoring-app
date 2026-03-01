// e2e/global-setup.ts

const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR = 'http://127.0.0.1:8180';
const PROJECT_ID = 'picklescore-b0a71';

async function globalSetup() {
  console.log('[global-setup] Clearing emulators...');
  await Promise.all([
    fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
      method: 'DELETE',
    }).catch(() => {
      console.warn('[global-setup] Auth emulator not reachable — skipping');
    }),
    fetch(
      `${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' },
    ).catch(() => {
      console.warn('[global-setup] Firestore emulator not reachable — skipping');
    }),
  ]);
  console.log('[global-setup] Emulators cleared.');
}

export default globalSetup;
