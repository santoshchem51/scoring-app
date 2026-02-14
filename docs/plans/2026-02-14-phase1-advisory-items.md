# Phase 1: Fix & Foundation — Advisory Items

**Date**: 2026-02-14
**Status**: Noted for future phases
**Source**: Post-implementation testing (132/132 tests passed)

---

## Accessibility

### 1. ConfirmDialog static IDs
- **File**: `src/shared/components/ConfirmDialog.tsx`
- **Issue**: Uses hardcoded `confirm-title` and `confirm-message` IDs. If two ConfirmDialogs render simultaneously, duplicate IDs violate HTML spec.
- **Fix**: Generate unique IDs per instance (e.g., `createUniqueId()` from SolidJS).
- **Priority**: Low — currently only one dialog renders at a time.

### 2. Input focus:outline-none vs focus-visible
- **Files**: `GameSetupPage.tsx`, `AddPlayerForm.tsx`
- **Issue**: Inputs use Tailwind `focus:outline-none` + `focus:border-primary`, which partially overrides the global `input:focus-visible` outline style. Border color change still provides visible feedback.
- **Fix**: Remove `focus:outline-none` from inputs, rely on global `focus-visible` outline.
- **Priority**: Low — keyboard users still see border color change.

### 3. MatchCard lacks semantic grouping
- **File**: `src/features/history/components/MatchCard.tsx`
- **Issue**: Match cards use plain `<div>` elements without `role` or `aria-label`. Screen readers can't distinguish individual matches.
- **Fix**: Wrap match list in `<ul>`, each card in `<li>`, or use `<article>` elements.
- **Priority**: Low — history page is read-only, no complex interaction.

## Visual / Layout

### 4. Delete button touch target is 44px
- **File**: `src/features/players/components/PlayerCard.tsx`
- **Issue**: Delete button is exactly 44px tall (Apple minimum). BottomNav links use 48px.
- **Fix**: Add `min-h-[48px]` to delete button for consistency.
- **Priority**: Low — meets minimum, could be better.

### 5. iPad max-width could be wider
- **Files**: `PageLayout.tsx`, `BottomNav.tsx`
- **Issue**: At 768px+, content uses `max-w-xl` (576px), leaving ~192px unused on iPad.
- **Fix**: Consider `max-w-2xl` (672px) at larger breakpoints. Full tablet layout deferred to Phase 3.
- **Priority**: Low — functional, just not optimal for tablet.

### 6. Landscape non-scoring pages cramped
- **Files**: `GameSetupPage.tsx`, `SettingsPage.tsx`
- **Issue**: Fixed Start button (60px) + BottomNav (60px) consume 33% of 375px landscape viewport, leaving only ~255px for scrollable content.
- **Fix**: Consider hiding BottomNav in landscape on all pages, or collapsing the Start button into the header.
- **Priority**: Low — scoring page (the primary landscape use case) already has full-screen layout.
