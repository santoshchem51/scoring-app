# Phase 2: Premium Feel — Advisory Items

**Date**: 2026-02-14
**Status**: All resolved (commit `48cc2e1`)
**Source**: Post-implementation testing (92/96 checks passed)

---

## Visual / Layout

### 1. Landscape empty state CTA hidden behind nav — RESOLVED
- **Files**: `src/shared/components/EmptyState.tsx`
- **Fix applied**: Reduced padding to `py-8 md:py-16` for short viewports.

## Accessibility

### 2. EmptyState decorative icons lack aria-hidden — RESOLVED
- **File**: `src/shared/components/EmptyState.tsx`
- **Fix applied**: Added `aria-hidden="true"` on icon container div.

### 3. List structure for repeated items — RESOLVED
- **Files**: `src/features/history/HistoryPage.tsx`, `src/features/players/PlayersPage.tsx`
- **Fix applied**: Wrapped lists in `<ul role="list">` with `<li>` wrapping each card.

### 4. Skeleton components lack standalone accessibility — RESOLVED
- **File**: `src/shared/components/Skeleton.tsx`
- **Fix applied**: Added `role="status" aria-label="Loading content"` to PageSkeleton.
