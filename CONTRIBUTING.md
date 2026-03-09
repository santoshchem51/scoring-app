# Contributing to PickleScore

## Development Workflow

PickleScore follows a disciplined development workflow enforced by the Superpowers plugin. Every change — feature, bugfix, or refactor — follows these steps:

1. **Brainstorm** — Explore the design before writing code
2. **Plan** — Break work into bite-sized tasks with full code examples
3. **Implement with TDD** — Failing test first, then minimal implementation
4. **Verify** — Run tests, check output, then claim done

No exceptions. Simple changes get simple brainstorms and short plans, but every change goes through the process.

## Code Conventions

### SolidJS Rules (Critical)

These rules are enforced project-wide. Breaking them causes silent bugs that TypeScript won't catch.

**Never destructure props:**
```typescript
// WRONG — destroys reactivity
function Score({ score, player }: Props) {
  return <div>{score}</div>;
}

// CORRECT — preserves reactivity
function Score(props: Props) {
  return <div>{props.score}</div>;
}
```

**Use `class`, not `className`:**
```typescript
// WRONG
<div className="text-lg">

// CORRECT
<div class="text-lg">
```

**Use `import type` for type-only imports:**
```typescript
// WRONG — will cause build errors (verbatimModuleSyntax)
import { Match } from '../data/types';

// CORRECT
import type { Match } from '../data/types';
```

**SolidJS control flow:**
```typescript
// Use Show, For, Switch/Match — not ternaries or .map()
<Show when={props.isVisible}>
  <For each={props.items}>
    {(item) => <ItemCard item={item} />}
  </For>
</Show>
```

### TypeScript

- Strict mode enabled
- `verbatimModuleSyntax: true` — must use `import type` for types
- Run `npx tsc --noEmit` before committing

### Settings Store

When adding new settings fields, always add to `DEFAULTS` in `src/stores/settingsStore.ts`. Existing users' localStorage won't have the new field — the default bridges the gap.

## Commit Messages

Use conventional style:

```
feat: add buddy picker to game setup
fix: prevent phantom achievement toasts
refactor: extract tier engine to shared utils
test: add leaderboard security rules tests
docs: add architecture documentation
```

## Pull Request Process

1. Create a feature branch from `main`
2. Follow the TDD workflow (failing test → implementation → verify)
3. Ensure all tests pass: `npx vitest run`
4. Ensure types check: `npx tsc --noEmit`
5. Fill out the PR template (tests written, verified, conventions followed)
6. Request review

## Branch Strategy

- `main` — stable, deployable
- `feature/<name>` — feature branches (short-lived)
- Worktrees available via `.worktrees/` for isolated feature work

## Related Docs

- [Setup](docs/setup.md) — Getting your development environment running
- [Testing Guide](docs/testing-guide.md) — How to run and write tests
- [Architecture](docs/architecture.md) — Understanding the system
- [CLAUDE.md](CLAUDE.md) — Canonical reference for commands and conventions
