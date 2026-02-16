# Layer 3 Wave A: Tournament Sharing & Public Access — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow organizers to make tournaments public and share them via link, QR code, and email — so spectators can view tournament data without signing in.

**Architecture:** Add `visibility` and `shareCode` fields to Tournament type. Create a public route `/t/:shareCode` outside the RequireAuth wrapper. Update Firestore security rules to allow unauthenticated reads on public tournaments. Build a ShareTournamentModal with copy-link, QR code, and email invite sections.

**Tech Stack:** SolidJS 1.9, TypeScript, Vite 6, Tailwind CSS v4, Firebase/Firestore, `qrcode` library

---

### Task 1: Create feature branch

**Step 1: Create and switch to feature branch**

Run:
```bash
cd "C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp"
git checkout -b feature/layer3-wave-a
```
Expected: Switched to new branch `feature/layer3-wave-a`

---

### Task 2: Add `visibility` and `shareCode` to Tournament type

**Files:**
- Modify: `src/data/types.ts`

**Step 1: Write the failing test**

No test needed — this is a type-only change. TypeScript compiler is the test.

**Step 2: Add the new fields to the Tournament interface**

In `src/data/types.ts`, add two new fields to the `Tournament` interface (after `updatedAt`):

```typescript
export type TournamentVisibility = 'private' | 'public';

export interface Tournament {
  // ... existing fields (id through updatedAt) ...
  visibility: TournamentVisibility;   // NEW — default 'private'
  shareCode: string | null;           // NEW — 6-char code for /t/:shareCode URL
}
```

Add the `TournamentVisibility` type export above the `Tournament` interface, alongside the other tournament type aliases (line ~89 area).

**Step 3: Fix all TypeScript errors from the new required fields**

Every place that creates a `Tournament` object literal now needs `visibility` and `shareCode`. Search the codebase for `organizerId:` to find all Tournament object creation sites:

1. `src/features/tournaments/TournamentCreatePage.tsx` — in `handleCreate()`, add to the tournament object:
   ```typescript
   visibility: 'private' as const,
   shareCode: null,
   ```

2. `src/features/tournaments/__tests__/tournamentLifecycle.test.ts` — in any test factories or fixture objects, add the same two fields.

3. Any other test files that create Tournament objects (search for `organizerId:` in test files).

**Step 4: Run type check and tests to verify**

Run: `npx tsc --noEmit`
Expected: No errors

Run: `npx vitest run`
Expected: All 206 tests pass

**Step 5: Commit**

```bash
git add src/data/types.ts src/features/tournaments/TournamentCreatePage.tsx src/features/tournaments/__tests__/tournamentLifecycle.test.ts
git commit -m "feat: add visibility and shareCode fields to Tournament type"
```

---

### Task 3: Implement `generateShareCode()` with tests

**Files:**
- Create: `src/features/tournaments/engine/shareCode.ts`
- Create: `src/features/tournaments/engine/__tests__/shareCode.test.ts`

**Step 1: Write the failing tests**

Create `src/features/tournaments/engine/__tests__/shareCode.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateShareCode, SHARE_CODE_CHARS } from '../shareCode';

describe('generateShareCode', () => {
  it('returns a 6-character string', () => {
    const code = generateShareCode();
    expect(code).toHaveLength(6);
  });

  it('only contains allowed characters (no ambiguous 0/O/1/I/L)', () => {
    // Generate 100 codes to test randomness
    for (let i = 0; i < 100; i++) {
      const code = generateShareCode();
      for (const ch of code) {
        expect(SHARE_CODE_CHARS).toContain(ch);
      }
    }
  });

  it('generates unique codes (no duplicates in 100 runs)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateShareCode());
    }
    // With 729M combinations, 100 codes should all be unique
    expect(codes.size).toBe(100);
  });

  it('does not contain ambiguous characters', () => {
    const ambiguous = ['0', 'O', '1', 'I', 'L'];
    for (let i = 0; i < 100; i++) {
      const code = generateShareCode();
      for (const ch of ambiguous) {
        expect(code).not.toContain(ch);
      }
    }
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/tournaments/engine/__tests__/shareCode.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/features/tournaments/engine/shareCode.ts`:

