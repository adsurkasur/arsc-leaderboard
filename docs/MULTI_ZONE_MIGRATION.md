---
status: approved-not-started (blocked by Stage 7R)
last_verified: 2026-09-28
audience: maintainers-and-ai
sensitivity: internal
---

# Planned Change: Serve Leaderboard at `/app/leaderboard` (Next.js Multi-Zones)

## Why

The owner approved serving every ARSC app from **one domain**. A new repo, `adsurkasur/arsc-home`, is the ARSC company profile and the main zone. It rewrites `/app/leaderboard/*` to this app's deployment. Leaderboard keeps its own repo, Vercel project, and Supabase usage. It only needs `basePath: "/app/leaderboard"` plus fixes for paths that bypass Next's basePath handling.

The canonical cross-repo runbook lives in arsc-home: `docs/MULTI_ZONES_RUNBOOK.md` and `docs/ECOSYSTEM.md`. The decisions are arsc-home DEC-009…DEC-011 and this repo's DEC-003.

## ⛔ Release gate: Stage 7R first

`main` contains the Stage 7 frontend. Per `MAINTAINER_GUIDE.md`, it must never be deployed against a database that lacks the Stage 7 objects. Choose one of these:
1. Complete Stage 7R (`deployment/remote/stage7_operations_runbook.md`: preflight → approval → apply → verify → closeout), **then** merge the basePath PR. This is the preferred option.
2. Or branch the basePath change from the commit that is currently live in production and release it separately.

Do not merge the basePath PR into `main` and let Vercel auto-deploy while Stage 7 SQL is absent remotely.

## Owner decisions that affect Leaderboard

- **SSO accepted.** On one origin, Leaderboard and Halo share the default `sb-<ref>-auth-token` cookie (path `/`). One login works for both, and logout from one logs out the other. This is consistent with `contracts/arsc-shared-identity.v1.json`.
- **Back link.** Add a small `<a href="/">ARSC</a>` in `src/components/layout/Header.tsx`. It is a plain anchor because this is a cross-zone hard navigation.
- **Old URL.** After the rewrite is proven, `arsc-leaderboard.vercel.app/*` 308-redirects to `<domain>/app/leaderboard/*` through a `has: host` rule in `vercel.json`. The rewrite targets a separate zone alias to avoid loops.

## Required code changes (audit 2026-09-28, commit `298c8b8`)

Line numbers may drift, so re-grep before editing.

| # | Where | Change |
|---|---|---|
| 1 | new `src/lib/base-path.ts` | `export const BASE_PATH = "/app/leaderboard"` and `withBase(path)`. This is the single source. |
| 2 | `next.config.ts` | `basePath: BASE_PATH` |
| 3 | `next/image src="/arsc-logo.png"` ×4: `app/auth/page.tsx:124,163`, `src/components/layout/Header.tsx:85`, `src/components/modals/AboutModal.tsx:27` | `src={withBase("/arsc-logo.png")}`. `next/image` does not prefix basePath for string sources. |
| 4 | `app/layout.tsx:18` | `icons.icon: withBase("/favico.ico")` and add `metadataBase`. |
| 5 | `src/hooks/useAuth.tsx:~246-251` | `redirectUrl`, built from `window.location.origin`, becomes `${origin}${BASE_PATH}/`. |
| 6 | Header | ARSC back link. |

`<Link>` and `router.push` from `next/navigation` already get basePath. No raw `fetch("/api")` calls were found.

## Found during audit (out of scope, tracked separately)

`src/proxy.ts` exists, but `app/` is at the repository root. Next resolves `proxy.ts` next to the `app` directory (root, or `src/` only when `app` is under `src/`), so this session-refresh proxy is probably never executed today. Verify with a build and request log. Fix it in a separate, reviewed change. If it starts running, its matcher must keep working under basePath.

## Operator actions (owner, not an agent)

- Supabase Auth → URL configuration: add `https://<domain>/app/leaderboard/`. Keep the old URL until the 308 is live.
- Vercel: add a zone alias (e.g. `arsc-leaderboard-zone.vercel.app`) and set arsc-home `ZONE_LEADERBOARD_URL` to it.

## Verification

```powershell
npm ci
npm run lint
npm run test:ci
npm run build
```

Then, on a preview:
- Open `/app/leaderboard` directly and through the arsc-home preview.
- Confirm logos and favicon load (no 404).
- The signup email link lands on `/app/leaderboard/`.
- SSO with Halo works (log in on one, open the other).
- Admin and member routes work.

Use synthetic accounts only.

## Rollback

Unset `ZONE_LEADERBOARD_URL` in arsc-home and remove the 308. For a full rollback, revert the basePath PR.
