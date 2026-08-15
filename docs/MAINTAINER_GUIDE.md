---
status: active
last_verified: 2026-08-15
audience: maintainers-operators-and-ai
sensitivity: internal
---

# ARSC Leaderboard Maintainer Guide

This guide corrects the operational interpretation of older README/marketing statements. Current source, contracts, SQL, and dated verification artifacts are authoritative.

## Last-known status

| Stage | Capability | Evidence boundary |
| --- | --- | --- |
| 3 | Restricted participation workflow | Remotely committed and verified in preserved closeout. |
| 4 | Shared identity and minimized public reads | Remotely verified. |
| 5 | Configurable scoring and snapshots | Remotely verified. |
| 6 | Competition proposals and tracks | Remotely verified. |
| 7 | Case messages, notifications, rejection reasons, guarded deletion, mobile routes | Local implementation/validation passed; preserved closeout says remote SQL and frontend were not run. |

Remote state can change after this date. Recheck it. In particular, never deploy a Stage 7 frontend against a database that lacks its Stage 7 objects.

## Product behavior

Members can link shared identity, inspect rankings and participation state, submit achievements/evidence, and propose missing competitions/tracks. Administrators manage competitions, configurable scoring, proposals, and participation review. Stage 7 locally adds member/admin conversations, internal notes, notifications, required visible rejection reasons, and narrowly guarded permanent deletion.

The current notification model refreshes when opened, on window focus, and periodically. Do not call it realtime unless a database subscription is actually present and verified. Do not restore the old “top 10” product description without checking current ranking behavior.

## Critical boundaries

- Rapor owns private report data. Leaderboard consumes only versioned contract/RPC surfaces.
- Halo and Leaderboard share authentication/identity infrastructure but not unrestricted product data.
- Historical scores are snapshots; edits to rules must not rewrite awarded history unexpectedly.
- Permanent competition deletion is exceptional: archived state, exact-title confirmation, and no historical references are required.
- Evidence URLs, identity links, scores, proposals, messages, and internal notes are restricted according to role.

## Verification commands

```powershell
npm ci
npm run lint
npm run test:ci
npm run build
```

Additional suites:

- `npm run test:db`: isolated local Supabase database contract tests.
- `npm run test:e2e`: Playwright browser tests with a controlled local/CI environment.

Do not point database or browser automation at production accounts. Build/unit success alone does not verify remote policies or stage deployment.

## Stage 7 remote release

Use `deployment/remote/stage7_operations_runbook.md`. Preserve these gates as separate operator actions:

1. Confirm project and frontend commit.
2. Back up/establish rollback.
3. Run enhanced read-only preflight.
4. Review protected fingerprints and zero unexpected drift.
5. Obtain explicit approval for Stage 7 SQL.
6. Apply only the Stage 7 script.
7. Run `verify_stage7_operations.sql` and database tests.
8. Release the compatible frontend.
9. Smoke member and admin roles with synthetic records.
10. Save a dated remote closeout.

Never use an undifferentiated `db push` for the shared production project.

## Definition of ready

A change is ready when lint, unit/sync/contract tests, build, relevant isolated DB/E2E tests, privacy review, and cross-consumer contract checks pass. A production stage additionally requires remote preflight, explicit approval, verification, role smoke evidence, and rollback readiness.

## Local verification note (2026-08-15)

Lint passed with 8 Fast Refresh warnings and no errors. All 35 unit/static tests, 5 Rapor synchronization tests, the Rapor-Leaderboard contract, and the production build passed. Local database and Playwright suites were not run; this result does not change Stage 7's recorded remote status.
