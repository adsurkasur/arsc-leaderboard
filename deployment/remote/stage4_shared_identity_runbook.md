# Stage 4 shared identity deployment runbook

## Target model

- `auth.users.id` is the shared account key for Halo PSDM and ARSC Leaderboard.
- Email, password, password reset, and email verification remain managed only by Supabase Auth.
- `public.arsc_identities` records the one-to-one verified link between an Auth account and an ARSC member.
- Rapor ARSC remains accountless. Its active access code is identity evidence, not an account password.
- Verified name, unit, and position come from Rapor and are projected into `public.users` and `public.profiles`.
- Halo role, WhatsApp number, activation state, reports, chats, and other operational fields are preserved.

## Non-negotiable safety gates

- Never use `supabase db push` for this deployment.
- Never paste more than one deployment artifact into the SQL Editor at a time.
- Never run Stage 4 or rollback without separate explicit approval.
- Treat all Rapor, Halo PSDM, and pre-existing Leaderboard objects as protected.
- A preflight collision, missing prerequisite, warning, or error is a stop condition.
- The rollback preserves `public.arsc_identities` and its verified links. Data deletion requires a separate recovery decision.

## Before any Stage 4 remote execution

1. Confirm the Halo PSDM and Leaderboard Vercel projects both use Supabase project `jyznguhencjwtzupxjjk`.
2. Confirm Rapor ARSC, Halo PSDM, and ARSC Leaderboard all use the Supabase/Vercel connection and consume its integration-managed server credentials. Do not retain manually copied duplicates of integration-managed Supabase variables.
3. Generate a new high-entropy `RAPOR_ACCESS_CODE_PEPPER` and new random Rapor access codes.
4. In the Rapor repository, generate RTP and Suksesi payloads, then build the dedicated atomic rotation artifact:
   - `python scripts/build-rapor-payloads-from-xlsx.py --mode rtp`
   - `python scripts/build-rapor-payloads-from-xlsx.py --mode suksesi`
   - `python scripts/build-rapor-access-code-rotation-sql.py --mode both`
5. Configure the identical server-only `RAPOR_ACCESS_CODE_PEPPER` as one Sensitive Vercel Shared Environment Variable linked to Rapor ARSC, Halo PSDM, and ARSC Leaderboard for Production and Preview. Never use a `NEXT_PUBLIC_` variable for it, and remove project-level duplicates before the rotation window.
6. Review and manually execute only the generated `workbook/dist/supabase/rotate_rapor_access_codes_both.sql`. It updates `public.rapor_access_codes` in one transaction and refuses a member-set mismatch. Do not use the general staging uploader to rotate production codes.
7. Immediately redeploy all three Vercel projects after the database rotation so their server runtimes use the same pepper as the new hashes. Do not distribute or test the new codes while database and deployments are on different pepper versions.
8. Confirm the integration-managed server-only Supabase secret is available to Rapor ARSC, Halo PSDM, and ARSC Leaderboard. Legacy fallback variable names may remain supported in code, but must not replace the integration-managed production value.
9. Confirm no credential or generated Rapor payload is present under a public/static directory or in a deployment artifact.

## Remote execution sequence

Every numbered SQL execution requires its own approval and complete raw output capture.

1. Run only `deployment/remote/preflight_stage4_identity_single_result.sql` in the Supabase SQL Editor.
2. Review every prerequisite, collision row, alignment count, and protected-object fingerprint.
3. If and only if the preflight is accepted, compute and record the final SHA-256 of `deployment/remote/stage4_identity_and_public_reads.sql`.
4. Run only the approved Stage 4 file manually in the SQL Editor.
5. Run only `deployment/remote/verify_stage4_identity.sql` after separate approval. Compare the protected-object fingerprints mechanically with the preflight output.
6. Confirm the shared pepper is linked to all three Vercel projects with no project-level duplicate.
7. Run only the reviewed Rapor access-code rotation artifact and capture its complete result.
8. Immediately redeploy Rapor ARSC, Halo PSDM, and ARSC Leaderboard.
9. Complete the smoke test below with dedicated non-production test identities where available.

## Post-deployment smoke test

1. Sign in to Halo PSDM with an existing account.
2. Sign in to ARSC Leaderboard with the same email and password.
3. Enter the same newly rotated Rapor access code in either app, once.
4. Confirm both apps show the canonical Rapor name and unit without admin intervention.
5. Confirm a second Auth account cannot claim the same Rapor identity.
6. Change the avatar in Halo PSDM and confirm it appears in Leaderboard.
7. Change the account password in one app, sign out, and confirm the new password works in the other app.
8. Confirm Halo role, WhatsApp number, reports, chat history, and activation state are unchanged.
9. Confirm public Leaderboard reads contain approved participation only.

## Session expectation

The two apps share credentials because they use the same Supabase Auth project. They do not automatically share a browser session across unrelated domains. Users may need to sign in once per app even though the email and password are the same. Cross-domain single sign-on is a separate future feature.
