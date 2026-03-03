import { createSignal } from 'solid-js';
import type { UserProfile } from '../../../data/types';
import { firestoreUserRepository } from '../../../data/firebase/firestoreUserRepository';

export interface SearchUserResult {
  id: string;
  displayName: string;
  photoURL: string | null;
}

interface UseUserSearchConfig {
  scorerUid: string;
  buddyUserIds: () => string[];
}

export function useUserSearch(config: UseUserSearchConfig) {
  const [results, setResults] = createSignal<SearchUserResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const search = (query: string) => {
    if (debounceTimer) clearTimeout(debounceTimer);

    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimer = setTimeout(async () => {
      try {
        const raw = await firestoreUserRepository.searchByNamePrefix(query, 10);
        const excludeIds = new Set([config.scorerUid, ...config.buddyUserIds()]);
        const filtered = raw
          .filter((u: UserProfile) => !excludeIds.has(u.id))
          .map((u: UserProfile): SearchUserResult => ({
            id: u.id,
            displayName: u.displayName,
            photoURL: u.profileVisibility === 'private' ? null : u.photoURL,
          }));
        setResults(filtered);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const clear = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    setResults([]);
    setLoading(false);
  };

  return { results, loading, search, clear };
}
