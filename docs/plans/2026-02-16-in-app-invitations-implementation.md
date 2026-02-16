# In-App Tournament Invitations — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let organizers search for existing app users and send in-app tournament invitations, with a player inbox on the tournaments page for one-tap Accept/Decline.

**Architecture:** Pure engine module (`invitationHelpers.ts`) for search filtering and acceptance logic with full test coverage, a Firestore repository (`firestoreInvitationRepository.ts`) for CRUD, two new UI components (`PlayerSearch`, `InvitationInbox`), and wiring into the existing `ShareTournamentModal` and `TournamentListPage`. User search uses parallel Firestore prefix queries on `displayNameLower` and `email`.

**Tech Stack:** SolidJS 1.9, TypeScript, Tailwind CSS v4, Vitest, Firebase Firestore

---

### Task 1: Create feature branch

**Step 1: Create and switch to feature branch**

Run:
```bash
cd "C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp"
git checkout -b feature/in-app-invitations
```
Expected: Switched to new branch `feature/in-app-invitations`

---

### Task 2: Add `TournamentInvitation` type and update `UserProfile`

**Files:**
- Modify: `src/data/types.ts`

**Step 1: Add TournamentInvitation type and update UserProfile**

At the end of `src/data/types.ts` (after the `TournamentRegistration` interface, line 207), add:

```typescript
export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface TournamentInvitation {
  id: string;
  tournamentId: string;
  invitedUserId: string;
  invitedEmail: string;
  invitedName: string;
  invitedByUserId: string;
  status: InvitationStatus;
  createdAt: number;
  respondedAt: number | null;
}
```

Also add `displayNameLower` to `UserProfile` (line 78-84). The updated interface should be:

```typescript
export interface UserProfile {
  id: string;
  displayName: string;
  displayNameLower: string;
  email: string;
  photoURL: string | null;
  createdAt: number;
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: Errors in `firestoreUserRepository.ts` (missing `displayNameLower` in `getProfile`) — that's expected, we fix it in Task 3.

**Step 3: Commit**

```bash
git add src/data/types.ts
git commit -m "feat: add TournamentInvitation type and displayNameLower to UserProfile"
```

---

### Task 3: Update `firestoreUserRepository` with `displayNameLower` and search methods

**Files:**
- Modify: `src/data/firebase/firestoreUserRepository.ts`

**Step 1: Update the repository**

Replace the entire file with:

```typescript
import { doc, setDoc, getDoc, getDocs, collection, query, where, orderBy, limit as fbLimit, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { UserProfile } from '../types';

export const firestoreUserRepository = {
  async saveProfile(user: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }): Promise<void> {
    const ref = doc(firestore, 'users', user.uid);
    const displayName = user.displayName ?? '';
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await setDoc(ref, {
        displayName,
        displayNameLower: displayName.toLowerCase(),
        email: user.email ?? '',
        photoURL: user.photoURL,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      await setDoc(ref, {
        id: user.uid,
        displayName,
        displayNameLower: displayName.toLowerCase(),
        email: user.email ?? '',
        photoURL: user.photoURL,
        createdAt: Date.now(),
      });
    }
  },

  async getProfile(userId: string): Promise<UserProfile | null> {
    const ref = doc(firestore, 'users', userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      displayName: data.displayName ?? '',
      displayNameLower: data.displayNameLower ?? (data.displayName ?? '').toLowerCase(),
      email: data.email ?? '',
      photoURL: data.photoURL ?? null,
      createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? Date.now(),
    };
  },

  async searchByNamePrefix(prefix: string, maxResults: number = 5): Promise<UserProfile[]> {
    const lower = prefix.toLowerCase();
    const q = query(
      collection(firestore, 'users'),
      where('displayNameLower', '>=', lower),
      where('displayNameLower', '<=', lower + '\uf8ff'),
      orderBy('displayNameLower'),
      fbLimit(maxResults),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        displayName: data.displayName ?? '',
        displayNameLower: data.displayNameLower ?? '',
        email: data.email ?? '',
        photoURL: data.photoURL ?? null,
        createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? Date.now(),
      };
    });
  },

  async searchByEmailPrefix(prefix: string, maxResults: number = 5): Promise<UserProfile[]> {
    const lower = prefix.toLowerCase();
    const q = query(
      collection(firestore, 'users'),
      where('email', '>=', lower),
      where('email', '<=', lower + '\uf8ff'),
      orderBy('email'),
      fbLimit(maxResults),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        displayName: data.displayName ?? '',
        displayNameLower: data.displayNameLower ?? '',
        email: data.email ?? '',
        photoURL: data.photoURL ?? null,
        createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? Date.now(),
      };
    });
  },
};
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All 228 tests pass

