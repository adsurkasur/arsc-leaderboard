# ARSC Leaderboard — Complete Repository Context and AI Handoff

- **Prepared:** 2026-08-11 (Asia/Jakarta)
- **Repository:** `F:\My Files\ARSC\arsc-leaderboard`
- **Branch/HEAD at audit:** `main` / `cfa8ecf259d33e3df8ed98a5d403eda7cfd9cae0`
- **Remote database target:** Supabase project `arsc` (`jyznguhencjwtzupxjjk`)
- **Remote mutation during documentation:** none

## 1. Read this first

This document is the current repository handoff. It corrects older narrative files where they conflict with current source. In particular, root `README.md` and `ai-context.md` contain historical/marketing claims such as a top-10-only board and “real-time updates”; those claims are not reliable descriptions of the current system.

Status words used here:

- **Remote verified:** preserved SQL Editor result/closeout proves it.
- **Local verified:** source/tests/build prove it locally, but remote deployment is not implied.
- **Proposed:** product intent or next-stage design, not implementation.

## 2. Product mission

ARSC Leaderboard is the competition evidence and recognition system for ARSC members. It should:

- present approved achievements publicly and clearly;
- let members submit evidence without requiring admins to know every competition in advance;
- support multiple categories/tracks within one event;
- let admins define and edit scoring per competition;
- preserve the awarded historical snapshot when rules later change;
- integrate member identity with Rapor ARSC and shared login/profile with Halo PSDM;
- keep review decisions understandable, auditable, and non-destructive.

It is not the owner of Halo reports/chat, Rapor evaluations, or account passwords.

## 3. Current status in one sentence

Database Stages 3–6 are remotely committed and verified; Stage 7 operations/messaging/mobile work is implemented and fully validated locally but is explicitly **not yet deployed to remote Supabase or Vercel** in the latest closeout.

## 4. Technology and commands

Current `package.json`:

- Next.js 16.1.1 App Router
- React 19.2.3
- TypeScript
- Tailwind CSS and Radix/shadcn components
- Supabase SSR/JS clients
- TanStack Query
- Framer Motion
- Zod and React Hook Form
- Node/TSX native tests and Playwright

Main commands:

```text
npm run dev
npm run lint
npm run build
npm run test:unit
npm run test:sync
npm run test:contract
npm run test:db
npm run test:e2e
npm run test:ci
```

## 5. Repository map

```text
app/
  page.tsx                 welcome/home
  leaderboard/page.tsx     dedicated leaderboard route
  auth/page.tsx            login/signup
  requests/page.tsx        member submissions and conversations
  admin/page.tsx           admin workspace
  layout.tsx               root layout
  providers.tsx            query/auth/motion providers

src/
  components/admin/        users, competitions, proposals, participation review
  components/leaderboard/  public ranking table and member details
  components/modals/       participation, profile, help, etc.
  components/requests/     request history and Stage 7 case thread
  components/notifications Stage 7 notification center
  components/layout/       header/footer/navigation
  hooks/useAuth.tsx        Supabase session/profile/role state
  lib/actions/             server actions grouped by deployment stage
  lib/supabase/            browser/server/integration clients
  integrations/supabase/   generated database types

contracts/                 cross-repository JSON contracts
deployment/remote/         reviewed manual SQL artifacts and runbooks
deployment/remote/results/ preserved remote/local evidence
supabase/migrations/       historical development migrations; not the remote deployment mechanism
tests/actions/             action and static tests
tests/database/            isolated Supabase integration harness
tests/e2e/                 Playwright public/member flows
```

## 6. Route and UI responsibility map

### `/`

Current mobile-oriented welcome/overview route. It introduces the flow and links to the dedicated leaderboard and participation entry points.

### `/leaderboard`

Public ranking. `LeaderboardTable.tsx`:

