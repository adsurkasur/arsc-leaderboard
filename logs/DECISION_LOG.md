# Decision Log (Architecture Decision Records)

### [DEC-001] Adoption of Modular Logging Protocol
- **Date**: 2026-09-16
- **Status**: Accepted
- **Context**: Standardizing change tracking, observability, and auditability across all managed projects for AI agents and human contributors.
- **Decision**: Mandate `logs/ACTIVITY_LOG.md`, `logs/DECISION_LOG.md`, and `logs/CHANGELOG.md` updates across all repositories.
- **Consequences**: Consistent history, reduced context loss during multi-agent handoffs.

### [DEC-002] Patched security floor for Next.js and sharp
- **Date**: 2026-09-16
- **Status**: Accepted
- **Context**: CI run `35085130024` blocked on critical Next.js RCE advisories (fixed in 16.3.3) and a high sharp/libheif advisory (fixed in 0.35.4).
- **Decision**: Declare `next: ^16.3.3` and keep the `sharp` override at `^0.35.4` so the manifest itself cannot resolve a vulnerable version. Type `syncRaporMembers` with an explicit discriminated result union because Next.js 16.3 now type-checks the full tsconfig program during `next build`.
- **Alternatives rejected**: `npm audit fix --force`, raising the audit level, or excluding `tests/` from `tsconfig.json` to hide the newly surfaced type errors.
- **Consequences**: Audit gate stays at `high`; test files are type-checked as part of the production build.
