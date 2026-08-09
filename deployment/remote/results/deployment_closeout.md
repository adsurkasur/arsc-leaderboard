# ARSC Leaderboard Database Deployment - Closeout Review

## Deployment Status
Bootstrap: COMMITTED
Stage 3: COMMITTED
Verification: PASSED
Remote user/participation data inserted: NO
Remote system seed data inserted: YES (6 scoring templates, 56 scoring rules)
Remote destructive operation: NO

## Deployment Artifacts
- **Enhanced Preflight Baseline**: `deployment/remote/results/preflight_stage3_remote_enhanced.csv` (Hash: `60C5D84D4A3B4CE9E83ED8BD6E368C51C328C0237F31D73DF431BCDE699DB7AF`)
- **Bootstrap Artifact**: `deployment/remote/leaderboard_bootstrap_schema.sql` (Hash: `3EAFB237D352F92A9AD79A3002C32887262A83959875A9E5B02DA731E9E18045`)
- **Stage 3 Artifact**: `deployment/remote/stage3_restricted_write.sql` (Hash: `25E2F78D97D58E083C063020AF0C8F567272A96E076CC0A290E38A5B18BA595A`)
- **Verification Artifact**: `deployment/remote/verify_stage3.sql` (Hash: `2B43A44FF3732CD93650824CDD12B08A16C72710528B79FB59D3746521F444F8`)
- **Stage 5 Preflight Artifact**: `deployment/remote/preflight_stage5_scoring.sql` (Hash: `4DA44D4AFACF72A077717E934FE495AA5C427A98CC1963BE8D2FD2FCBCEE8A68`)
- **Stage 5 Deployment Artifact**: `deployment/remote/stage5_configurable_scoring.sql` (Hash: `7EC3B4502EDD98372E1FA2B6472D0A972907D1EB0AF5F9883D95622D5958BAC4`)
- **Stage 5 Verification Artifact**: `deployment/remote/verify_stage5_scoring.sql` (Hash: `3F55420808CC8AE217BFF96FFCE74F3BEB649015A6B96D3973A63A93D971E05D`)
- **Stage 5 Remote Verification Result**: `deployment/remote/results/verify_stage5_scoring_remote.csv`

## Local Validation Metrics
- **Local Migration Immutability**: Verified. Historical migrations (`20260731000000_stage3_participation_workflow.sql`) are byte-for-byte unmodified.
- **Local Database Test Result**: PASSED cleanly. State capture executed, mock constraints verified, and all isolation tests rolled back safely via `tests/database/run_local_tests.ps1`.
- **Build and Lint Result**: Build SUCCESS (4.7s). Lint SUCCESS (0 breaking schema regressions; 2 existing `any` typing issues).
- **Protected Constraints (Rapor/Halo)**: CONFIRMED. Rapor `rapor_members` structural hash and Stage 2C RPC definitions remained perfectly isolated from Leaderboard alterations.

## Remote Integrity
- **Leaderboard Function Collisions**: NONE.
- **Stage 2C Hash Target**: `2b493e59bc65c16686e6e6afb027ec98`

## Stage 5 Configurable Scoring Closeout
- **Project**: `arsc` (`jyznguhencjwtzupxjjk`)
- **Execution date**: 2026-08-10 (Asia/Jakarta)
- **Deployment**: COMMITTED
- **Remote verification**: PASSED (`failure_count = 0`)
- **Scoring templates**: 6 system presets
- **Scoring rules**: 56 system rules
- **Competitions without rules**: 0
- **Direct authenticated writes**: BLOCKED for competitions and scoring rules; writes use the approved RPC contract
- **Protected boundaries**: Rapor, Halo PSDM, shared identity tables/functions, and protected auth triggers retained their captured fingerprints
- **Verification transaction**: ROLLED BACK after read-only inspection