- calls `get_public_leaderboard_v2()`, with older RPC fallback;
- supports name search and category filtering;
- fetches category score summaries;
- opens public member participation detail;
- prefers `get_public_member_participations_v3`, then v2, then the older function for compatibility.

### `/auth`

Shared Supabase Auth sign-in/sign-up. The same email/password should work in Halo PSDM because both consume the same Supabase Auth project. Browser sessions remain domain-local.

### `/requests`

Authenticated member history for competition proposals and participation submissions. Stage 7 local UI embeds `CaseThread` so a member can read/reply to relevant case communication.

### `/admin`

Admin workspace hosting:

- `UsersManagement`
- `CompetitionsManagement`
- `CompetitionProposalsManagement`
- `ParticipationManagement`

Admin authorization is Leaderboard-specific (`user_roles`), not the Halo PH role.

## 7. Critical UI components and behavior

### `ParticipationModal.tsx`

- blocks submission until the account has a verified exact Rapor identity link;
- loads active competitions, tracks, and scoring rules;
- supports registered competition selection;
- supports “Usulkan baru” for an unknown competition;
- collects HTTPS information/evidence links;
- provides loading error/retry behavior instead of an endless skeleton;
- includes explanatory helper copy for proposal fields.

### `CompetitionsManagement.tsx`

- creates/edits/archives competitions;
- applies a system scoring preset then allows complete rule editing;
- manages competition tracks;
- Stage 7 local UI adds guarded permanent deletion.

Deletion requirements in SQL:

- caller must have Leaderboard admin role;
- competition must already be archived (`is_active = false`);
- operator must type the exact competition title;
- no participation log, verification request, or resolved proposal may reference it;
- history foreign keys are changed from `ON DELETE CASCADE` to `ON DELETE RESTRICT`.

### `CompetitionProposalsManagement.tsx`

- reviews member-proposed competition metadata;
- can request information, reject, or resolve to a new/existing competition/track/rule;
- Stage 7 local UI exposes public replies and admin-only internal notes.

### `ParticipationManagement.tsx`

- reviews pending participation;
- chooses/overrides scoring result within the controlled contract;
- preserves zero points (`??`, not falsy `||` behavior);
- Stage 7 requires a member-visible reason when rejecting;
- Stage 7 local UI shows the case thread.

### `CaseThread.tsx`

Stage 7 local component for two case types:

- `proposal`
- `participation`

Visibility:

- `member_admins`: visible to the submitting member and admins;
- `admins_only`: internal admin note, never a member message.

Message types:

- member message;
- admin response;
- admin internal note;
- system event.

### `NotificationCenter.tsx`

Stage 7 local component:

- reads the current user's rows through RLS;
- displays unread count;
- marks one or all as read through RPCs;
- refreshes when opened, on window focus, and every 60 seconds;
- hides itself when Stage 7 tables are unavailable.

This is polling/focus refresh, not evidence of a Supabase Realtime subscription.

## 8. Server actions and RPC contract

### Identity and Rapor

| Server action | Primary purpose | Database/API dependency |
|---|---|---|
| `linkProfileWithRaporCode` | resolve an access code and link current Auth account | server-side `rapor_access_codes`, reference data, `link_arsc_account_from_reference` |
| `refreshProfileFromRapor` | refresh verified canonical projection | shared identity/reference RPCs |
| `updateProfileAvatar` | update allowed avatar projection | `set_shared_profile_avatar` |
| `syncRaporMembers` | controlled reference snapshot synchronization | `get_leaderboard_reference_members`, `upsert_leaderboard_reference_member` |

### Competition and participation

| Server action | Preferred RPC | Compatibility behavior |
|---|---|---|
| `saveCompetition` | `leaderboard_save_competition_v2` | falls back to Stage 5 `leaderboard_save_competition` when the exact missing-function condition is detected |
| `submitParticipation` | `submit_participation_v3` | falls back to Stage 5 v2 where applicable |
| `reviewParticipation` | Stage 7 `review_participation_v3` | falls back to v2 while Stage 7 is not deployed |
| `submitCompetitionProposal` | `submit_competition_proposal` | Stage 6 required |
| `reviewCompetitionProposal` | `review_competition_proposal` | Stage 6 required |

