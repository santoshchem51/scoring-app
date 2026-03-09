# Testing Guide

PickleScore has ~1160 tests across three test runners.

## Test Runners Overview

| Runner | Config | Purpose | Count |
|--------|--------|---------|-------|
| **Vitest** | `vitest.config.ts` (via vite.config) | Unit + component tests | ~110 files |
| **Playwright** | `playwright.config.ts` | End-to-end browser tests | ~38 suites |
| **Vitest (rules)** | `vitest.rules.config.ts` | Firestore security rules | ~60 tests |

## Running Tests

### Unit & Component Tests

```bash
# Run all unit/component tests
npx vitest run

# Run in watch mode
npx vitest

# Run a specific test file
npx vitest run src/features/scoring/engine/__tests__/pickleballMachine.test.ts

# Run tests matching a pattern
npx vitest run -t "win-by-2"
```

Config: jsdom environment, `src/test-setup.ts` for globals. Excludes `e2e/`, `test/rules/`, `.worktrees/`.

### E2E Tests (Playwright)

```bash
# Run all E2E tests (auto-starts emulators + dev server)
npm run test:e2e

# Run in headed mode (see the browser)
npm run test:e2e:headed

# Run buddy-specific E2E tests
npm run test:e2e:buddies

# Run a specific test file
npx playwright test e2e/scoring.spec.ts
```

Playwright auto-starts:
- Firebase emulators (Auth on 9099, Firestore on 8180)
- Vite dev server on port 5199

Test device: Pixel 5 emulation.

### Firestore Security Rules Tests

```bash
# Run rules tests (starts emulator, runs tests, stops emulator)
npm run test:rules
```

This uses `firebase emulators:exec` to start the Firestore emulator, run the tests, and stop. Config: Node.js environment (not jsdom), 30s timeout, no file parallelism.

Test location: `test/rules/**/*.test.ts`

## Writing Tests

### File Placement

Tests go next to the code they test:

```
src/features/scoring/engine/pickleballMachine.ts
src/features/scoring/engine/__tests__/pickleballMachine.test.ts

src/shared/hooks/useAuth.ts
src/shared/hooks/__tests__/useAuth.test.ts
```

Security rules tests are separate:

```
firestore.rules
test/rules/*.test.ts
```

### SolidJS Testing Patterns

**Rendering components** (use `@solidjs/testing-library`):

```typescript
import { render, screen } from '@solidjs/testing-library';

test('shows score', () => {
  render(() => <Scoreboard score={5} />);
  expect(screen.getByText('5')).toBeInTheDocument();
});
```

**Important SolidJS gotchas:**
- Props are not destructured in components, so pass them as object properties
- Use `render(() => <Component />)` (note the arrow function wrapper)
- SolidJS signals only update inside reactive contexts — `createRoot` may be needed in some tests
- Use `import type` for type imports (enforced by `verbatimModuleSyntax`)

### E2E Auth in Playwright

Firebase auth in E2E tests uses the app's own Firebase config, not a separate auth instance:

```typescript
// Import from the Vite-resolved Firebase path
import { signInWithEmailAndPassword } from '/node_modules/firebase/auth/dist/esm/index.esm.js';
```

SolidJS input reactivity in Playwright requires using the property descriptor pattern:

```typescript
// Standard fill doesn't trigger SolidJS reactivity
// Use this instead:
const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
setter.call(input, 'new value');
input.dispatchEvent(new Event('input', { bubbles: true }));
```

### Dexie (IndexedDB) in Tests

Unit tests use `fake-indexeddb` (see `src/test-setup.ts`). No real browser IndexedDB needed.

## Type Checking

```bash
npx tsc --noEmit
```

Run this before committing. TypeScript is strict with `verbatimModuleSyntax: true`.

## Related Docs

- [Setup](setup.md) — Installing prerequisites (Firebase CLI, Java, Playwright browsers)
- [Architecture](architecture.md) — Understanding what you're testing
- [Data Model](data-model.md) — Schema reference for rules tests
- [Contributing](../CONTRIBUTING.md) — TDD workflow and commit conventions
