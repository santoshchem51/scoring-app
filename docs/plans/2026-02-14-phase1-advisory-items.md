# Phase 1: Fix & Foundation — Advisory Items

**Date**: 2026-02-14
**Status**: All resolved (commit `48cc2e1`)
**Source**: Post-implementation testing (132/132 tests passed)

---

## Accessibility

### 1. ConfirmDialog static IDs — RESOLVED
- **File**: `src/shared/components/ConfirmDialog.tsx`
- **Fix applied**: Uses `createUniqueId()` from SolidJS for unique aria IDs per instance.

### 2. Input focus:outline-none vs focus-visible — RESOLVED
- **Files**: `GameSetupPage.tsx`, `AddPlayerForm.tsx`
- **Fix applied**: Removed `focus:outline-none` from inputs, relying on global `focus-visible` outline.

### 3. MatchCard lacks semantic grouping — RESOLVED
- **File**: `src/features/history/components/MatchCard.tsx`
- **Fix applied**: Changed outer div to `<article>` with `aria-label`. History list wrapped in `<ul role="list">` + `<li>`.

## Visual / Layout

### 4. Delete button touch target is 44px — RESOLVED
- **File**: `src/features/players/components/PlayerCard.tsx`
- **Fix applied**: Added `min-h-[48px]` to delete button.

### 5. iPad max-width could be wider — RESOLVED
- **Files**: `PageLayout.tsx`, `BottomNav.tsx`
- **Fix applied**: Phase 3 tablet layout bumped to `md:max-w-3xl` with two-column grids.

### 6. Landscape non-scoring pages cramped — RESOLVED
- **Fix applied**: Added CSS media query for compact BottomNav in landscape (`max-height: 500px`).