### Stage 7 operations

| Server action | RPC |
|---|---|
| `addCaseMessage` | `leaderboard_add_case_message` |
| `markNotificationRead` | `leaderboard_mark_notification_read` |
| `markAllNotificationsRead` | `leaderboard_mark_all_notifications_read` |
| `deleteCompetition` | `leaderboard_delete_competition` |

Compatibility fallbacks reduce loading failures during staged rollout, but the runbook still requires database verification before deploying the Stage 7 frontend.

## 9. Data model

### Canonical/member foundation

#### `members`

- canonical member ID and name;
- independent of a particular Rapor release.

#### `member_release_links`

- maps canonical member to Rapor release/member code;
- stores unit, position, evaluation status snapshot;
- unique release/member and member/release pairs.

#### `arsc_identities` (Stage 4)

- primary key `auth_user_id`;
- unique `member_id`;
- verified release/member evidence;
- one-to-one identity constraints;
- verification source and timestamps.

### Leaderboard account/application tables

#### `user_roles`

- Auth user to Leaderboard `app_role` relation;
- unique user/role pair.

#### `profiles`

- Auth projection and optional canonical member link;
- full name, avatar, unit, link status;
- aggregate participation count and last activity.

Verified identity fields are protected by Stage 4 guards. Profile UI must not become an alternate identity authority.

### Competition and scoring

#### `competitions`

- title, date, description, category;
- Stage 5 adds active state and scoring template reference.

#### `leaderboard_scoring_templates`

- reusable system template metadata.

#### `leaderboard_scoring_template_rules`

- preset label, points, order;
- SQL permits 0–100,000 points.

#### `leaderboard_competition_scoring_rules`

- editable copied rules owned by a competition;
- active flag and stable rule IDs.

#### `leaderboard_competition_tracks` (Stage 6)

- category/division/track under one competition;
- active state;
- permits multiple winners at the same achievement label in separate tracks.

### Participation

#### `participation_logs`

- member profile, competition, track, evidence, participation date;
- review status and admin metadata;
- requested scoring selection/achievement/points;
- awarded scoring selection/achievement/points snapshot.

Historical awarded values must not be recomputed merely because a template or competition rule changes.

#### `participation_submission_events`

- append-oriented event/audit snapshots for submissions and reviews.

Direct authenticated insert/update/delete on protected participation/audit tables is blocked; mutations use RPCs.

### Member proposals

#### `leaderboard_competition_proposals` (Stage 6)

Captures:

- proposed title and organizer;
- information URL;
- date and level;
- proposed track and achievement;
- evidence URL and member notes;
- status (`pending`, `needs_info`, `accepted`, `rejected`);
- review/resolution links to competition, track, scoring rule, and participation log.

### Stage 7 messaging and notification (local only)

#### `leaderboard_case_messages`

- exactly one proposal or participation subject;
- actor ID/role, visibility, message type, body, timestamp;
- body length 1–2,000;
- internal notes must be admin-authored and `admins_only`.

#### `leaderboard_notifications`

- recipient Auth user;
- exactly one case subject;
- event type, title, short message;
- read state and timestamp consistency constraint.

## 10. Scoring presets currently defined remotely through Stage 6

| Code | Template | Rules |
|---|---|---:|
| `internal-ub` | Internal Universitas Brawijaya | 10 |
| `regional` | Regional / Provinsi | 10 |
| `nasional` | Nasional | 10 |
| `internasional` | Internasional | 10 |
| `pkm` | Program Kreativitas Mahasiswa | 6 |
| `umum` | Umum / Kustom | 10 |
| `internal-arsc` | Internal ARSC — Lomba Wajib | 5 |

