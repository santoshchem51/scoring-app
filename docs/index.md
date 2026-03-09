# Documentation Index

Developer documentation for PickleScore.

## Document Guide

| Document | Purpose | Audience |
|----------|---------|----------|
| [README](../README.md) | Project overview, quick start | Everyone |
| [Setup](setup.md) | Prerequisites, env config, troubleshooting | New developers |
| [Architecture](architecture.md) | System design, data flow, state management | Developers understanding the system |
| [Data Model](data-model.md) | Dexie tables, Firestore collections, sync queue schema | Developers touching data or sync |
| [Features](features.md) | Feature module index, dependencies, key files | Developers finding where to work |
| [Testing Guide](testing-guide.md) | Running tests, writing tests, SolidJS gotchas | Developers writing or running tests |
| [Debugging](debugging.md) | Inspecting state, sync queue, common issues | Developers troubleshooting |
| [Contributing](../CONTRIBUTING.md) | Workflow, code conventions, PR process | Contributors |

## Not in docs/

| File | Location | Purpose |
|------|----------|---------|
| [CLAUDE.md](../CLAUDE.md) | Root | Canonical command reference and SolidJS rules (for AI and developers) |
| [ROADMAP.md](../ROADMAP.md) | Root | Feature status and priority tracking |
| [Design plans](plans/) | `docs/plans/` | Historical design documents from brainstorming sessions |
| [Reviews](reviews/) | `docs/reviews/` | Specialist reviews of design decisions |
| [Manual Test Plan](MANUAL_TEST_PLAN.md) | `docs/` | Manual test cases for critical workflows |

## Reading Paths

### New developer (first day)

1. [README](../README.md) — What is this project?
2. [Setup](setup.md) — Get it running locally
3. [Architecture](architecture.md) — Understand the system
4. [Features](features.md) — Find the module you'll work on
5. [Contributing](../CONTRIBUTING.md) — Learn the workflow

### Picking up a task

1. [Features](features.md) — Find the relevant module
2. [Design plans](plans/) — Check if there's a plan for the feature
3. [Testing Guide](testing-guide.md) — Write the failing test first
4. [Contributing](../CONTRIBUTING.md) — Follow the TDD workflow

### Debugging a data issue

1. [Debugging](debugging.md) — Inspect sync queue, IndexedDB, Firestore
2. [Data Model](data-model.md) — Understand the schema
3. [Architecture](architecture.md) — Understand the sync flow

### Reviewing a PR

1. [Contributing](../CONTRIBUTING.md) — PR checklist and conventions
2. [Testing Guide](testing-guide.md) — Verify test coverage
