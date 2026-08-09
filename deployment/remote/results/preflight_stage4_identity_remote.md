# Stage 4 remote identity preflight

- Project: `arsc`
- Project ref: `jyznguhencjwtzupxjjk`
- Execution date: `2026-08-09` (Asia/Jakarta)
- SQL artifact: `deployment/remote/preflight_stage4_identity_single_result.sql`
- SQL SHA-256: `05C7A92853DEC9685F3E1A91C0CC3B102CD96DEA25D2BC0416D38144F21CD5FA`
- Source capture SHA-256: `1F499FEF65BEF60D19AE0A7339F427F3EBB2956DD6FB762901140A2C9BA92AEE`
- Repository CSV SHA-256: `1ED622F1310F57F3A361E8B1C535C0ABA7005CA44DF66DA58F49BB7C7087BF05`
- Captured result rows: `85`

## Gate result

- Required objects: `READY` (missing: `0`)
- Stage 4 table collision: `NONE`
- Stage 4 function collisions: `NONE` (count: `0`)
- Stage 4 trigger collisions: `NONE` (count: `0`)

## Identity inventory

- Auth users: `47`
- Halo profiles: `35`
- Leaderboard profiles: `0`
- Auth users with Halo profile: `35`
- Auth users with Leaderboard profile: `0`
- Auth users with both profiles: `0`
- Halo/Auth email mismatches: `0`

This baseline records the protected-object fingerprints emitted by the read-only
preflight. The zero Leaderboard profile count is an observed pre-deployment data
condition, not a missing schema prerequisite. Stage 4 creates Leaderboard profile
projections only when a Rapor identity is successfully linked.
