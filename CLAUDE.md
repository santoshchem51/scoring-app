# PickleScore — Offline-First Pickleball Scoring PWA

## Stack
SolidJS 1.9 + TypeScript + Vite 6 + Tailwind CSS v4 + XState v5 + Dexie.js

## SolidJS Rules (CRITICAL — follow these exactly)
- `import type` for type-only imports (`verbatimModuleSyntax: true`)
- Use `class` NOT `className`
- NEVER destructure props — always use `props.foo`
- Signals: `createSignal`, Effects: `createEffect`, `on()` for watching
- Components: `Show`, `For`, `Switch/Match`
- Unique IDs: `createUniqueId()` from solid-js

## Architecture
- Feature-based: `src/features/{scoring,history,players,settings}/`
- Shared: `src/shared/{components,hooks,utils,constants}/`
- Data: `src/data/{db.ts,types.ts,repositories/,useLiveQuery.ts}`
- Scoring engine: XState v5 machine at `src/features/scoring/engine/pickleballMachine.ts`

## Key Patterns
- **Settings store** (`src/stores/settingsStore.ts`): Uses `DEFAULTS` merged with localStorage. When adding new fields, always add to `DEFAULTS` — existing users' localStorage won't have them.
- **Win-by-2 rule**: `score >= pointsToWin && score - opponentScore >= 2`
- **Firebase config**: reads from `VITE_FIREBASE_*` env vars in `src/data/firebase/config.ts`

## Commands
- **Tests**: `npx vitest run`
- **Dev server**: `npx vite --port 5199`
- **Build**: `npx vite build`
- **Type check**: `npx tsc --noEmit`
