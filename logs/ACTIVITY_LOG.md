# Activity Log

### [2026-09-28] [Claude Code / Planning + Documentation]
- **Goal**: Document the approved plan to serve Leaderboard at `/app/leaderboard` under one ARSC domain (Next.js Multi-Zones, main zone = new repo `arsc-home`), for handoff.
- **Actions**: Read-only basePath readiness audit at `298c8b8`, covering `next/image` string sources, favicon metadata, `emailRedirectTo`, and the proxy location. Wrote the migration spec with an explicit Stage 7R release gate. Added a planned-change section to the maintainer guide. Recorded DEC-003. Replaced the literal `\n` artifacts at the end of `AGENTS.md` and `logs/README.md` with real newlines.
- **Finding (not fixed)**: `src/proxy.ts` sits beside `src/` while `app/` is at the root, so Next probably never runs it. Documented in `docs/MULTI_ZONE_MIGRATION.md` for a separate change.
- **Files Modified**: `docs/MULTI_ZONE_MIGRATION.md` (new), `docs/MAINTAINER_GUIDE.md`, `AGENTS.md` (EOF artifact only), `logs/*`.
- **Verification**: Documentation only, no code changed. Every referenced path and line was re-grepped at this commit.

### [2026-09-16 18:05] [Claude / Staff DevOps]
- **Goal**: Restore the `Quality gate` workflow without weakening the audit, lint, test, or build steps.
- **Diagnosis**: Run `35085130024` (`quality` job) failed at `npm audit --audit-level=high` (Security & Dependency Audit): `next@16.2.12` (critical GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4), `sharp@0.35.3` (high GHSA-rgj7-g3m4-5g8c), `js-yaml@4.3.1` (high GHSA-2883-xcg3-v3hh, via `eslint`).
- **Root causes & actions**:
  - Raised the `next` floor to `^16.3.3` (lock resolves 16.3.5) and the existing `sharp` override to `^0.35.4`; refreshed `js-yaml` to 4.3.2 inside its semver range. No `--force`, no major bumps.
  - Next.js 16.3 type-checks through the TypeScript CLI by default (vercel/next.js#96497), which surfaced latent errors that a standalone `tsc --noEmit` also reports: TS5097 `.ts` extensions in four test imports (aligned with the extensionless imports every sibling test already uses) and TS2339 on `syncRaporMembers` results, whose inferred return type widened `success` to `boolean`. Declared an explicit `SyncRaporResult` discriminated union at the source; no test assertion changed.
- **Files Modified**: `package.json`, `package-lock.json`, `src/lib/actions/syncRapor.ts`, `tests/actions/rapor_identity.test.ts`, `tests/actions/rapor_link.test.ts`, `tests/actions/shared_profile.test.ts`, `tests/actions/syncRapor.test.ts`, `logs/*`.
- **Verification**: `npm ci`; `npm audit --audit-level=high` → 0 vulnerabilities; `npm run lint` → 0 errors (8 pre-existing warnings); `npm run test:ci` → 40/40 pass; `npx tsc --noEmit` → exit 0; `npm run build` → exit 0; `npm run test:e2e` → 5/5 pass.

### [2026-09-16 17:25] [Antigravity]
- **Goal**: Initialize modular logging system and mandatory agent protocols.
- **Actions**: Created `logs/` directory and established `AGENTS.md`.
- **Files Modified**: `AGENTS.md`, `logs/README.md`, `logs/ACTIVITY_LOG.md`, `logs/DECISION_LOG.md`, `logs/CHANGELOG.md`.
- **Verification**: Git status verified.
