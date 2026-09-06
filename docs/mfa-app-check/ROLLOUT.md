# Staged rollout — Owner/Admin MFA + App Check

This is the operational runbook for turning on what this PR ships. **None of the steps below are
performed by this PR** — it ships code, staged behind env vars defaulting to fully off, per
`CLAUDE.md`'s production-deployment gate (no Console config, no deploys, no production data).

## Prerequisites (Firebase Console — an operator, not this PR)

1. **MFA**: Firebase project must have multi-factor authentication enabled
   (Authentication → Sign-in method → Advanced → Multi-factor authentication). TOTP requires the
   project to be on Identity Platform (Firebase's upsell path from "Firebase Authentication" to
   "Identity Platform" inside the same Console page) — confirm pricing/quota implications before
   enabling in `pageloom-os-production`.
2. **App Check**: register the web app in Console → App Check, using the reCAPTCHA v3 site key you'll
   put in `NEXT_PUBLIC_APP_CHECK_SITE_KEY`. Leave every product (Firestore/Storage/Functions) in
   **unenforced** mode — do not toggle enforcement.

## Stage 1 — App Check, monitoring only

1. Set `NEXT_PUBLIC_APP_CHECK_SITE_KEY` (GitHub Actions variable / hosting env, same mechanism as the
   existing `NEXT_PUBLIC_FIREBASE_*` values in `ci.yml`'s Build step).
2. Deploy hosting only. `functions/src/app-check.ts` already logs `app_check.token_missing` /
   `app_check.token_invalid` / (implicitly) valid-token requests without rejecting any of them.
3. Watch Firebase Console → App Check → metrics for each product for **at least several days of
   real traffic**, across every environment/client that calls `/api/**` (the web app in every
   deployment target, any CLI/script that calls the API directly with a service identity — those
   will show as unattested and are expected to stay that way, or be given their own attestation
   path, before ever enforcing).
4. **Do not** enable enforcement in Console as part of this stage or this PR. That's a separate,
   later decision this doc does not make.

## Stage 2 — MFA, optional

1. Set `MFA_ENFORCEMENT_MODE=optional` on Cloud Functions (`functions:config` / the same `params`
   mechanism as `AI_EXECUTION_MODE` in `functions/src/config.ts` — add a matching `defineString` if
   promoting this out of a raw `process.env` read).
2. Every Owner/Admin now sees the enrollment card on `/settings` (`account-security.tsx`) but nothing
   is blocked yet.
3. Confirm with every current Owner/Admin that they've successfully enrolled (self-report, or check
   each `systemAdministrators`/org member's Firebase Auth `multiFactor.enrolledFactors` via the
   Admin SDK/Console — do not query production Auth data outside of this verification purpose).

## Stage 3 — MFA, required

1. Only after every current Owner/Admin is confirmed enrolled (Stage 2's exit criterion — skipping
   this is exactly how an existing user gets locked out).
2. Set `MFA_ENFORCEMENT_MODE=required`. `requireRole`/`requirePlatformAdmin`/`requirePlatformOrRole`/
   `requirePlatformProjectAccess` in `functions/src/auth.ts` now return `403 MFA_REQUIRED` for any
   owner/admin whose ID token lacks `firebase.sign_in_second_factor`.
3. Keep `RECOVERY.md` on hand for the first few days — this is when a lost-device lockout would
   surface.

## Rollback (any stage)

Every stage is a single env var, and rolling back is the same operation in reverse — no data
migration, no rules change to revert, no Console toggle to undo beyond what Stage 1/2 asked you to
set:

| To undo | Action | Effect |
|---|---|---|
| Stage 3 (MFA required) | Set `MFA_ENFORCEMENT_MODE=optional` (or unset → `off`) | Immediately stops blocking anyone; already-enrolled factors are untouched and still usable |
| Stage 2 (MFA optional) | Set `MFA_ENFORCEMENT_MODE=off` (or unset) | Enrollment UI stops appearing; existing enrolled factors are untouched (Firebase Auth still accepts them at sign-in — see note below) |
| Stage 1 (App Check monitoring) | Unset `NEXT_PUBLIC_APP_CHECK_SITE_KEY` and rebuild/redeploy hosting | `initializeAppCheck` is never called (guarded in `firebase.ts`); no header is attached; already-collected Console metrics are unaffected |

**Note:** disabling `MFA_ENFORCEMENT_MODE` does **not** unenroll anyone's second factor — Firebase
Auth itself still offers/accepts the challenge at sign-in for any user who enrolled one, independent
of this app's enforcement setting. Actually removing a factor is `RECOVERY.md`'s
`/staff/:uid/mfa-reset` or the enrolled user's own "Remove" button in `account-security.tsx`.

## What this PR does not decide for you

- Whether TOTP MFA fits `pageloom-os-production`'s Firebase plan/tier (Identity Platform pricing).
- The exact watch-window length for Stage 1 before considering App Check enforcement (a separate,
  later PR/decision — not in scope here at all, staged or otherwise).
- Any communication to real Owner/Admin users about enrolling — that's a business/support process,
  not a code change.