```typescript
// Uppercase alphanumeric, excluding ambiguous characters: 0/O, 1/I/L
export const SHARE_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateShareCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += SHARE_CODE_CHARS[Math.floor(Math.random() * SHARE_CODE_CHARS.length)];
  }
  return code;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/tournaments/engine/__tests__/shareCode.test.ts`
Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/shareCode.ts src/features/tournaments/engine/__tests__/shareCode.test.ts
git commit -m "feat: add generateShareCode with tests"
```

---

### Task 4: Add `getByShareCode()` to tournament repository

**Files:**
- Modify: `src/data/firebase/firestoreTournamentRepository.ts`
- Modify: `src/data/firebase/__tests__/firestoreTournamentRepository.test.ts` (if it exists)

**Step 1: Write the failing test**

Check if `src/data/firebase/__tests__/firestoreTournamentRepository.test.ts` exists. If it does, add a test. If it uses mocks, follow the same mock pattern. If there are no existing tests for this repo, create a simple test:

Add to the test file (or create one following existing patterns in `src/data/firebase/__tests__/`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firestoreTournamentRepository } from '../firestoreTournamentRepository';

// NOTE: The existing test file likely mocks firebase/firestore.
// Follow the EXACT same mock pattern as the existing tests in this directory.
// The key assertion is that getByShareCode calls getDocs with the right query constraints.
```

If there's no existing test file for this repo, skip the test step and just add the method — it's a simple Firestore query that follows the exact same pattern as `getByOrganizer()`.

**Step 2: Add `getByShareCode()` method**

In `src/data/firebase/firestoreTournamentRepository.ts`, add a new method to the repository object:

```typescript
async getByShareCode(shareCode: string): Promise<Tournament | undefined> {
  const q = query(
    collection(firestore, 'tournaments'),
    where('shareCode', '==', shareCode),
    where('visibility', '==', 'public'),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return undefined;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as Tournament;
},
```

This follows the same pattern as the existing `getByOrganizer()` method but returns a single result.

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreTournamentRepository.ts
git commit -m "feat: add getByShareCode query to tournament repository"
```

---

### Task 5: Update Firestore security rules for public tournament reads

**Files:**
- Modify: `firestore.rules`

**Step 1: Update tournament read rule**

In `firestore.rules`, the current tournament read rule (line 95) is:
```
allow read: if request.auth != null;
```

Change the tournament section to allow public reads:

```
// Any authenticated user can read tournaments
allow read: if request.auth != null;

// Public tournaments can be read without authentication
allow read: if resource.data.visibility == 'public';
```

**Step 2: Add public read rules for sub-collections**

For each sub-collection, add a public read rule. The pattern checks the parent tournament's visibility:

```
// Helper: check if parent tournament is public
function isTournamentPublic() {
  return get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.visibility == 'public';
}
```

Add this helper inside the `match /tournaments/{tournamentId}` block, right after the existing `isTournamentActive()` function (around line 144).

Then add public read rules to each sub-collection:

**Teams** (add after existing `allow read` on line 148):
```
allow read: if isTournamentPublic();
```

**Pools** (add after existing `allow read` on line 172):
```
allow read: if isTournamentPublic();
```

**Bracket** (add after existing `allow read` on line 193):
```
allow read: if isTournamentPublic();
```

**Registrations** (add after existing `allow read` on line 215):
```
allow read: if isTournamentPublic();
```

**Step 3: Add validation for `visibility` field on tournament create**

In the tournament create rule (line 98-112), add:
```
&& request.resource.data.visibility in ['private', 'public']
```

**Step 4: Verify rules syntax**

The rules file should parse without errors when deployed. You can verify by checking the file has balanced braces and valid syntax.

**Step 5: Commit**

```bash
git add firestore.rules
git commit -m "feat: allow unauthenticated reads on public tournaments"
```

---

### Task 6: Install `qrcode` dependency

**Step 1: Install the package**

Run:
```bash
cd "C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp"
npm install qrcode
npm install -D @types/qrcode
```

**Step 2: Verify installation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install qrcode library for QR code generation"
```

