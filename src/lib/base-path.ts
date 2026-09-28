// Multi-Zones: ARSC serves its apps under one domain (see arsc-home docs/MULTI_ZONES_RUNBOOK.md and
// docs/MULTI_ZONE_MIGRATION.md). Empty (default) = standalone at the domain root, i.e. today's
// production behavior. Set NEXT_PUBLIC_BASE_PATH=/app/leaderboard on the zone deployment to activate.
// Single source for next.config basePath, fetch/asset URLs, and the "ARSC" back link.
export function normalizeBasePath(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '')
  if (value && !/^\/[a-z0-9/_-]+$/i.test(value)) {
    throw new Error(`NEXT_PUBLIC_BASE_PATH must look like "/app/leaderboard", got "${raw}"`)
  }
  return value
}

export const BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)

/** Prefix a root-relative path ("/api/…", "/logo.png") with the basePath. Absolute URLs pass through. */
export const withBase = (path: string, base: string = BASE_PATH) =>
  path.startsWith('/') && !path.startsWith('//') ? `${base}${path}` : path