National/international/general families include champion 1/2/3, hopes/honorable mentions 1/2/3, finalist, semifinalist, selection/delegation, and participant. PKM has internal UB selection, funding, PIMNAS finalist, and bronze/silver/gold PIMNAS. Every competition receives editable copied rules; presets are starting points, not permanent global scoring locks.

## 11. Remote deployment history and evidence

### Bootstrap and Stage 3

`deployment/remote/results/deployment_closeout.md` records:

- bootstrap committed;
- Stage 3 committed;
- verification passed;
- no remote user/participation data inserted;
- protected Rapor/Halo boundaries preserved according to the captured verification scope.

### Stage 4

Remote verification records:

- table exists and RLS passed;
- functions 10/10;
- triggers 4/4;
- privilege checks 7/7;
- failure count 0;
- no unexpected protected-object drift.

### Stage 5

- committed 2026-08-10;
- six templates, 56 rules;
- no competition without rules;
- direct authenticated writes blocked;
- failure count 0.

### Stage 6

- committed 2026-08-10;
- seven templates, 61 rules;
- zero competitions without active tracks;
- proposal/track direct authenticated writes blocked;
- protected fingerprints unchanged;
- failure count 0.

### Stage 7

`deployment/remote/results/stage7_local_validation.md` explicitly records:

- remote Supabase execution: `NOT RUN`;
- Vercel deployment: `NOT RUN`;
- `db push`: not used.

Artifact SHA-256 values:

- preflight: `7C3FA130B799EA0B76CCE193FB5DDF0427FE786C6485B1089B1A248291DC2F73`
- deployment: `8540B4E4DAC58B3D935074E90ACF5D025C29B7BF34CC9EEC4234F97360AD2FD8`
- verification: `B11ADE7D0961C8D94BE1D18A0B4463080412270AC10E1D350346BE605E1CFE3D`
- operational rollback: `FAE5220331D4F4557C59DD11EE4E84DE335698AB48C07A6C3569546C5F81303F`

Recompute hashes immediately before any approval; edits invalidate these values.

## 12. Stage 7 next safe operation

The next permissible remote step is only the enhanced read-only preflight, and only after explicit approval.

Exact order:

1. Confirm clean worktree and recompute all Stage 7 hashes.
2. Review `deployment/remote/stage7_operations_runbook.md`.
3. Obtain approval for `preflight_stage7_operations.sql` only.
4. Owner manually runs it in Supabase SQL Editor.
5. Preserve all output and reject any failed prerequisite/collision/protected drift.
6. Obtain separate approval for `stage7_operations.sql`.
7. Owner manually runs exactly that file.
8. Obtain separate approval for `verify_stage7_operations.sql`.
9. Require `stage7_structure_and_privileges / failure_count = PASS / 0` and identical protected fingerprints.
10. Commit/push/deploy frontend only after database verification.
11. Perform role-based smoke tests from the runbook.

No agent should run remote SQL, Vercel mutation, or `db push` merely because this document exists.

## 13. Tests and CI

### Recorded Stage 7 local results

- action/static: 35/35 passed;
- sync: 5/5 passed;
- Rapor contract passed;
- database Stages 3–7 passed;
- browser E2E: 5/5 passed;
- production build passed;
- ESLint: 0 errors, 8 existing Fast Refresh warnings;
- responsive visual inspection passed at 390×844 and 1280×720.

### CI workflow

`.github/workflows/ci.yml` contains:

- `quality`: Node 24, `npm ci`, high audit, lint, tests, build;
- `browser-smoke`: Chromium Playwright with local-only placeholder configuration;
- `database-contract`: Supabase CLI local instance and database test harness.

Never add production account credentials to CI. E2E must use mocks or isolated local Supabase fixtures.

## 14. Shared identity and secret constraints

