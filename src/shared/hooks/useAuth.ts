import { createSignal } from 'solid-js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../../data/firebase/config';
import { cloudSync } from '../../data/firebase/cloudSync';

const [user, setUser] = createSignal<User | null>(null);
const [loading, setLoading] = createSignal(true);
const [syncing, setSyncing] = createSignal(false);

let listenerInitialized = false;

function initAuthListener() {
  if (listenerInitialized) return;
  listenerInitialized = true;
  onAuthStateChanged(auth, async (firebaseUser) => {
    const wasSignedOut = user() === null;
    setUser(firebaseUser);
    setLoading(false);

    // Sync on sign-in
    if (firebaseUser && wasSignedOut) {
      setSyncing(true);
      try {
        await cloudSync.syncUserProfile();
        await cloudSync.pushLocalMatchesToCloud();
        await cloudSync.pullCloudMatchesToLocal();
      } catch (err) {
        console.warn('Sync on sign-in failed:', err);
      } finally {
        setSyncing(false);
      }
    }
  });
}

export function useAuth() {
  initAuthListener();

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return { user, loading, syncing, signIn, signOut };
}
