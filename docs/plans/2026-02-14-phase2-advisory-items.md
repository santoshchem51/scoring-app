# Phase 2: Premium Feel — Advisory Items

**Date**: 2026-02-14
**Status**: Noted for future phases
**Source**: Post-implementation testing (92/96 checks passed)

---

## Visual / Layout

### 1. Landscape empty state CTA hidden behind nav
- **File**: `src/features/history/HistoryPage.tsx`, `src/shared/components/EmptyState.tsx`
- **Issue**: At 667×375 landscape, the "Start a Game" CTA button in the Match History empty state is hidden behind the fixed bottom nav. The `py-16` padding + `justify-center` positioning pushes the CTA below the nav, and the content area doesn't scroll.
- **Fix**: Reduce `py-16` padding on EmptyState for short viewports (e.g., `py-8` when `max-h-[500px]`), or ensure the content area scrolls past the nav.
- **Priority**: Low — landscape on non-scoring pages is a secondary use case.

## Accessibility

### 2. EmptyState decorative icons lack aria-hidden
- **Files**: `src/features/history/HistoryPage.tsx`, `src/features/players/PlayersPage.tsx`
- **Issue**: SVG icons passed to EmptyState's `icon` prop don't have `aria-hidden="true"`. Screen readers may attempt to describe SVG path data.
- **Fix**: Add `aria-hidden="true"` to the icon container div in `EmptyState.tsx` (line 16), which ensures all icons are decorative regardless of call site.
- **Priority**: Low — icons are supplementary to the title text.

### 3. List structure for repeated items
- **Files**: `src/features/history/HistoryPage.tsx`, `src/features/players/PlayersPage.tsx`
- **Issue**: Match cards and player cards are rendered as sibling `<div>` elements without `<ul>`/`<li>` list semantics. Screen readers can't announce item count or navigate by list.
- **Fix**: Wrap `<For>` output in `<ul role="list">` and each card in `<li>`.
- **Priority**: Low — content is still accessible, just lacks list navigation.
- **Note**: Overlaps with Phase 1 Advisory #3 (MatchCard semantic grouping).

### 4. Skeleton components lack standalone accessibility
- **File**: `src/shared/components/Skeleton.tsx`
- **Issue**: `PageSkeleton` and `CardSkeleton` components don't have `role="status"` or `aria-label`. The App.tsx Suspense wrapper provides these attributes, but standalone use elsewhere would lack screen reader announcements.
- **Fix**: Add `role="status" aria-label="Loading content"` to PageSkeleton's root div.
- **Priority**: Low — currently only used inside App.tsx Suspense fallback which already has proper attributes.