**Step 4: Commit**

```bash
git add src/data/firebase/firestoreUserRepository.ts
git commit -m "feat: add displayNameLower to user profiles and search methods"
```

---

### Task 4: Update Firestore security rules for user search and invitations

**Files:**
- Modify: `firestore.rules`

**Step 1: Update users read rule**

In `firestore.rules`, change the users read rule (line 8) from:

```
allow read: if request.auth != null && request.auth.uid == userId;
```

To:

```
allow read: if request.auth != null;
```

This allows any authenticated user to search/read user profiles (needed for the typeahead search).

**Step 2: Add invitation rules**

After the registrations block (after line 266, before the closing `}` of the tournaments match), add:

```
      // ── Invitations (/tournaments/{tid}/invitations/{invId}) ──
      match /invitations/{invitationId} {
        // Organizer can read all invitations for their tournament
        allow read: if request.auth != null
          && get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId == request.auth.uid;

        // Invited user can read their own invitation
        allow read: if request.auth != null
          && resource.data.invitedUserId == request.auth.uid;

        // Only organizer can create invitations
        allow create: if request.auth != null
          && get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId == request.auth.uid
          && request.resource.data.tournamentId == tournamentId
          && request.resource.data.invitedUserId is string
          && request.resource.data.invitedEmail is string
          && request.resource.data.invitedName is string
          && request.resource.data.invitedByUserId == request.auth.uid
          && request.resource.data.status == 'pending';

        // Invited user can update status (accept/decline) only from pending
        allow update: if request.auth != null
          && resource.data.invitedUserId == request.auth.uid
          && request.resource.data.status in ['accepted', 'declined']
          && resource.data.status == 'pending'
          && request.resource.data.invitedUserId == resource.data.invitedUserId
          && request.resource.data.tournamentId == resource.data.tournamentId
          && request.resource.data.invitedByUserId == resource.data.invitedByUserId;
      }
```

**Step 3: Add collection group query rule**

After the closing `}` of the tournaments match block (after the new invitations block) but still inside the `match /databases/{database}/documents` block, add:

```
    // ── Collection Group: Invitations (for player inbox query) ────────
    match /{path=**}/invitations/{invitationId} {
      allow read: if request.auth != null
        && resource.data.invitedUserId == request.auth.uid;
    }
```

**Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore security rules for invitations and user search"
```

---

### Task 5: Create `firestoreInvitationRepository`

**Files:**
- Create: `src/data/firebase/firestoreInvitationRepository.ts`

**Step 1: Create the repository**

Create `src/data/firebase/firestoreInvitationRepository.ts`:

```typescript
import { doc, setDoc, getDocs, updateDoc, collection, collectionGroup, query, where, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentInvitation } from '../types';

export const firestoreInvitationRepository = {
  async create(invitation: TournamentInvitation): Promise<void> {
    const ref = doc(firestore, 'tournaments', invitation.tournamentId, 'invitations', invitation.id);
    await setDoc(ref, { ...invitation, updatedAt: serverTimestamp() });
  },

  async getByTournament(tournamentId: string): Promise<TournamentInvitation[]> {
    const snapshot = await getDocs(collection(firestore, 'tournaments', tournamentId, 'invitations'));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentInvitation);
  },

  async getPendingForUser(userId: string): Promise<TournamentInvitation[]> {
    const q = query(
      collectionGroup(firestore, 'invitations'),
      where('invitedUserId', '==', userId),
      where('status', '==', 'pending'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TournamentInvitation);
  },

  async updateStatus(tournamentId: string, invitationId: string, status: 'accepted' | 'declined'): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'invitations', invitationId);
    await updateDoc(ref, { status, respondedAt: Date.now(), updatedAt: serverTimestamp() });
  },
};
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/data/firebase/firestoreInvitationRepository.ts
git commit -m "feat: add firestoreInvitationRepository for invitation CRUD"
```

---

### Task 6: Create `invitationHelpers` engine + tests

**Files:**
- Create: `src/features/tournaments/engine/invitationHelpers.ts`
- Create: `src/features/tournaments/engine/__tests__/invitationHelpers.test.ts`

**Step 1: Write the failing tests**

Create `src/features/tournaments/engine/__tests__/invitationHelpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { filterSearchResults, mergeAndDeduplicate, canAcceptInvitation } from '../invitationHelpers';
import type { UserProfile, TournamentInvitation } from '../../../../data/types';

