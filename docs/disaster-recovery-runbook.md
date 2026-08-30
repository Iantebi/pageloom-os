# PageLoom OS — Disaster Recovery Runbook

Firebase project: `pageloom-os-production`. Two Google accounts hold full, equal Firebase project Owner and PageLoom platform Owner (`platformRole: owner`) status: `pageloom.studio@gmail.com` (the primary business identity — use this for day-to-day CLI/administration) and `iantebi5@gmail.com` (the original personal account, kept active specifically as an emergency fallback — see §8c). This runbook assumes the reader has, or can regain, at least one of the two.

## 1. Laptop lost, stolen, or destroyed

Nothing on the laptop is a single point of failure for the running product:
- **Source code**: fully recoverable from GitHub (`https://github.com/Iantebi/pageloom-os`, branch `main`).
- **Business data**: lives entirely in Firestore/Cloud Storage, not on the laptop.
- **Local-only state that IS lost**: your `firebase login` CLI session and `gcloud` Application Default Credentials — both trivially re-created (see §8).

**Recovery**: get a new computer, follow §2.

## 2. Setting up a new development machine

```bash
git clone https://github.com/Iantebi/pageloom-os.git
cd pageloom-os
npm install
```
Then re-establish credentials — see §8 (Firebase CLI login) and §8b (gcloud ADC), both interactive one-time browser sign-ins with `pageloom.studio@gmail.com` (or `iantebi5@gmail.com` if the primary account is unavailable — see §8c). No secrets need to be manually copied; `functions/.env.pageloom-os-production` and Secret Manager values are pulled by the CLI/emulator once authenticated.

## 3. Corrupted or lost local git repository

The canonical copy is `origin/main` on GitHub, not any local clone.
```bash
rm -rf pageloom-os   # only the LOCAL broken copy — this does not touch GitHub
git clone https://github.com/Iantebi/pageloom-os.git
```
If you have local uncommitted work you need to save first, copy the working directory aside before deleting it, or `git stash` / commit to a throwaway branch and push it before reinstalling.

## 4. Bad production deployment

Firebase Hosting keeps prior releases. To roll back:
```bash
firebase hosting:clone pageloom-os-production:live pageloom-os-production:live --version <previous-version-id>
```
or use the Firebase Console → Hosting → Release history → "Rollback" on the last known-good release. For a bad Cloud Functions deployment, redeploy the previous commit's `functions/` code (`git checkout <previous-good-sha> -- functions && firebase deploy --only functions`), since Functions doesn't have a one-click rollback the way Hosting does. For a bad Firestore rules deployment, redeploy the previous `firestore.rules` from git the same way — rules changes take effect immediately but the previous version is always recoverable from git history.

## 5. Accidental Firestore deletion

- **Single document/collection accidentally deleted**: recoverable only if Point-in-Time Recovery (PITR) is enabled (see the open decision in §9 — **not yet enabled at the time of writing**) or from the most recent scheduled export, if one exists. Without either, a client-level accidental delete is **not recoverable** — Firestore rules already block all direct client writes (`allow write: if false` everywhere), so this specific risk is mitigated architecturally: only server-side Cloud Functions code can delete anything, and a grep of `functions/src` for `.delete()` calls should be re-run periodically to confirm no route allows an unscoped/bulk delete without strong authorization.
- **Whole database accidentally deleted**: Firestore delete protection is **enabled** (confirmed 2026-08-29) — deleting the entire `(default)` database now requires first explicitly disabling protection via the Console or `gcloud firestore databases update --delete-protection=DISABLED`, then deleting — a deliberate two-step action, not an accidental one.

## 6. Corrupted customer content / lost media

- **Website content**: every field change is recorded as an immutable revision (`organizations/{orgId}/websites/{websiteId}/contentRevisions`) before being applied — the existing in-app "Rollback" action in the Website Content Editor restores a prior published snapshot without needing any infrastructure-level restore.
- **Media (Cloud Storage)**: no object versioning is enabled yet (see §9) — an overwritten or deleted media file is **not currently recoverable**. Until Storage versioning is enabled, treat media uploads as append-only in practice (avoid overwriting a file path with different content) where possible.

## 7. Lost access to a customer's portal account

Not a data-loss scenario — the customer's project data is untouched. Fix: Owner reissues portal access from `/master/customer` (disable + create a new invitation), which the existing UI already supports.

## 8. Owner/account access recovery

**8a. Re-authenticate the Firebase CLI** (needed after a new machine or an expired session):
```bash
cd pageloom-os
node_modules\.bin\firebase.cmd login
```
Opens a browser for Google sign-in — use `pageloom.studio@gmail.com` (primary). If that account is unavailable, sign in with `iantebi5@gmail.com` instead (see §8c); both hold identical Firebase project Owner access.

**8b. Re-establish gcloud Application Default Credentials** (needed for any Admin SDK script run outside the Functions emulator, and for direct Firestore/Cloud API access):
```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project pageloom-os-production
```

**8c. Lost the primary Owner Google account (`pageloom.studio@gmail.com`)**: no longer a single point of failure — `iantebi5@gmail.com` is a second, independently-provisioned platform Owner account (own Firebase Auth UID, own `platformRole: owner` claim, own active `systemAdministrators` entry, own org membership with full permissions), kept specifically as a break-glass fallback rather than for routine use. If `pageloom.studio@gmail.com` is ever lost, sign in with `iantebi5@gmail.com` instead — no recovery flow needed, it already has full, working Owner access today. Google Account recovery is only needed in the (much less likely) event that *both* accounts are lost simultaneously. If a *third*, rarely-used break-glass account is ever wanted in addition to these two, provision it the same way via `functions/scripts/provision-platform-owner.mjs`.

## 9. Open backup decisions (not yet resolved)

As of 2026-08-29, verified directly against the live project:
- Firestore **Point-in-Time Recovery: disabled**. Enabling it adds ongoing storage cost proportional to write volume (Google bills PITR storage separately from normal document storage).
- Cloud Storage **Object Versioning: disabled**, no lifecycle policy. Enabling it adds ongoing storage cost for retained noncurrent object versions.
- Firestore **delete protection: enabled** (free, no cost — done).
- GitHub is the verified, working backup for source code (`origin/main` confirmed in sync).

Both cost-bearing items require an explicit owner decision on budget before enabling (see the accompanying report for the exact commands and cost model). This runbook should be updated once that decision is made, with the actual restore commands for whichever mechanism is chosen (`gcloud firestore backups restore` for scheduled exports, or the PITR restore-to-timestamp flow).

## 10. Restore verification policy

Never run a real restore against production merely to test this runbook. To verify a backup mechanism actually works once enabled, restore into a **separate, temporary Firestore database or GCP project**, confirm the data is intact and readable there, then delete the temporary target. Production is only ever the *source* of a verification restore, never the *destination*, outside of a genuine incident.
