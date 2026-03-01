import { createSignal, createEffect, onCleanup } from 'solid-js';
import { collectionGroup, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { BuddyGroup } from '../../../data/types';

export function useBuddyGroups(userId: () => string | undefined) {
  const [groups, setGroups] = createSignal<BuddyGroup[]>([]);
  const [loading, setLoading] = createSignal(true);

  let unsubscribe: (() => void) | null = null;

  createEffect(() => {
    const uid = userId();
    if (!uid) {
      unsubscribe?.();
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Listen to membership changes via collection group
    const q = query(collectionGroup(firestore, 'members'), where('userId', '==', uid));
    unsubscribe = onSnapshot(q, async (snapshot) => {
      const groupIds = snapshot.docs.map((d) => d.ref.parent.parent!.id);
      if (groupIds.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // Fetch group docs
      const groupDocs = await Promise.all(
        groupIds.map((id) => getDoc(doc(firestore, 'buddyGroups', id))),
      );
      const result = groupDocs
        .filter((d) => d.exists())
        .map((d) => ({ id: d.id, ...d.data() }) as BuddyGroup);
      setGroups(result);
      setLoading(false);
    });
  });

  onCleanup(() => unsubscribe?.());

  return { groups, loading };
}
