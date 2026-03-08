# PickleScore Documentation Suite — Design

**Date**: 2026-03-08
**Status**: Approved

## Goal

Create comprehensive developer documentation for PickleScore to enable new contributors to go from clone to productive contributor efficiently.

## Specialist Reviews Conducted

- **DX Specialist**: Reading order, setup troubleshooting, XState onboarding, DEBUGGING.md recommendation
- **OSS Best Practices**: LICENSE, CODE_OF_CONDUCT, SECURITY, .github/ templates, lowercase naming
- **Info Architecture**: Overlap boundaries (CLAUDE.md canonical for commands), docs/index.md navigation hub, CONTRIBUTING split
- **Technical Accuracy**: Zustand unused (remove from docs), sync queue underrepresented, all 12 features verified

## Key Decisions

1. **State management claim**: Solid signals (primary) + XState (scoring only). Zustand is in package.json but never imported — omit from docs.
2. **CLAUDE.md is canonical** for commands and workflow rules. Human docs reference it, not duplicate.
3. **docs/plans/ owns design rationale**. ARCHITECTURE.md describes current state only.
4. **FEATURES.md has no status tracking** (that's ROADMAP.md's job).
5. **Lowercase with hyphens** for docs/ files (OSS convention).
6. **Setup separated from CONTRIBUTING** to keep CONTRIBUTING focused on workflow.

## Documentation Suite

### Root Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview, features, tech stack, quick-start setup, reading order, dev commands |
| `LICENSE` | MIT license |
| `CONTRIBUTING.md` | Superpowers workflow, code conventions (with SolidJS before/after examples), PR process |
| `CODE_OF_CONDUCT.md` | Contributor Covenant |
| `SECURITY.md` | Vulnerability reporting process |

### docs/ Files

| File | Purpose | Boundary Rule |
|------|---------|---------------|
| `docs/index.md` | Navigation hub, reading paths by role | No content summaries — scope and audience only |
| `docs/architecture.md` | System overview, feature pattern, state management, sync queue deep-dive | Current state only; links to plans/ for rationale |
| `docs/data-model.md` | Dexie tables, Firestore collections, sync queue mechanics, security rules | Schema and structure; no architectural "why" |
| `docs/testing-guide.md` | 3 test runners, SolidJS testing gotchas, Firebase emulator, E2E auth patterns | Testing-specific; code conventions in CONTRIBUTING |
| `docs/features.md` | 12 feature modules index, dependencies, per-feature summaries | No status/priority (that's ROADMAP.md) |
| `docs/debugging.md` | Sync queue troubleshooting, XState inspection, Dexie/IndexedDB, service worker, common issues | Operational how-to, not architecture |
| `docs/setup.md` | Prerequisites, env config, Firebase emulator setup, port conflicts, troubleshooting | Task-oriented; abandoned after setup |

### .github/ Templates

| File | Purpose |
|------|---------|
| `.github/ISSUE_TEMPLATE/bug_report.md` | Structured bug reports |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Structured feature requests |
| `.github/ISSUE_TEMPLATE/config.yml` | Disable blank issues |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist (tests, verification, TDD) |

## Cross-Reference Strategy

Every doc includes a "Related Docs" footer with 2-4 links and one-line descriptions. docs/index.md serves as the central navigation hub with reading paths by role (new dev, task dev, reviewer, debugger).

## Overlap Prevention Rules

- Tech stack listed in README only; others link to it
- Dev commands in README only; CLAUDE.md is canonical reference
- Workflow described in CONTRIBUTING; CLAUDE.md specifies it
- Design rationale lives in docs/plans/ only; ARCHITECTURE links to relevant plans
- Feature status in ROADMAP only; FEATURES describes structure