const makeUser = (id: string, name: string, email: string): UserProfile => ({
  id,
  displayName: name,
  displayNameLower: name.toLowerCase(),
  email,
  photoURL: null,
  createdAt: Date.now(),
});

const makeInvitation = (userId: string, status: 'pending' | 'accepted' | 'declined' = 'pending'): TournamentInvitation => ({
  id: `inv-${userId}`,
  tournamentId: 't1',
  invitedUserId: userId,
  invitedEmail: `${userId}@test.com`,
  invitedName: userId,
  invitedByUserId: 'org-1',
  status,
  createdAt: Date.now(),
  respondedAt: null,
});

describe('filterSearchResults', () => {
  const users = [
    makeUser('org-1', 'Organizer', 'org@test.com'),
    makeUser('u1', 'Alice', 'alice@test.com'),
    makeUser('u2', 'Bob', 'bob@test.com'),
    makeUser('u3', 'Charlie', 'charlie@test.com'),
  ];

  it('excludes the organizer', () => {
    const result = filterSearchResults(users, 'org-1', [], []);
    expect(result.map((u) => u.id)).not.toContain('org-1');
    expect(result).toHaveLength(3);
  });

  it('excludes already-invited users', () => {
    const invitations = [makeInvitation('u1')];
    const result = filterSearchResults(users, 'org-1', invitations, []);
    expect(result.map((u) => u.id)).not.toContain('u1');
    expect(result).toHaveLength(2);
  });

  it('excludes already-registered users', () => {
    const registeredUserIds = ['u2'];
    const result = filterSearchResults(users, 'org-1', [], registeredUserIds);
    expect(result.map((u) => u.id)).not.toContain('u2');
    expect(result).toHaveLength(2);
  });
});

describe('mergeAndDeduplicate', () => {
  it('merges two arrays and removes duplicates by id', () => {
    const nameResults = [makeUser('u1', 'Alice', 'alice@test.com'), makeUser('u2', 'Bob', 'bob@test.com')];
    const emailResults = [makeUser('u2', 'Bob', 'bob@test.com'), makeUser('u3', 'Charlie', 'charlie@test.com')];
    const result = mergeAndDeduplicate(nameResults, emailResults, 8);
    expect(result).toHaveLength(3);
    expect(result.map((u) => u.id)).toEqual(['u1', 'u2', 'u3']);
  });

  it('respects the limit', () => {
    const nameResults = [makeUser('u1', 'A', 'a@t.com'), makeUser('u2', 'B', 'b@t.com')];
    const emailResults = [makeUser('u3', 'C', 'c@t.com'), makeUser('u4', 'D', 'd@t.com')];
    const result = mergeAndDeduplicate(nameResults, emailResults, 3);
    expect(result).toHaveLength(3);
  });
});

describe('canAcceptInvitation', () => {
  it('returns true when invitation is pending and tournament is in registration', () => {
    expect(canAcceptInvitation('pending', 'registration')).toBe(true);
  });

  it('returns true when invitation is pending and tournament is in setup', () => {
    expect(canAcceptInvitation('pending', 'setup')).toBe(true);
  });

  it('returns false when invitation is already accepted', () => {
    expect(canAcceptInvitation('accepted', 'registration')).toBe(false);
  });

  it('returns false when invitation is already declined', () => {
    expect(canAcceptInvitation('declined', 'registration')).toBe(false);
  });

  it('returns false when tournament is past registration', () => {
    expect(canAcceptInvitation('pending', 'pool-play')).toBe(false);
  });

  it('returns false when tournament is completed', () => {
    expect(canAcceptInvitation('pending', 'completed')).toBe(false);
  });

  it('returns false when tournament is cancelled', () => {
    expect(canAcceptInvitation('pending', 'cancelled')).toBe(false);
  });
});

