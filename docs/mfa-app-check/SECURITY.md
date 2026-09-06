# Security model — Staged MFA + App Check

Companion to `PRD.md` and `TEST-PLAN.md`.

## Assets and threats

| Asset | Threat | Mitigation |
|---|---|---|
| Owner/Admin session (highest-privilege org role) | Credential-only compromise (phished/reused password, hijacked Google session) | Second factor at sign-in once enrolled; enforced server-side per request via the ID token's native `sign_in_second_factor` claim, not a client-asserted flag |
| `/api/**` | Non-app clients (scripts, replayed tokens) hitting the API directly | App Check token attached by the real web app; monitoring mode observes this without yet rejecting anything (see below) |
| Locked-out Owner/Admin | Support/recovery process itself becomes an attack vector (someone else resets your MFA) | In-app reset requires an authenticated Owner, is never self-service, and is audit-logged (`staff.mfa_reset` activity entry); CLI recovery is production-project-pinned and requires the account's exact verified email as a second confirming input |
| TOTP shared secret | Leaking the secret during enrollment | No QR image is rendered through any third-party image/rendering service — only a locally generated `otpauth://` URI and secret key, displayed as plain text, never sent anywhere except the Firebase Auth SDK call that consumes it directly in the browser |

## Why App Check ships monitoring-only, not enforcing

Firebase App Check enforcement (rejecting Firestore/Storage/Functions requests that lack a valid
token) is a **per-product, project-level Firebase Console setting** — not something this codebase
can safely default to "on" from a PR. Flipping it in Console before every real client (this web app
in every environment it's actually used from, and any admin/CLI tooling that talks to the same
project) is verified to attach a valid token would immediately break those clients. That's why:

- `functions/src/app-check.ts`'s `monitorAppCheck` **never calls `res.status`/rejects a request** —
  it only verifies the token (when present) and logs the outcome via `operationalLog`, so an
  operator can watch real traffic before deciding to enforce anything.
- No `request.app` check was added to `firestore.rules`/`storage.rules`. Adding one there is exactly
  equivalent to enforcing, just via a different product — deferred for the same reason, and because
  `@firebase/rules-unit-testing`'s emulator contexts don't send App Check tokens by default, so doing
  this properly needs its own rules-behavioral-test design, out of scope for this change.
- The Firebase Console toggle to enable enforcement is explicitly listed as **not performed** by this
  PR (see `CLAUDE.md`'s production-deployment gate and the issue's own instruction not to touch
  Console config).

## Why MFA enforcement defaults to "off"

`MFA_ENFORCEMENT_MODE` unset/blank parses to `"off"` (`packages/core/src/mfa-policy.ts`,
`parseMfaEnforcementMode`), and `"off"` makes `mfaRequiredForRole()` return `false` for every role
unconditionally. Deploying this code changes nothing until an operator deliberately sets the env var
— and per `ROLLOUT.md`, only after confirming every current Owner/Admin has already enrolled, so
`"required"` never locks out someone who simply hasn't gotten to it yet.

## Why the MFA check lives in `auth.ts`'s existing gates, not a new middleware

`requireRole`/`requireCeo`/`requirePlatformAdmin`/`requirePlatformOrRole`/`requirePlatformProjectAccess`
are already the single chokepoint every API route calls before touching Firestore (see
`docs/SECURITY.md` at the repo root and `auth.test.ts`'s existing "disabled members denied before
role check" coverage). Adding the MFA check there — ordered strictly after the existing
disabled/role checks — means every route gets consistent enforcement for free and the ordering
guarantee (disabled/role denial always wins) is structurally impossible to violate by forgetting to
call a separate MFA-only guard somewhere.

## Residual risk / explicitly accepted for this stage

- A stolen, still-valid ID token issued *after* a successful MFA sign-in remains valid for its
  normal lifetime (~1h) regardless of MFA — this mirrors existing session-hijacking exposure for
  every Firebase Auth ID token today; MFA hardens authentication, not session handling.
- `MFA_ENFORCEMENT_MODE`/App Check site key are read from process env / build-time env — an operator
  with deploy access could unset them; this is the same trust boundary every other `defineString`
  param in `functions/src/config.ts` already has.
