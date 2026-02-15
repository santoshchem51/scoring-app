import { createSignal } from 'solid-js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../../data/firebase/config';

const [user, setUser] = createSignal<User | null>(null);
const [loading, setLoading] = createSignal(true);

let listenerInitialized = false;

function initAuthListener() {
  if (listenerInitialized) return;
  listenerInitialized = true;
  onAuthStateChanged(auth, (firebaseUser) => {
    setUser(firebaseUser);
    setLoading(false);
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

  return { user, loading, signIn, signOut };
}
