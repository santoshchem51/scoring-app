import { createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { BuddyGroupMember } from '../../../data/types';
import { firestoreBuddyGroupRepository } from '../../../data/firebase/firestoreBuddyGroupRepository';
import { deduplicateBuddies, filterValidMembers, excludeSelf } from '../helpers/buddyPickerHelpers';

interface BuddyPickerData {
  buddies: Accessor<BuddyGroupMember[]>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  load: () => Promise<void>;
}

export function useBuddyPickerData(currentUid: Accessor<string | undefined>): BuddyPickerData {
  const [buddies, setBuddies] = createSignal<BuddyGroupMember[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let loaded = false;

  const load = async () => {
    const uid = currentUid();
    if (!uid || loaded) return;

    setLoading(true);
    setError(null);
    try {
      const groupIds = await firestoreBuddyGroupRepository.getGroupsForUser(uid);
      const memberArrays = await Promise.all(
        groupIds.map((gid: string) => firestoreBuddyGroupRepository.getMembers(gid)),
      );
      const allMembers = memberArrays.flat();
      const processed = excludeSelf(deduplicateBuddies(filterValidMembers(allMembers)), uid);
      setBuddies(processed);
      loaded = true;
    } catch (err) {
      console.warn('Failed to load buddy picker data:', err);
      setError('Failed to load buddies');
    } finally {
      setLoading(false);
    }
  };

  return { buddies, loading, error, load };
}
