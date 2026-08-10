# Stage 7 operations deployment runbook

## Scope

Stage 7 adds case conversations, user notifications, required rejection reasons, and guarded deletion for empty archived competitions. It does not alter Rapor, Halo PSDM, shared identity records, member scores, or historical participation rows.

## Non-negotiable safety gates

- Target only Supabase project `arsc` (`jyznguhencjwtzupxjjk`).
- Never use `supabase db push`.
- Run one reviewed SQL artifact at a time in the Supabase SQL Editor.
- Each remote step requires separate explicit approval and complete output capture.
- Any missing prerequisite, collision, `FAIL`, warning, or SQL error is a stop condition.
- Compare protected-object fingerprints from preflight and verification mechanically.
- Do not run the operational rollback unless separately approved.

## Artifact integrity

- Preflight SHA-256: `7C3FA130B799EA0B76CCE193FB5DDF0427FE786C6485B1089B1A248291DC2F73`
- Deployment SHA-256: `8540B4E4DAC58B3D935074E90ACF5D025C29B7BF34CC9EEC4234F97360AD2FD8`
- Verification SHA-256: `B11ADE7D0961C8D94BE1D18A0B4463080412270AC10E1D350346BE605E1CFE3D`
- Operational rollback SHA-256: `FAE5220331D4F4557C59DD11EE4E84DE335698AB48C07A6C3569546C5F81303F`

Recompute the relevant hash immediately before every manual execution. If it differs, stop and review the changed artifact.

## Remote execution sequence

1. With approval limited to read-only inspection, run only `deployment/remote/preflight_stage7_operations.sql`.
2. Export and preserve the complete result. Require `preflight_gate / stage7_readiness / failure_count = PASS / 0`.
3. Confirm both competition foreign-key prerequisites report `competition_delete_is_cascade = PASS / 1`. This describes the Stage 6 starting state; Stage 7 replaces these destructive cascades with `RESTRICT`.
4. Confirm Stage 7 table, function, and trigger collision counts are all zero.
5. Compare all protected Rapor, Halo PSDM, shared-identity, and auth-trigger fingerprints with the accepted Stage 6 verification baseline.
6. Only after separate deployment approval, run `deployment/remote/stage7_operations.sql`.
7. Capture the complete SQL Editor output. Expected successful result: `Success. No rows returned`.
8. Only after separate verification approval, run `deployment/remote/verify_stage7_operations.sql`.
9. Require `verification_gate / stage7_structure_and_privileges / failure_count = PASS / 0` and identical protected fingerprints.
10. Commit and deploy the frontend only after the database verification passes.

## Post-deployment smoke test

1. As a non-PH member, open **Pengajuan & percakapan** and send a message on an existing proposal.
2. As an admin, confirm the message appears and creates an unread notification.
3. Reply publicly, then confirm the member sees the reply and notification.
4. Add an admin-internal note and confirm it is visible to admins but absent for the member.
5. Reject a test participation without a reason and confirm the action is blocked.
6. Reject it with a clear reason and confirm the member can read that reason.
7. Archive an unused test competition, type its exact title, and confirm deletion succeeds.
8. Attempt to delete an archived competition with participation history and confirm deletion is refused and history remains intact.
9. Check mobile welcome, `/leaderboard`, `/auth`, `/requests`, and `/admin` for overflow and usable navigation.

## Rollback behavior

`deployment/remote/operational_rollback_stage7.sql` removes the Stage 7 triggers and revokes user access to its mutation RPCs. It intentionally preserves messages, notifications, and `ON DELETE RESTRICT` foreign keys. Restoring destructive cascades or deleting Stage 7 data is outside this rollback and requires a separate recovery decision.
