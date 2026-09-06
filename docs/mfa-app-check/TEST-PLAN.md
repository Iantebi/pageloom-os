# Test plan — Staged MFA + App Check

Companion to `PRD.md` and `SECURITY.md`. Follows this repo's existing layered test strategy (see
`docs/customer-discovery-onboarding/TEST-PLAN.md` for the original template).

| Layer | Framework / location | What already existed | What this change adds |
|---|---|---|---|
| Pure policy logic | Vitest, `packages/core/src/mfa-policy.test.ts` | — | Every `MfaEnforcementMode` × role combination for `mfaRequiredForRole`/`mfaEnrollmentOffered`; default-to-`"off"` parsing for unset/unknown env values |
| Functions authorization (string-match) | Vitest, `functions/src/auth.test.ts` | Disabled-before-role-check, revocation-skip, client-project-access coverage | MFA claim extraction, enforcement-mode load, ordering (MFA checked only after disabled/role denial), platform-administrator gating, `MFA_REQUIRED` error code |
| Functions authorization (behavioral) | Vitest + `vi.doMock`, `functions/src/auth-mfa.test.ts` | — (new pattern for this codebase — most functions tests are string-match only) | Executes `requireRole`/`requirePlatformAdmin` against a mocked Firestore for both `off` and `required` modes: owner without a factor denied, owner with a factor allowed, ineligible roles never blocked, disabled member still denied first, platform administrator gated the same as an org role |
| App Check middleware (behavioral) | Vitest + `vi.doMock`, `functions/src/app-check.test.ts` | — | Missing header, valid token, and invalid/rejected token all reach `next()` exactly once and never trigger `res.status` — the monitoring-only guarantee is asserted directly, not just described in a comment |
| Staff admin API (string-match) | Vitest, `functions/src/staff-admin-api.test.ts` | Escalation/self-change/disabled-target guards | `/staff/:uid/mfa-reset`: owner-only, self-change denied, client-role target denied, factor-clearing + token revocation, activity-log entry |
| MFA recovery CLI (string-match) | Vitest, `functions/src/mfa-recovery.test.ts` | — (mirrors `owner-provisioning.test.ts`'s pattern for `provision-platform-owner.mjs`) | Dry-run default, production-project pin, verified-email confirmation, factor clearing + token revocation, no-op when nothing is enrolled |
| Web pure helpers | Vitest (Node env), `apps/web/src/lib/mfa.test.ts` | — | `isMfaRequiredError` recognizes the exact Firebase error code and never throws on non-error input; `totpHint` picks the TOTP hint out of a multi-hint resolver |
| Web route smoke | Vitest (Node env, `renderToStaticMarkup`), `apps/web/src/app/route-smoke.test.tsx` | Every built route renders without throwing for an authenticated Owner | `/settings` now also renders `AccountSecurity`; unaffected by the new `useAuth()` fields since they're read inside effects, not during the synchronous render this test exercises |
| Firestore/Storage rules | `firestore-rules.behavioral.test.ts` / `storage-rules.behavioral.test.ts` | Disabled-member and role-boundary coverage | Unchanged — no `request.app` check was added (see `SECURITY.md` for why), so no new rules assertions were needed here |

## Manual verification (not automatable without a real Firebase project)

These require a real Firebase project with Identity Platform / App Check configured and are **not**
part of this PR's automated checks — they belong to the staged rollout in `ROLLOUT.md`:

1. Enroll a TOTP factor as a real Owner/Admin against the emulator or a sandbox project once MFA is
   enabled there; confirm the QR/manual-key flow in `account-security.tsx` completes.
2. Sign out and back in; confirm the `auth/multi-factor-auth-required` challenge appears and a valid
   code completes sign-in, an invalid code shows `mfaChallenge.invalidCode`.
3. Set `NEXT_PUBLIC_APP_CHECK_SITE_KEY` locally, confirm requests to `/api/**` carry
   `X-Firebase-AppCheck` in the Network tab and the Firebase Console's App Check metrics register them.
