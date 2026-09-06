# PRD — Staged Owner/Admin MFA + Firebase App Check

## Problem

Two P1 launch-roadmap gaps (`docs/LAUNCH-ROADMAP.md`): Owner/Admin accounts have no second factor, and no
App Check protects `/api/**` from non-app clients (scripted abuse, credential-stuffed tokens replayed
outside the real web app). Both are identity/traffic hardening, not new product surface — they must not
change existing login behavior, RBAC, or tenant isolation for anyone who hasn't opted in.

## Goals

- Owner/Admin can enroll a TOTP (authenticator-app) second factor and use it at sign-in.
- A locked-out Owner/Admin (lost device) can be recovered without waiting on Firebase support.
- The web app attaches a Firebase App Check token to every request once configured, in monitoring
  mode only — App Check enforcement (rejecting unattested requests) is explicitly out of scope for
  this change; that is a separate, later, Firebase Console decision.
- Zero behavior change for every existing user until an operator deliberately opts in via env vars.

## Non-goals

- Enabling MFA enrollment methods or App Check enforcement in the Firebase Console — this PRD ships
  the code; enabling either in a real environment is a documented follow-up (`ROLLOUT.md`).
- Phone/SMS second factor — TOTP only (no per-SMS cost, no carrier dependency, works offline).
- MFA for `operator`/`member`/`client` roles — only Owner/Admin are in scope, per the issue.

## Users affected

| Role | Effect while `MFA_ENFORCEMENT_MODE=off` (default) | Effect at `optional` | Effect at `required` |
|---|---|---|---|
| Owner / Admin | None | Sees enrollment UI on `/settings`; not blocked | API access requires a verified second factor |
| Operator / Member / Client | None | None | None (never eligible — see `mfa-policy.ts`) |

## Design summary

- **Enrollment/sign-in**: Firebase Auth's native multi-factor APIs (`multiFactor`,
  `TotpMultiFactorGenerator`, `getMultiFactorResolver` — already shipped in the installed
  `firebase@^12` client SDK, no new dependency). See `apps/web/src/lib/mfa.ts`.
  - the "actual TOTP as a second factor" capability requires Identity Platform / MFA to be turned on
    for the Firebase project in Console — a config change explicitly out of scope for this PR (see
    `ROLLOUT.md`). Until then, `beginEnroll()` in `account-security.tsx` fails safely with
    `s.enrollError` and changes nothing else.
- **Enforcement**: a single staged switch, `MFA_ENFORCEMENT_MODE` (`off`/`optional`/`required`),
  read once at Functions cold start (`functions/src/auth.ts`) and enforced at the existing
  `requireRole`/`requirePlatformAdmin`/`requirePlatformOrRole`/`requirePlatformProjectAccess`
  chokepoints — the same places `disabled` and role checks already live, so every existing route
  gets the same treatment for free.
- **Recovery**: an Owner can reset another locked-out Owner/Admin's MFA in-app
  (`POST /api/staff/:uid/mfa-reset`); a sole locked-out Owner uses the CLI script
  `functions/scripts/mfa-recovery.mjs` (mirrors `provision-platform-owner.mjs`'s dry-run/production-
  pinned conventions). Full detail in `RECOVERY.md`.
- **App Check**: `apps/web/src/lib/firebase.ts` initializes App Check with `ReCaptchaV3Provider` only
  when `NEXT_PUBLIC_APP_CHECK_SITE_KEY` is set, wrapped in try/catch behind a browser-only guard.
  `functions/src/app-check.ts` verifies the `X-Firebase-AppCheck` header when present and logs the
  outcome — it never rejects a request. See `SECURITY.md` for the full threat-model reasoning.

## Out of scope / explicitly deferred

- Flipping `MFA_ENFORCEMENT_MODE` to `optional`/`required` in the deployed production environment.
- Enabling TOTP MFA or App Check enforcement in the `pageloom-os-production` Firebase Console.
- Any change to `firestore.rules`/`storage.rules` enforcement (`request.app`) — see `SECURITY.md` for
  why that's deferred, not just skipped by omission.
