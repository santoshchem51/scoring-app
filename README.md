# PickleScore

Offline-first pickleball scoring and tournament management PWA. Score matches courtside (even without internet), run tournaments with pools and brackets, track player stats, and compete on leaderboards.

## Features

- **Match Scoring** — Sideout and rally scoring, singles and doubles, configurable points, win-by-2, best-of-N
- **Tournaments** — Create tournaments with round-robin pools, single/double elimination brackets, live scoring
- **Buddy Groups** — Organize casual play sessions, invite friends, track who's playing
- **Leaderboards** — Global and friends rankings with tier-based composite scoring
- **Achievements** — Badge system with progression tiers
- **Player Profiles** — Stats dashboard, match history, tier ratings
- **Offline-First** — Full functionality without internet; syncs to cloud when online
- **PWA** — Installable on any device, works like a native app

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | SolidJS 1.9 + TypeScript 5.9 |
| Build | Vite 7.3 |
| Styling | Tailwind CSS v4 |
| State | XState v5 (scoring engine), SolidJS signals (everything else) |
| Local DB | Dexie.js (IndexedDB) |
| Cloud | Firebase (Firestore + Auth) |
| Testing | Vitest, Playwright, Firebase Rules Testing |
| PWA | vite-plugin-pwa |

## Quick Start

```bash
git clone https://github.com/santoshchem51/scoring-app.git
cd scoring-app
npm install
cp .env.example .env.local   # Add your Firebase credentials (optional for local dev)
npx vite --port 5199          # Starts on http://localhost:5199
```

For full setup including Firebase emulators, see [docs/setup.md](docs/setup.md).

## Development Commands

| Command | Purpose |
|---------|---------|
| `npx vite --port 5199` | Dev server |
| `npx vitest run` | Unit & component tests |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run test:rules` | Firestore security rules tests |
| `npx tsc --noEmit` | Type check |
| `npm run build` | Production build |
| `npm run emulator:start` | Firebase emulators |

## Project Structure

```
src/
├── features/          11 feature modules (scoring, tournaments, buddies, ...)
├── data/              Dexie DB, Firebase repos, sync queue, types
├── shared/            Reusable components, hooks, utils
├── stores/            App-level stores (settings, achievements, notifications)
└── app/               Root App component
```

## Documentation

Start here based on what you need:

| I want to... | Read |
|--------------|------|
| Set up my dev environment | [Setup Guide](docs/setup.md) |
| Understand the architecture | [Architecture](docs/architecture.md) |
| Find a feature's code | [Feature Modules](docs/features.md) |
| Run or write tests | [Testing Guide](docs/testing-guide.md) |
| Debug a data/sync issue | [Debugging Guide](docs/debugging.md) |
| Contribute code | [Contributing](CONTRIBUTING.md) |
| See all docs | [Documentation Index](docs/index.md) |

## License

[MIT](LICENSE)
