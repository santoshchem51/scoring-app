---
name: triage-issues
description: Fetch open GitHub issues, investigate root causes, fix bugs with tests, and present feature branches for merge review. Use when the user says "triage issues", "check issues", "look at github issues", "fix github issues", "new issues", "what issues are open", or wants to review and fix reported bugs from GitHub. Also triggered by /triage-issues.
---

# Triage Issues

You are an issue triage agent. Fetch open GitHub issues, investigate each one against the codebase, fix what you can confidently diagnose, and present feature branches for the user to merge.

## The Rules

1. **One branch per issue** — each fix gets its own `fix/issue-{N}-{slug}` branch for granular merge control
2. **Never close or comment on GitHub issues without explicit user approval** — report your recommendation instead
3. **Fix only when confident** — if root cause is ambiguous, report your diagnosis and ask before attempting a fix
4. **TDD verification** — for each fix, write a test that catches the bug, verify it fails without the fix, then confirm it passes with the fix
5. **Full test suite before declaring ready** — run related tests during development, full suite before presenting the branch

## Prerequisites

- `gh` CLI authenticated (located at `/c/Program Files/GitHub CLI/gh.exe`)
- Current project directory must be a git repo with a GitHub remote

## Workflow

### Phase 1: Fetch and Triage

```
1. Detect the GitHub repo from git remote
2. Fetch open issues: gh issue list --state open
3. Read each issue's full details: gh issue view {N}
4. Check for existing fix branches: git branch --list 'fix/issue-*'
5. Skip issues that already have a fix branch
```

Categorize each issue into one of three buckets:

| Category | Criteria | Action |
|----------|----------|--------|
| **Actionable** | Clear root cause identifiable from code investigation | Auto-fix on feature branch |
| **Ambiguous** | Multiple possible causes or uncertain diagnosis | Report diagnosis, ask user |
| **No action needed** | Already fixed, expected behavior, or duplicate | Report recommendation, ask user before closing/commenting |

Present the triage summary to the user before proceeding with fixes:

```
## Triage Summary
| # | Title | Severity | Category | Plan |
|---|-------|----------|----------|------|
```

Wait for user acknowledgment before proceeding to fixes.

### Phase 2: Investigate and Fix (per actionable issue)

For each actionable issue, in order of severity:

**Step 1 — Branch**
```bash
git checkout main && git pull
git checkout -b fix/issue-{N}-{slug}
```
Use a short descriptive slug derived from the issue title (e.g., `fix/issue-4-firestore-crash`).

**Step 2 — Investigate**

Follow the systematic-debugging process:
- Read error messages and stack traces from the issue
- Trace the data flow through the affected code
- Identify the root cause (not just the symptom)
- Find working examples of similar patterns in the codebase

If investigation reveals the root cause is ambiguous or risky:
- Stop, switch back to main
- Report findings to user and ask for guidance
- Do NOT attempt a speculative fix

**Step 3 — Test first (TDD)**

Write a failing test that reproduces the bug:
```
1. Write test that demonstrates the broken behavior
2. Run it — confirm it fails for the right reason
3. Implement the minimal fix
4. Run it — confirm it passes
5. Revert the fix temporarily, confirm test fails again (proves test validity)
6. Restore the fix
```

**Step 4 — Run tests**
```
1. Run tests related to changed files (fast feedback)
2. Fix any failures before proceeding
3. Run the full test suite: npx vitest run
4. All tests must pass before the branch is ready
```

**Step 5 — Commit**

Commit to the feature branch with a clear message referencing the issue:
```
fix: {description of fix}

Resolves #{issue-number}
```

Switch back to main before starting the next issue:
```bash
git checkout main
```

### Phase 3: Present Results

After all issues are processed, present a summary:

```markdown
## Results

### Fixed (ready for merge)
| # | Title | Branch | Changes | Tests |
|---|-------|--------|---------|-------|
| 4 | Firestore crash | fix/issue-4-firestore-crash | DiscoverPage.tsx +try/catch | 6 pass |

### No action needed (awaiting your approval to close/comment)
| # | Title | Recommendation | Reason |
|---|-------|---------------|--------|

### Needs guidance
| # | Title | Diagnosis | Question |
|---|-------|-----------|----------|
```

For fixed issues, the user decides: **merge**, **reject**, or **defer**.

For no-action issues, the user decides whether to close or comment — the skill never does this autonomously.

## Severity Classification

When triaging, assign severity based on:

| Severity | Criteria |
|----------|----------|
| **Critical** | Page crash, data loss, security vulnerability |
| **High** | Feature broken for some users, error visible to users |
| **Medium** | Degraded experience, logging/observability gaps |
| **Low** | Expected behavior logged as error, cosmetic issues |

Process issues in severity order (critical first).

## What NOT to Do

- Do not close or comment on GitHub issues without asking
- Do not force-push or modify other branches
- Do not fix issues where the root cause is unclear — ask first
- Do not skip the TDD verification step (revert-confirm-restore)
- Do not bundle multiple issue fixes into one branch
- Do not modify code unrelated to the issue being fixed
