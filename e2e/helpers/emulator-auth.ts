import type { Page } from '@playwright/test';

const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR = 'http://127.0.0.1:8180';
const PROJECT_ID = 'picklescore-b0a71';

/**
 * Clear all data from Auth and Firestore emulators via REST API.
 */
export async function clearEmulators() {
  await Promise.all([
    fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
      method: 'DELETE',
    }).catch(() => {}),
    fetch(
      `${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' },
    ).catch(() => {}),
  ]);
}

/**
 * Wait for the DEV-only Firebase test globals to be available on window.
 */
async function waitForFirebaseGlobals(page: Page) {
  await page.waitForFunction(
    () =>
      (window as any).__TEST_FIREBASE__ &&
      (window as any).__TEST_FIREBASE_AUTH__ &&
      (window as any).__TEST_FIREBASE_FIRESTORE__,
    { timeout: 10000 },
  );
}

/**
 * Sign in as a test user via the Auth emulator.
 * Creates the user if it doesn't exist.
 *
 * IMPORTANT: The page must already be navigated to the app (so Firebase SDK is loaded).
 */
export async function signInAsTestUser(
  page: Page,
  options: { email?: string; password?: string; displayName?: string } = {},
) {
  const email = options.email ?? 'testplayer@example.com';
  const password = options.password ?? 'testpass123';
  const displayName = options.displayName ?? 'Test Player';

  await waitForFirebaseGlobals(page);

  await page.evaluate(
    async ({ email, password, displayName }) => {
      const { auth } = (window as any).__TEST_FIREBASE__;
      const {
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
        updateProfile,
      } = (window as any).__TEST_FIREBASE_AUTH__;

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (e: unknown) {
        const code = (e as { code?: string }).code;
        if (
          code === 'auth/user-not-found' ||
          code === 'auth/invalid-credential'
        ) {
          try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(cred.user, { displayName });
          } catch (createErr: unknown) {
            if ((createErr as { code?: string }).code === 'auth/email-already-in-use') {
              await signInWithEmailAndPassword(auth, email, password);
            } else {
              throw createErr;
            }
          }
        } else {
          throw e;
        }
      }
    },
    { email, password, displayName },
  );

  // Wait for auth state to propagate through onAuthStateChanged → RequireAuth
  await page.waitForTimeout(1000);
}

/**
 * Sign out the current user.
 */
export async function signOut(page: Page) {
  await waitForFirebaseGlobals(page);
  await page.evaluate(async () => {
    const { auth } = (window as any).__TEST_FIREBASE__;
    const { signOut } = (window as any).__TEST_FIREBASE_AUTH__;
    await signOut(auth);
  });
  await page.waitForTimeout(300);
}

// ── Admin seeding (bypasses security rules via Bearer owner) ──────────

/** Convert a JS value to Firestore REST API field format. */
function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object' && value !== null) {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

/**
 * Seed a Firestore document via the emulator REST API, bypassing security rules.
 * Uses Bearer owner token for admin access. Runs from Node.js (no page needed).
 */
export async function seedFirestoreDocAdmin(
  collectionPath: string,
  docId: string,
  data: Record<string, unknown>,
) {
  const url = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}/${docId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer owner',
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to seed ${collectionPath}/${docId}: ${response.status} ${text}`);
  }
}