```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/tournaments/engine/__tests__/invitationHelpers.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/features/tournaments/engine/invitationHelpers.ts`:

```typescript
import type { UserProfile, TournamentInvitation, InvitationStatus, TournamentStatus } from '../../../data/types';

export function filterSearchResults(
  users: UserProfile[],
  organizerId: string,
  existingInvitations: TournamentInvitation[],
  registeredUserIds: string[],
): UserProfile[] {
  const invitedIds = new Set(existingInvitations.map((inv) => inv.invitedUserId));
  const registeredIds = new Set(registeredUserIds);

  return users.filter((u) => {
    if (u.id === organizerId) return false;
    if (invitedIds.has(u.id)) return false;
    if (registeredIds.has(u.id)) return false;
    return true;
  });
}

export function mergeAndDeduplicate(
  nameResults: UserProfile[],
  emailResults: UserProfile[],
  limit: number,
): UserProfile[] {
  const seen = new Set<string>();
  const merged: UserProfile[] = [];

  for (const user of [...nameResults, ...emailResults]) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    merged.push(user);
    if (merged.length >= limit) break;
  }

  return merged;
}

export function canAcceptInvitation(
  invitationStatus: InvitationStatus,
  tournamentStatus: TournamentStatus,
): boolean {
  if (invitationStatus !== 'pending') return false;
  return ['setup', 'registration'].includes(tournamentStatus);
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/tournaments/engine/__tests__/invitationHelpers.test.ts`
Expected: 12 tests PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/invitationHelpers.ts src/features/tournaments/engine/__tests__/invitationHelpers.test.ts
git commit -m "feat: add invitationHelpers engine with 12 tests"
```

---

### Task 7: Create `PlayerSearch` component

**Files:**
- Create: `src/features/tournaments/components/PlayerSearch.tsx`

**Context:** Debounced typeahead search input that fires parallel name+email queries on every keystroke (after 2+ chars, 300ms debounce). Shows results in a dropdown with Invite buttons. Used inside ShareTournamentModal.

**Step 1: Create the component**

Create `src/features/tournaments/components/PlayerSearch.tsx`:

```typescript
import { createSignal, createEffect, on, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { firestoreUserRepository } from '../../../data/firebase/firestoreUserRepository';
import { firestoreInvitationRepository } from '../../../data/firebase/firestoreInvitationRepository';
import { mergeAndDeduplicate, filterSearchResults } from '../engine/invitationHelpers';
import type { UserProfile, TournamentInvitation } from '../../../data/types';

interface Props {
  tournamentId: string;
  tournamentName: string;
  tournamentDate: string;
  tournamentLocation: string;
  organizerId: string;
  registeredUserIds: string[];
  shareUrl: string;
}

const PlayerSearch: Component<Props> = (props) => {
  const [searchText, setSearchText] = createSignal('');
  const [results, setResults] = createSignal<UserProfile[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [invitations, setInvitations] = createSignal<TournamentInvitation[]>([]);
  const [invitedIds, setInvitedIds] = createSignal<Set<string>>(new Set());

  // Load existing invitations on mount
  createEffect(async () => {
    try {
      const existing = await firestoreInvitationRepository.getByTournament(props.tournamentId);
      setInvitations(existing);
      setInvitedIds(new Set(existing.map((inv) => inv.invitedUserId)));
    } catch {
      // Ignore — will show all results without badges
    }
  });

  // Debounced search
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  createEffect(on(searchText, (text) => {
    clearTimeout(debounceTimer);
    if (text.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceTimer = setTimeout(async () => {
      try {
        const [nameResults, emailResults] = await Promise.all([
          firestoreUserRepository.searchByNamePrefix(text, 5),
          firestoreUserRepository.searchByEmailPrefix(text, 5),
        ]);
        const merged = mergeAndDeduplicate(nameResults, emailResults, 8);
        const filtered = filterSearchResults(merged, props.organizerId, invitations(), props.registeredUserIds);
        setResults(filtered);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }));

  const handleInvite = async (user: UserProfile) => {
    const invitation: TournamentInvitation = {
      id: crypto.randomUUID(),
      tournamentId: props.tournamentId,
      invitedUserId: user.id,
      invitedEmail: user.email,
      invitedName: user.displayName,
      invitedByUserId: props.organizerId,
      status: 'pending',
      createdAt: Date.now(),
      respondedAt: null,
    };

    // Optimistic update
    setInvitedIds((prev) => new Set([...prev, user.id]));
    setInvitations((prev) => [...prev, invitation]);
    // Remove from results
    setResults((prev) => prev.filter((u) => u.id !== user.id));

    try {
      await firestoreInvitationRepository.create(invitation);
    } catch {
      // Revert optimistic update
      setInvitedIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));
    }
  };

  const mailtoHref = () => {
    const text = searchText().trim();
    if (!text.includes('@')) return '';
    const subject = encodeURIComponent(`You're invited to ${props.tournamentName}`);
    const body = encodeURIComponent(
      `Join ${props.tournamentName} on ${props.tournamentDate} at ${props.tournamentLocation}.\n\nView tournament: ${props.shareUrl}`,
    );
    return `mailto:${text}?subject=${subject}&body=${body}`;
  };

  const initial = (name: string) => (name.charAt(0) || '?').toUpperCase();

  return (
    <div>
      <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">Invite Player</div>
      <input
        type="text"
        value={searchText()}
        onInput={(e) => setSearchText(e.currentTarget.value)}
        placeholder="Search by name or email..."
        class="w-full bg-surface-light border border-surface-lighter rounded-lg px-3 py-2 text-on-surface text-sm"
      />

      {/* Search results */}
      <Show when={searchText().length >= 2}>
        <div class="mt-2 space-y-1">
          <Show when={loading()}>
            <div class="flex items-center justify-center py-3">
              <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          </Show>

          <Show when={!loading() && results().length > 0}>
            <For each={results()}>
              {(user) => (
                <div class="flex items-center gap-3 bg-surface-light rounded-lg px-3 py-2">
                  <Show when={user.photoURL} fallback={
                    <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {initial(user.displayName)}
                    </div>
                  }>
                    <img src={user.photoURL!} alt="" class="w-8 h-8 rounded-full" />
                  </Show>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-on-surface truncate">{user.displayName}</div>
                    <div class="text-xs text-on-surface-muted truncate">{user.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInvite(user)}
                    class="text-xs font-semibold px-3 py-1 rounded-lg bg-primary/20 text-primary active:scale-95 transition-transform"
                  >
                    Invite
                  </button>
                </div>
              )}
            </For>
          </Show>

          <Show when={!loading() && results().length === 0 && searchText().length >= 2}>
            <div class="bg-surface-light rounded-lg px-3 py-3 text-center">
              <p class="text-on-surface-muted text-xs">No users found</p>
              <Show when={mailtoHref()}>
                <a
                  href={mailtoHref()}
                  class="text-xs font-semibold text-primary underline mt-1 inline-block"
                >
                  Send email invite instead
                </a>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={searchText().length > 0 && searchText().length < 2}>
        <p class="text-xs text-on-surface-muted mt-1">Type at least 2 characters to search...</p>
      </Show>

      {/* Invited count */}
      <Show when={invitedIds().size > 0}>
        <p class="text-xs text-on-surface-muted mt-2">
          {invitedIds().size} player{invitedIds().size > 1 ? 's' : ''} invited
        </p>
      </Show>
    </div>
  );
};

export default PlayerSearch;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/components/PlayerSearch.tsx
git commit -m "feat: add PlayerSearch component with debounced typeahead"
```

---

### Task 8: Create `InvitationInbox` component

**Files:**
- Create: `src/features/tournaments/components/InvitationInbox.tsx`

**Context:** Displays pending invitations on the `/tournaments` page. Each card shows tournament name, date, location, inviter name, and Accept/Decline buttons. Accept navigates to the tournament dashboard.

**Step 1: Create the component**

Create `src/features/tournaments/components/InvitationInbox.tsx`:

```typescript
import { createResource, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { firestoreInvitationRepository } from '../../../data/firebase/firestoreInvitationRepository';
import { firestoreTournamentRepository } from '../../../data/firebase/firestoreTournamentRepository';
import { firestoreUserRepository } from '../../../data/firebase/firestoreUserRepository';
import { canAcceptInvitation } from '../engine/invitationHelpers';
import type { TournamentInvitation, Tournament, UserProfile } from '../../../data/types';

interface InvitationWithContext {
  invitation: TournamentInvitation;
  tournament: Tournament | null;
  inviterName: string;
}

interface Props {
  userId: string;
}

const InvitationInbox: Component<Props> = (props) => {
  const navigate = useNavigate();

  const [invitations, { refetch }] = createResource(
    () => props.userId,
    async (uid) => {
      const pending = await firestoreInvitationRepository.getPendingForUser(uid);
      // Enrich with tournament data and inviter name
      const enriched: InvitationWithContext[] = await Promise.all(
        pending.map(async (inv) => {
          const [tournament, inviter] = await Promise.all([
            firestoreTournamentRepository.getById(inv.tournamentId).catch(() => null),
            firestoreUserRepository.getProfile(inv.invitedByUserId).catch(() => null),
          ]);
          return {
            invitation: inv,
            tournament,
            inviterName: inviter?.displayName ?? 'Unknown',
          };
        }),
      );
      // Filter out invitations where tournament was deleted or player already registered
      return enriched.filter((e) => e.tournament !== null);
    },
  );

  const handleAccept = async (item: InvitationWithContext) => {
    await firestoreInvitationRepository.updateStatus(
      item.invitation.tournamentId,
      item.invitation.id,
      'accepted',
    );
    navigate(`/tournaments/${item.invitation.tournamentId}`);
  };

  const handleDecline = async (item: InvitationWithContext) => {
    await firestoreInvitationRepository.updateStatus(
      item.invitation.tournamentId,
      item.invitation.id,
      'declined',
    );
    refetch();
  };

  return (
    <Show when={invitations() && invitations()!.length > 0}>
      <div class="mb-6">
        <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
          Invitations ({invitations()!.length})
        </h2>
        <div class="space-y-3">
          <For each={invitations()}>
            {(item) => {
              const t = item.tournament!;
              const canAccept = () => canAcceptInvitation(item.invitation.status, t.status);

              return (
                <div class="bg-surface-light rounded-xl p-4 space-y-2">
                  <div class="font-semibold text-on-surface">{t.name}</div>
                  <div class="text-xs text-on-surface-muted">
                    {new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    {t.location ? ` · ${t.location}` : ''}
                  </div>
                  <div class="text-xs text-on-surface-muted">
                    Invited by {item.inviterName}
                  </div>
                  <Show when={canAccept()} fallback={
                    <div class="text-xs text-on-surface-muted italic">Registration closed</div>
                  }>
                    <div class="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleAccept(item)}
                        class="flex-1 bg-primary text-surface text-sm font-semibold py-2 rounded-lg active:scale-95 transition-transform"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecline(item)}
                        class="flex-1 bg-surface text-on-surface-muted text-sm font-semibold py-2 rounded-lg border border-surface-lighter active:scale-95 transition-transform"
                      >
                        Decline
                      </button>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
};

export default InvitationInbox;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/components/InvitationInbox.tsx
git commit -m "feat: add InvitationInbox component for player invitation cards"
```

---

### Task 9: Wire PlayerSearch into ShareTournamentModal

**Files:**
- Modify: `src/features/tournaments/components/ShareTournamentModal.tsx`

**Context:** Replace the existing "Invite by Email" section (Section 4) with the new PlayerSearch component. PlayerSearch needs `tournamentId`, `organizerId`, and `registeredUserIds` as props, so the modal's Props interface needs to be extended.

**Step 1: Update ShareTournamentModal props and add PlayerSearch**

Add to the Props interface:
```typescript
  tournamentId: string;
  organizerId: string;
  registeredUserIds: string[];
```

Add import at the top:
```typescript
import PlayerSearch from './PlayerSearch';
```

Replace Section 4 (the "Invite by Email" `<Show>` block, lines 160-185) with:

```typescript
            {/* Section 4: Invite Player (only when public) */}
            <Show when={props.visibility === 'public' && shareUrl()}>
              <PlayerSearch
                tournamentId={props.tournamentId}
                tournamentName={props.tournamentName}
                tournamentDate={props.tournamentDate}
                tournamentLocation={props.tournamentLocation}
                organizerId={props.organizerId}
                registeredUserIds={props.registeredUserIds}
                shareUrl={shareUrl()}
              />
            </Show>
```

Remove the now-unused `email` signal and `mailtoHref` function (lines 20, 74-82).

**Step 2: Update the call site in TournamentDashboardPage**

In `src/features/tournaments/TournamentDashboardPage.tsx`, find the `<ShareTournamentModal>` usage and add the new props:

```typescript
                  <ShareTournamentModal
                    open={showShareModal()}
                    tournamentId={t().id}
                    tournamentName={t().name}
                    tournamentDate={new Date(t().date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    tournamentLocation={t().location || 'TBD'}
                    visibility={t().visibility ?? 'private'}
                    shareCode={t().shareCode ?? null}
                    organizerId={t().organizerId}
                    registeredUserIds={live.registrations().map((r) => r.userId)}
                    onToggleVisibility={handleToggleVisibility}
                    onClose={() => setShowShareModal(false)}
                  />
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (228 + 12 = 240)

**Step 5: Commit**

```bash
git add src/features/tournaments/components/ShareTournamentModal.tsx src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat: wire PlayerSearch into ShareTournamentModal"
```

---

### Task 10: Wire InvitationInbox into TournamentListPage

**Files:**
- Modify: `src/features/tournaments/TournamentListPage.tsx`

**Context:** Add the `InvitationInbox` component above the tournament list. It should only render when the user is signed in.

**Step 1: Add import**

Add at the top of `TournamentListPage.tsx`:
```typescript
import InvitationInbox from './components/InvitationInbox';
```

**Step 2: Add InvitationInbox before the Switch block**

After line 23 (`<div class="p-4">`), add:

```typescript
        <Show when={user()}>
          {(u) => <InvitationInbox userId={u().uid} />}
        </Show>
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All 240 tests pass

**Step 5: Commit**

```bash
git add src/features/tournaments/TournamentListPage.tsx
git commit -m "feat: wire InvitationInbox into TournamentListPage"
```

---

### Task 11: E2E verification

**Prerequisites:** Dev server running on port 5206, Firebase emulators running.

**Test scenario:**

**Phase 1: Setup**
1. Sign in as organizer
2. Create a new single-elimination singles tournament
3. Advance from setup to registration

**Phase 2: Player search and invite**
4. Open Share modal → toggle to Public
5. Type a name/email in the "Invite Player" search box
6. Verify results appear as you type (after 2+ chars)
7. Tap "Invite" on a result → verify button disappears and invited count shows
8. If no results, verify "No users found" + "Send email invite instead" link appears

**Phase 3: Player inbox**
9. Navigate to `/tournaments` page
10. Verify InvitationInbox section appears (if invitations exist for signed-in user)

**Phase 4: Verify no errors**
11. Check console for any errors related to invitations, search, or InvitationInbox

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Create feature branch | None |
| 2 | Add `TournamentInvitation` type + `displayNameLower` | Task 1 |
| 3 | Update `firestoreUserRepository` with search methods | Task 2 |
| 4 | Update Firestore security rules | Task 1 |
| 5 | Create `firestoreInvitationRepository` | Task 2 |
| 6 | Create `invitationHelpers` engine + 12 tests | Task 2 |
| 7 | Create `PlayerSearch` component | Tasks 3, 5, 6 |
| 8 | Create `InvitationInbox` component | Tasks 5, 6 |
| 9 | Wire PlayerSearch into ShareTournamentModal | Task 7 |
| 10 | Wire InvitationInbox into TournamentListPage | Task 8 |
| 11 | E2E verification | Tasks 9, 10 |