---

### Task 7: Create `ShareTournamentModal` component

**Files:**
- Create: `src/features/tournaments/components/ShareTournamentModal.tsx`

**Step 1: Create the component**

This modal has four sections: visibility toggle, shareable link, QR code, and email invite.

```typescript
import { createSignal, createEffect, Show } from 'solid-js';
import type { Component } from 'solid-js';
import QRCode from 'qrcode';

interface Props {
  open: boolean;
  tournamentName: string;
  tournamentDate: string;
  tournamentLocation: string;
  visibility: 'private' | 'public';
  shareCode: string | null;
  onToggleVisibility: (newVisibility: 'private' | 'public') => Promise<void>;
  onClose: () => void;
}

const ShareTournamentModal: Component<Props> = (props) => {
  const [qrDataUrl, setQrDataUrl] = createSignal('');
  const [copied, setCopied] = createSignal(false);
  const [toggling, setToggling] = createSignal(false);
  const [email, setEmail] = createSignal('');

  const shareUrl = () => {
    if (!props.shareCode) return '';
    return `${window.location.origin}/t/${props.shareCode}`;
  };

  // Generate QR code when share URL is available
  createEffect(async () => {
    const url = shareUrl();
    if (url) {
      try {
        const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 2 });
        setQrDataUrl(dataUrl);
      } catch {
        setQrDataUrl('');
      }
    } else {
      setQrDataUrl('');
    }
  });

  const handleToggleVisibility = async () => {
    if (toggling()) return;
    setToggling(true);
    try {
      const newVisibility = props.visibility === 'private' ? 'public' : 'private';
      await props.onToggleVisibility(newVisibility);
    } finally {
      setToggling(false);
    }
  };

  const handleCopyLink = async () => {
    const url = shareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
    }
  };

  const handleDownloadQr = () => {
    const dataUrl = qrDataUrl();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `${props.tournamentName.replace(/\s+/g, '-')}-qr.png`;
    link.href = dataUrl;
    link.click();
  };

  const mailtoHref = () => {
    const addr = email().trim();
    if (!addr) return '';
    const subject = encodeURIComponent(`You're invited to ${props.tournamentName}`);
    const body = encodeURIComponent(
      `Join ${props.tournamentName} on ${props.tournamentDate} at ${props.tournamentLocation}.\n\nView tournament: ${shareUrl()}`,
    );
    return `mailto:${addr}?subject=${subject}&body=${body}`;
  };

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div class="bg-surface rounded-2xl w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div class="px-4 py-3 bg-surface-light border-b border-surface-lighter flex items-center justify-between">
            <h2 class="font-bold text-on-surface text-sm">Share Tournament</h2>
            <button type="button" onClick={() => props.onClose()} class="text-on-surface-muted text-lg leading-none">&times;</button>
          </div>

          <div class="p-4 space-y-5">
            {/* Section 1: Visibility Toggle */}
            <div>
              <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">Visibility</div>
              <button
                type="button"
                onClick={handleToggleVisibility}
                disabled={toggling()}
                class="w-full flex items-center justify-between bg-surface-light rounded-xl px-4 py-3"
              >
                <span class="text-on-surface font-semibold text-sm">
                  {props.visibility === 'public' ? 'Public' : 'Private'}
                </span>
                <span class={`text-xs px-2 py-1 rounded-full font-semibold ${
                  props.visibility === 'public'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {props.visibility === 'public' ? 'Anyone with link can view' : 'Only you can see'}
                </span>
              </button>
            </div>

            {/* Section 2: Shareable Link (only when public) */}
            <Show when={props.visibility === 'public' && shareUrl()}>
              <div>
                <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">Share Link</div>
                <div class="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl()}
                    class="flex-1 bg-surface-light border border-surface-lighter rounded-lg px-3 py-2 text-on-surface text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    class={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      copied()
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-primary text-surface active:scale-95'
                    }`}
                  >
                    {copied() ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </Show>

            {/* Section 3: QR Code (only when public) */}
            <Show when={props.visibility === 'public' && qrDataUrl()}>
              <div>
                <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">QR Code</div>
                <div class="flex flex-col items-center gap-3">
                  <img src={qrDataUrl()} alt="Tournament QR Code" class="w-48 h-48 rounded-lg bg-white p-2" />
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    class="text-xs font-semibold text-primary underline"
                  >
                    Download PNG
                  </button>
                </div>
              </div>
            </Show>

            {/* Section 4: Email Invite (only when public) */}
            <Show when={props.visibility === 'public' && shareUrl()}>
              <div>
                <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">Invite by Email</div>
                <div class="flex gap-2">
                  <input
                    type="email"
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    placeholder="player@example.com"
                    class="flex-1 bg-surface-light border border-surface-lighter rounded-lg px-3 py-2 text-on-surface text-sm"
                  />
                  <a
                    href={mailtoHref() || undefined}
                    class={`px-3 py-2 text-xs font-semibold rounded-lg ${
                      mailtoHref()
                        ? 'bg-primary text-surface active:scale-95'
                        : 'bg-surface-light text-on-surface-muted cursor-not-allowed'
                    }`}
                    onClick={(e) => { if (!mailtoHref()) e.preventDefault(); }}
                  >
                    Send
                  </a>
                </div>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class="px-4 py-3 border-t border-surface-lighter">
            <button
              type="button"
              onClick={() => props.onClose()}
              class="w-full py-2 text-sm font-semibold text-on-surface-muted bg-surface-light rounded-lg active:scale-95 transition-transform"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ShareTournamentModal;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/components/ShareTournamentModal.tsx
git commit -m "feat: add ShareTournamentModal component"
```

---

### Task 8: Wire ShareTournamentModal into TournamentDashboardPage

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`
- Modify: `src/data/firebase/firestoreTournamentRepository.ts` (add `updateVisibility` method)

**Step 1: Add `updateVisibility()` to the tournament repository**

In `src/data/firebase/firestoreTournamentRepository.ts`, add:

```typescript
async updateVisibility(id: string, visibility: 'private' | 'public', shareCode: string | null): Promise<void> {
  const ref = doc(firestore, 'tournaments', id);
  await updateDoc(ref, { visibility, shareCode, updatedAt: serverTimestamp() });
},
```

**Step 2: Wire the modal into TournamentDashboardPage**

Add the following changes to `src/features/tournaments/TournamentDashboardPage.tsx`:

1. Add imports at the top:
```typescript
import ShareTournamentModal from './components/ShareTournamentModal';
import { generateShareCode } from './engine/shareCode';
```

2. Add new signal for modal state (alongside other signals around line 60-70):
```typescript
const [showShareModal, setShowShareModal] = createSignal(false);
```

3. Add the visibility toggle handler (after `handleCancelEdit` around line 460):
```typescript
const handleToggleVisibility = async (newVisibility: 'private' | 'public') => {
  const t = tournament();
  if (!t) return;

  let shareCode = t.shareCode;
  if (newVisibility === 'public' && !shareCode) {
    shareCode = generateShareCode();
  }

  await firestoreTournamentRepository.updateVisibility(t.id, newVisibility, shareCode);
  refetchTournament();
};
```

4. Add a "Share" button in the Status Card section. In the render JSX, find the Status Card `<div>` (around line 565). Add a Share button next to the status badge, visible only for the organizer:

```typescript
<Show when={isOrganizer()}>
  <button
    type="button"
    onClick={() => setShowShareModal(true)}
    class="text-sm font-semibold text-primary px-3 py-1 border border-primary/30 rounded-lg active:scale-95 transition-transform"
  >
    Share
  </button>
</Show>
```

5. Render the ShareTournamentModal at the bottom of the component tree (after the ScoreEditModal):

```typescript
<Show when={tournament()}>
  {(t) => (
    <ShareTournamentModal
      open={showShareModal()}
      tournamentName={t().name}
      tournamentDate={new Date(t().date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      tournamentLocation={t().location || 'TBD'}
      visibility={t().visibility ?? 'private'}
      shareCode={t().shareCode ?? null}
      onToggleVisibility={handleToggleVisibility}
      onClose={() => setShowShareModal(false)}
    />
  )}
</Show>
```

**Step 3: Run type check and tests**

Run: `npx tsc --noEmit`
Expected: No errors

Run: `npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx src/data/firebase/firestoreTournamentRepository.ts
git commit -m "feat: wire ShareTournamentModal into tournament dashboard"
```

---

### Task 9: Create `PublicTournamentPage` and public route

**Files:**
- Create: `src/features/tournaments/PublicTournamentPage.tsx`
- Modify: `src/app/router.tsx`

**Step 1: Create PublicTournamentPage**

This is a lightweight page that resolves a share code to a tournament and renders a read-only version of the dashboard.

Create `src/features/tournaments/PublicTournamentPage.tsx`:

```typescript
import { createResource, Show, For, Switch, Match } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { firestoreTeamRepository } from '../../data/firebase/firestoreTeamRepository';
import { firestorePoolRepository } from '../../data/firebase/firestorePoolRepository';
import { firestoreBracketRepository } from '../../data/firebase/firestoreBracketRepository';
import PoolTable from './components/PoolTable';
import BracketView from './components/BracketView';
import TournamentResults from './components/TournamentResults';
import { statusLabels, statusColors, formatLabels } from './constants';
import type { TournamentPool } from '../../data/types';

const PublicTournamentPage: Component = () => {
  const params = useParams();

  const [tournament] = createResource(
    () => params.code,
    (code) => firestoreTournamentRepository.getByShareCode(code),
  );

  const [teams] = createResource(
    () => tournament()?.id,
    (id) => (id ? firestoreTeamRepository.getByTournament(id) : Promise.resolve([])),
  );

  const [pools] = createResource(
    () => {
      const t = tournament();
      if (!t) return null;
      const hasPoolPlay = t.format === 'round-robin' || t.format === 'pool-bracket';
      const pastRegistration = ['pool-play', 'bracket', 'completed'].includes(t.status);
      if (hasPoolPlay && pastRegistration) return t.id;
      return null;
    },
    (id) => (id ? firestorePoolRepository.getByTournament(id) : Promise.resolve([])),
  );

  const [bracketSlots] = createResource(
    () => {
      const t = tournament();
      if (!t) return null;
      const hasBracket = t.format === 'single-elimination' || t.format === 'pool-bracket';
      const inBracketPhase = ['bracket', 'completed'].includes(t.status);
      if (hasBracket && inBracketPhase) return t.id;
      return null;
    },
    (id) => (id ? firestoreBracketRepository.getByTournament(id) : Promise.resolve([])),
  );

  const teamNames = () => {
    const t = teams();
    if (!t) return {};
    const map: Record<string, string> = {};
    for (const team of t) {
      map[team.id] = team.name;
    }
    return map;
  };

  const showPoolTables = () => {
    const t = tournament();
    if (!t) return false;
    return ['pool-play', 'bracket', 'completed'].includes(t.status)
      && (t.format === 'round-robin' || t.format === 'pool-bracket');
  };

  const showBracketView = () => {
    const t = tournament();
    if (!t) return false;
    return ['bracket', 'completed'].includes(t.status)
      && (t.format === 'single-elimination' || t.format === 'pool-bracket');
  };

  return (
    <PageLayout title={tournament()?.name ?? 'Tournament'}>
      <div class="p-4 space-y-6">
        <Switch>
          <Match when={tournament.loading}>
            <div class="flex flex-col items-center justify-center py-16 gap-3">
              <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p class="text-sm text-on-surface-muted">Loading tournament...</p>
            </div>
          </Match>
          <Match when={tournament.error || (!tournament.loading && !tournament())}>
            <div class="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <p class="text-xl font-bold text-on-surface">Tournament Not Found</p>
              <p class="text-on-surface-muted text-sm">
                This tournament doesn't exist or is set to private.
              </p>
              <a href="/" class="inline-block px-6 py-3 bg-primary text-surface font-semibold rounded-xl active:scale-95 transition-transform">
                Back to Home
              </a>
            </div>
          </Match>
          <Match when={tournament()}>
            {(t) => (
              <>
                {/* Status Card */}
                <div class="bg-surface-light rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div class="text-xs text-on-surface-muted uppercase tracking-wider">Status</div>
                    <span class={`inline-block mt-1 text-sm font-bold px-3 py-1 rounded-full ${statusColors[t().status] ?? ''}`}>
                      {statusLabels[t().status] ?? t().status}
                    </span>
                  </div>
                </div>

                {/* Info Grid */}
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-surface-light rounded-xl p-4">
                    <div class="text-xs text-on-surface-muted uppercase tracking-wider">Date</div>
                    <div class="font-semibold text-on-surface">
                      {new Date(t().date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div class="bg-surface-light rounded-xl p-4">
                    <div class="text-xs text-on-surface-muted uppercase tracking-wider">Location</div>
                    <div class="font-semibold text-on-surface">{t().location || 'TBD'}</div>
                  </div>
                  <div class="bg-surface-light rounded-xl p-4">
                    <div class="text-xs text-on-surface-muted uppercase tracking-wider">Format</div>
                    <div class="font-semibold text-on-surface">{formatLabels[t().format] ?? t().format}</div>
                  </div>
                  <div class="bg-surface-light rounded-xl p-4">
                    <div class="text-xs text-on-surface-muted uppercase tracking-wider">Teams</div>
                    <div class="font-semibold text-on-surface">
                      {teams()?.length ?? 0}{t().maxPlayers ? ` / ${t().maxPlayers}` : ''}
                    </div>
                  </div>
                </div>

                {/* Tournament Results */}
                <Show when={t().status === 'completed'}>
                  <TournamentResults
                    format={t().format}
                    poolStandings={pools()?.[0]?.standings}
                    bracketSlots={bracketSlots() ?? undefined}
                    teamNames={teamNames()}
                  />
                </Show>

                {/* Pool Tables (read-only — no onScoreMatch, no onEditMatch) */}
                <Show when={showPoolTables() && (pools()?.length ?? 0) > 0}>
                  <div class="space-y-4">
                    <h2 class="font-bold text-on-surface text-lg">Pool Standings</h2>
                    <For each={pools()}>
                      {(pool) => (
                        <PoolTable
                          poolId={pool.id}
                          poolName={pool.name}
                          standings={pool.standings}
                          teamNames={teamNames()}
                          advancingCount={t().config.teamsPerPoolAdvancing ?? 2}
                          schedule={pool.schedule}
                        />
                      )}
                    </For>
                  </div>
                </Show>

                {/* Bracket View (read-only — no onScoreMatch, no onEditMatch) */}
                <Show when={showBracketView() && (bracketSlots()?.length ?? 0) > 0}>
                  <div class="space-y-4">
                    <h2 class="font-bold text-on-surface text-lg">Bracket</h2>
                    <BracketView
                      slots={bracketSlots()!}
                      teamNames={teamNames()}
                    />
                  </div>
                </Show>

                {/* Registration info for spectators */}
                <Show when={t().status === 'registration'}>
                  <div class="bg-surface-light rounded-xl p-4 text-center">
                    <p class="text-on-surface font-semibold">Registration is Open</p>
                    <p class="text-on-surface-muted text-sm mt-1">
                      {(teams()?.length ?? 0)} player(s) registered
                      {t().maxPlayers ? ` out of ${t().maxPlayers}` : ''}
                    </p>
                  </div>
                </Show>
              </>
            )}
          </Match>
        </Switch>
      </div>
    </PageLayout>
  );
};

export default PublicTournamentPage;
```

**Step 2: Add the public route**

In `src/app/router.tsx`, add:

1. Import the new page (with lazy loading):
```typescript
const PublicTournamentPage = lazy(() => import('../features/tournaments/PublicTournamentPage'));
```

2. Add the public route BEFORE the `*` catch-all route, and OUTSIDE the `RequireAuth` wrapper:
```typescript
<Route path="/t/:code" component={PublicTournamentPage} />
```

The full router should look like:
```typescript
<Router root={App}>
  <Route path="/" component={GameSetupPage} />
  <Route path="/score/:matchId" component={ScoringPage} />
  <Route path="/history" component={HistoryPage} />
  <Route path="/players" component={PlayersPage} />
  <Route path="/tournaments" component={RequireAuth}>
    <Route path="/" component={TournamentListPage} />
    <Route path="/new" component={TournamentCreatePage} />
    <Route path="/:id" component={TournamentDashboardPage} />
  </Route>
  <Route path="/t/:code" component={PublicTournamentPage} />
  <Route path="/settings" component={SettingsPage} />
  <Route path="*" component={NotFoundPage} />
</Router>
```

**Step 3: Run type check and tests**

Run: `npx tsc --noEmit`
Expected: No errors

Run: `npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/features/tournaments/PublicTournamentPage.tsx src/app/router.tsx
git commit -m "feat: add public tournament page and /t/:code route"
```

---

### Task 10: E2E verification — Share flow

**Prerequisites:** Dev server running (`npx vite --port 5199`), Firebase emulators running.

**Test scenario:**

1. Sign in as organizer
2. Create a new tournament (any format)
3. On the dashboard, verify "Share" button is visible
4. Tap "Share" → modal opens
5. Visibility shows "Private"
6. Tap visibility toggle → changes to "Public"
7. Share link appears with a `/t/` URL
8. QR code is visible
9. Copy the share link
10. Open a new incognito/unsigned-in browser tab with the copied URL
11. Verify the tournament loads (name, date, location, format visible)
12. Verify no organizer controls are shown (no "Advance" button, no "Edit" buttons)
13. Advance the tournament (as organizer) through registration → bracket → score matches → complete
14. Refresh the public view — verify standings/bracket/champion visible
15. Toggle visibility back to "Private" in the Share modal
16. Refresh the public URL — verify "Tournament Not Found" message

Use Playwright to automate this test via the browser.

---

### Task 11: Firestore index for shareCode query

**Files:**
- Modify or create: `firestore.indexes.json` (if it exists), or note that the Firestore emulator may auto-create indexes.

The `getByShareCode()` query uses a composite filter (`shareCode == X AND visibility == 'public'`). Firestore requires a composite index for this.

**Step 1: Check if `firestore.indexes.json` exists**

If it exists, add the index. If not, Firestore emulator auto-creates indexes and you may get a link in the console error if the index is missing.

Add to indexes:
```json
{
  "collectionGroup": "tournaments",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "shareCode", "order": "ASCENDING" },
    { "fieldPath": "visibility", "order": "ASCENDING" }
  ]
}
```

**Step 2: Test the query works**

If using emulators, the query should work without a predefined index. If deploying to production, the index must be created.

**Step 3: Commit**

```bash
git add firestore.indexes.json
git commit -m "chore: add Firestore index for shareCode + visibility query"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Create feature branch | None |
| 2 | Add `visibility`/`shareCode` to Tournament type | Task 1 |
| 3 | Implement `generateShareCode()` + tests | Task 1 |
| 4 | Add `getByShareCode()` to repository | Task 2 |
| 5 | Update Firestore security rules | Task 2 |
| 6 | Install `qrcode` dependency | Task 1 |
| 7 | Create ShareTournamentModal | Tasks 2, 3, 6 |
| 8 | Wire modal into dashboard | Tasks 4, 7 |
| 9 | Create PublicTournamentPage + route | Tasks 4, 5 |
| 10 | E2E verification | Tasks 8, 9 |
| 11 | Firestore index for shareCode query | Task 4 |