- `contracts/arsc-shared-identity.v1.json` SHA-256 at audit: `B53B7BFEFE990B65D83C78F92ABEA3A7BD92509152F2C57BED2831020BEE1E39`.
- `contracts/rapor-leaderboard.v1.json` SHA-256 at audit: `0B816853C922B50222E9015B29FE6E332C005BFFE31190BDF551F3DEEDD26A85`.
- `RAPOR_ACCESS_CODE_PEPPER` must be server-only, sensitive, and identical across Rapor/Halo/Leaderboard.
- Auth credentials belong only to Supabase Auth.
- Access codes are normalized and hashed server-side; raw codes are not persisted by Leaderboard.
- Service-role/integration secrets must never reach client bundles.

## 15. Protected boundaries

Any Leaderboard SQL deployment must fingerprint and preserve at least:

- Auth triggers involved in user creation/email synchronization;
- Halo tables such as `users`, `reports`, `chat_sessions`, `appointments`, and related objects actually present in the remote inventory;
- Rapor tables and `get_leaderboard_reference_members()`;
- shared identity functions/triggers/tables;
- pre-existing Leaderboard history and grants.

Fingerprint contracts should cover columns/defaults, keys/constraints, RLS, policies, table/sequence grants, complete triggers, function signature/result/body/security/volatility/owner/search path/execute privileges.

## 16. Known limitations and risks

1. Stage 7 local frontend and production database are not yet at the same feature level.
2. Stage 7 notifications are polled, not truly realtime.
3. There is no unified cross-application notification system.
4. Compatibility fallbacks can hide an undeployed newer RPC; operational verification must still check the intended version.
5. `verification_requests` is legacy alongside the modern `participation_logs` workflow; do not remove it without a remote data/dependency audit.
6. Current schema shares `public` with other products; accidental generic object names are high risk.
7. Public rankings must include approved data only and must not leak evidence/private notes.
8. No period/archive model exists yet.
9. Leaderboard-to-Rapor Suksesi projection is not implemented.

## 17. Next product stages after Stage 7 release

Leaderboard should remain stable while the next cross-system work begins in Rapor:

1. Rapor Suksesi read/audit/export admin foundation.
2. Controlled Suksesi import/write pipeline.
3. Versioned approved-participation projection from Leaderboard to Rapor staging.
4. Period/lifecycle and archive integration.

Any new Leaderboard period fields must wait for a cross-system period contract. Do not add an isolated `year` column as a shortcut.

## 18. Definition of done for Leaderboard

A change is done only when:

- member and admin flows both work;
- RLS/RPC authorization is tested, not just UI-hidden;
- direct writes to protected workflow tables remain blocked;
- historical awarded snapshots remain unchanged;
- error/loading/empty/retry states are usable;
- mobile and desktop have no overflow;
- unit, database, contract, E2E, lint, and build gates pass as applicable;
- remote deployment has separate preflight/deploy/verify evidence;
- Rapor/Halo/shared fingerprints show no unexpected drift;
- runbook and closeout reflect the actual remote status.

## 19. Files that should be read before changing code

1. `docs/AI_HANDOFF_COMPLETE_CONTEXT.md`
2. `contracts/arsc-shared-identity.v1.json`
3. `contracts/rapor-leaderboard.v1.json`
4. `deployment/remote/results/stage6_closeout.md`
5. `deployment/remote/results/stage7_local_validation.md`
6. `deployment/remote/stage7_operations_runbook.md`
7. the action/component being changed and its tests
8. relevant deployment SQL and verification SQL

## 20. Instructions to the next AI

- Inspect `git status` and current HEAD first.
- Never rely on old README feature claims without code evidence.
- Label local vs remote status precisely.
- Do not use real user credentials from prior conversations.
- Do not mutate Supabase/Vercel without exact explicit approval.
- Do not use `db push`.
- Use one reviewed artifact per SQL Editor execution.
- Preserve unrelated user changes.
- Keep cross-repository contracts identical and run consumer tests in every affected repository.
