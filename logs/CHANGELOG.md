# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]
### Added
- Optional Multi-Zones support: set `NEXT_PUBLIC_BASE_PATH=/app/leaderboard` to serve under the shared ARSC domain (off by default). `← ARSC` back link when active.
- Planned-change spec `docs/MULTI_ZONE_MIGRATION.md` for serving Leaderboard at `/app/leaderboard` on the shared ARSC domain (documentation only).
- Modular logging protocol (`logs/` directory with activity, decision, and changelog files).
- Mandatory `AGENTS.md` guidelines for AI agents and contributors.

### Fixed
- `next build` type-check failures surfaced by Next.js 16.3 in Rapor test imports and the `syncRaporMembers` result type.

### Security
- Upgraded `next` to >=16.3.3 (GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4), `sharp` to >=0.35.4 (GHSA-rgj7-g3m4-5g8c), and `js-yaml` to 4.3.2 (GHSA-2883-xcg3-v3hh).
