# Error Classification Guide

## Type Axis

| Type | Signals | Example |
|------|---------|---------|
| Bug | App code crash, logic error, null reference, component render failure | `TypeError: Cannot read properties of null` in scoring component |
| Unhandled expected behavior | User-initiated action treated as error | `auth/popup-closed-by-user` — user closed Google sign-in |
| Infra / third-party | Firebase/GCP outage, CDN issue, browser extension interference | `auth/internal-error` during Firebase outage |
| Config / deployment | Wrong env var, stale cache, CSP violation | `Refused to connect` CSP error after deploy |
| Logging gap | Error captured but missing context | `ErrorBoundary caught error` with no original error |

## Severity Axis

| Severity | Criteria | Action |
|----------|----------|--------|
| Critical | Crash on scoring page, data loss risk, >10 users | Individual GitHub issue immediately |
| High | Unhandled, >3 occurrences, core flow (match/tournament) | Individual GitHub issue |
| Medium | Handled error, non-core page, <3 occurrences | Individual GitHub issue |
| Low | Single occurrence, edge case, non-blocking | Accumulate into weekly digest |

## Label Mapping

| Type | GitHub Labels |
|------|--------------|
| Bug | `bug, auto-detected` |
| Unhandled expected behavior | `enhancement, auto-detected` |
| Infra / third-party | `infra, auto-detected` |
| Config / deployment | `deployment, auto-detected` |
| Logging gap | `observability, auto-detected` |

## Classification Decision Tree

1. Is this error caused by a user's intentional action (closing popup, cancelling dialog)?
   → **Unhandled expected behavior**

2. Is the error from a third-party service (Firebase, GCP, CDN) and not from our code?
   → **Infra / third-party**

3. Is this related to environment config, deploy artifacts, or CSP?
   → **Config / deployment**

4. Does the error message lack enough context to diagnose (generic message, missing stack)?
   → **Logging gap**

5. Otherwise → **Bug**

## "Unhandled Expected Behavior" — Required Output

When classifying as "Unhandled expected behavior", the GitHub issue MUST include:

1. **Handler code snippet** — try/catch that gracefully handles the specific error
2. **Sentry filter snippet** — `beforeSend` rule to add to `sentry.ts` AFTER the handler is deployed

State clearly: "Step 1: Apply the handler in source code. Step 2: After deployed and verified, add the Sentry filter."
