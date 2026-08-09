# Stage 4 remote identity verification

- Project: `arsc`
- Project ref: `jyznguhencjwtzupxjjk`
- Execution date: `2026-08-09` (Asia/Jakarta)
- Deployment artifact: `deployment/remote/stage4_identity_and_public_reads.sql`
- Deployment SHA-256: `032A20221F8EF0817CDF7F1B9811B2300A612C56CF260CAEB5DF2452E91FE2E9`
- SQL verification artifact: `deployment/remote/verify_stage4_identity.sql`
- Verification SQL SHA-256: `3C7137B00C5DF0382206D1BCC38541252496F4117D7E54E0807445BCA19B9FF8`
- Source capture SHA-256: `988D634AC536FF1DC0FDDE1CF5B111B573A594B652A2BECACCDEEF1BBF3750F4`
- Repository CSV SHA-256: `3DF1BC33350CC4100F9BF84A5ACCE609A6682ED0D94E0E2A118D40575590A43A`
- Captured result rows: `91`

## Verification result

- Stage 4 table exists: `PASS`
- Stage 4 table RLS: `PASS`
- Stage 4 functions: `10/10 PASS`
- Stage 4 triggers: `4/4 PASS`
- Stage 4 privilege checks: `7/7 PASS`
- Verification gate: `PASS` (failures: `0`)
- Verified identities immediately after deployment: `0`
- Halo/Auth email mismatches: `0`

## Protected-object comparison

- Preflight protected fingerprints: `62`
- Unchanged fingerprints: `60`
- Expected aggregate trigger changes: `2`
- Unexpected drift: `0`

The only changed protected-table fingerprints are the aggregate trigger hashes for
`public.users` and `public.profiles`. These are expected because Stage 4 adds
`arsc_verified_identity_guard` and `arsc_shared_avatar_sync` to `public.users`,
and `arsc_verified_profile_guard` to `public.profiles`. Columns, constraints,
grants, policies, RLS state, protected functions, Auth triggers, and every Rapor
table fingerprint remain identical to the remote preflight baseline.
