import { createSignal, Show } from 'solid-js';
import { auth } from '../../data/firebase/config';
import { reauthenticateWithPopup, GoogleAuthProvider, deleteUser } from 'firebase/auth';
import { db } from '../../data/db';
import { deleteAllUserData } from '../../data/firebase/accountDeletion';

export function DeleteAccountButton() {
  const [confirming, setConfirming] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setDeleting(true);
    setError('');

    try {
      const uid = user.uid;

      // 1. Delete all Firestore user data first
      await deleteAllUserData(uid);

      // 2. Clear local data
      await db.delete();
      localStorage.clear();

      // 3. Delete Firebase Auth account LAST (irreversible, triggers signout)
      try {
        await deleteUser(user);
      } catch (e: any) {
        if (e.code === 'auth/requires-recent-login') {
          await reauthenticateWithPopup(user, new GoogleAuthProvider());
          await deleteUser(user);
        } else {
          throw e;
        }
      }

      // Redirect to home
      window.location.href = '/';
    } catch (e: any) {
      setError(e.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <div class="space-y-3">
      <Show
        when={confirming()}
        fallback={
          <button
            type="button"
            onClick={() => setConfirming(true)}
            class="w-full py-3 rounded-xl font-semibold text-red-400 border-2 border-red-400/30 bg-red-400/10 active:scale-[0.97] transition-transform"
          >
            Delete Account
          </button>
        }
      >
        <div class="bg-red-950/40 border-2 border-red-500/40 rounded-xl p-4 space-y-3">
          <p class="text-red-300 font-semibold text-sm">This cannot be undone</p>
          <p class="text-red-300/70 text-xs">
            All your data — matches, stats, achievements — will be permanently deleted.
          </p>
          <Show when={error()}>
            <p class="text-red-400 text-xs">{error()}</p>
          </Show>
          <div class="flex gap-3">
            <button
              type="button"
              onClick={() => { setConfirming(false); setError(''); }}
              class="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-surface-lighter text-on-surface active:scale-95 transition-transform"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting()}
              class="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-red-600 text-white active:scale-95 transition-transform disabled:opacity-50"
            >
              {deleting() ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
