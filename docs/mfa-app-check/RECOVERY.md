# Account recovery — Owner/Admin locked out of MFA

Companion to `ROLLOUT.md` and `SECURITY.md`. Use this when an Owner/Admin cannot complete the
second-factor challenge at sign-in (lost/wiped device, uninstalled authenticator app, etc).

## Why this can't be self-service

Resolving a second-factor challenge happens **before** a session or ID token exists — Firebase Auth
throws `auth/multi-factor-auth-required` mid sign-in and only issues a session after the challenge
resolves. A locked-out user therefore cannot call any `/api/**` route (`authenticate()` in
`functions/src/auth.ts` requires a valid Bearer ID token first), including a hypothetical
"reset my own MFA" endpoint. Recovery always has to come from outside that user's own session.

## Path 1 — another Owner resets it in-app (most cases)

If the organization has at least one other Owner who is not the locked-out person:

1. That Owner calls `POST /api/staff/:uid/mfa-reset` with `{ organizationId }` (or drives it through
   whatever admin UI later wraps this endpoint — none exists yet beyond the raw API).
2. This is Owner-only (not Admin), and refuses to target the caller's own account
   (`SELF_CHANGE_DENIED`) — see `functions/src/staff-admin-api.ts`.
3. It clears every enrolled second factor (`auth.updateUser(uid, { multiFactor: { enrolledFactors: null } })`)
   and revokes the user's refresh tokens so the change takes effect immediately, then records a
   `staff.mfa_reset` entry in `organizations/{orgId}/activity` for auditability.
4. The affected user signs in again with Google only, and — if `MFA_ENFORCEMENT_MODE=optional` or
   `required` — sees the enrollment prompt again to add a new factor.

## Path 2 — sole Owner locked out (CLI recovery)

If the locked-out person is the organization's *only* Owner, Path 1 has nobody to invoke it. Use the
CLI script, which mirrors `functions/scripts/provision-platform-owner.mjs`'s safety conventions:

```
npm run recover:mfa --workspace=@pageloom/functions -- --uid=<firebase-uid> --email=<verified-email>
```

- **Dry-run by default** — prints the user's currently enrolled factors and exits without changing
  anything. Add `--apply` to actually clear them.
- **Pinned to `pageloom-os-production`** — refuses to run against any other `.firebaserc` project.
- **Requires the account's exact verified email** as a second confirming input, not just the uid —
  refuses if it doesn't match, same as `provision-platform-owner.mjs`.
- Clears enrolled factors, revokes refresh tokens, and writes an entry to the top-level
  `mfaRecoveryLog` Firestore collection recording what was removed and when.
- No-ops (does not call `updateUser` at all) if the account has nothing enrolled — running it twice,
  or against an account that was already recovered, is safe.

Requires the same credentials/access as `provision:owner` (Application Default Credentials or a
service-account key for `pageloom-os-production` via `GOOGLE_APPLICATION_CREDENTIALS`) — i.e., this
is an operator/CI-identity action, not something exposed to any in-app role.

## After either path

- The affected user must sign in again (their old session's refresh token was revoked).
- If MFA is enforced (`required`), they'll be prompted to enroll a new factor before continuing —
  this is the same enrollment flow as first-time setup, nothing special about "post-recovery" state.
- Consider whether the lockout indicates a device (not just a session) was compromised or lost, and
  whether other credentials tied to that device need review — outside this doc's scope, a normal
  incident-response judgment call for whoever runs the recovery.
