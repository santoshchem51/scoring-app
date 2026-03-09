# Development Setup

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| npm | 10+ | Comes with Node.js |
| Java | 11+ | Required for Firebase emulators |
| Firebase CLI | 13+ | `npm install -g firebase-tools` |

> **Java check**: Run `java -version`. Firebase emulators will fail silently without it.

## Initial Setup

```bash
# Clone the repository
git clone https://github.com/santoshchem51/scoring-app.git
cd scoring-app

# Install dependencies
npm install

# Install Playwright browsers (for E2E tests)
npx playwright install

# Copy environment template
cp .env.example .env.local
```

## Environment Variables

Edit `.env.local` with your Firebase project credentials:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

For local development with emulators, the values above are only needed for production builds. The app auto-connects to emulators in dev mode unless `VITE_USE_EMULATORS=false`.

## Running the App

```bash
# Start dev server (port 5199)
npx vite --port 5199

# Start Firebase emulators (Firestore on 8180, Auth on 9099)
npm run emulator:start
```

The Firebase emulator UI is available at http://localhost:4000.

## Firebase Emulator Setup

The app uses two Firebase emulators:

| Service | Port | Purpose |
|---------|------|---------|
| Firestore | 8180 | Cloud database |
| Auth | 9099 | Authentication |
| Emulator UI | 4000 | Admin dashboard |

**Port conflicts**: If another Firebase project uses the same ports, edit `firebase.json` to change them. Update `src/data/firebase/config.ts` emulator connection to match.

## Build

```bash
# Type check
npx tsc --noEmit

# Production build
npm run build

# Preview production build
npm run preview
```

## Troubleshooting

### Firebase emulators won't start
- Ensure Java 11+ is installed: `java -version`
- Check port availability: `lsof -i :8180` (macOS/Linux) or `netstat -ano | findstr 8180` (Windows)
- Kill orphaned emulator processes if ports are occupied

### `VITE_FIREBASE_*` errors on startup
- Ensure `.env.local` exists with all required variables
- Restart the dev server after changing env vars (Vite doesn't hot-reload env)

### Tests fail with "Firebase not initialized"
- Start emulators first: `npm run emulator:start`
- For E2E tests, the Playwright config auto-starts emulators

### SolidJS reactivity issues in development
- Never destructure props — always use `props.foo`
- Use `class` not `className`
- Check the [SolidJS rules in CLAUDE.md](../CLAUDE.md) for the full list

## Related Docs

- [README](../README.md) — Project overview and quick reference
- [Contributing](../CONTRIBUTING.md) — Workflow and code conventions
- [Testing Guide](testing-guide.md) — How to run and write tests
