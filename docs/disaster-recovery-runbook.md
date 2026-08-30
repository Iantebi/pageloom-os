# PageLoom OS — Disaster Recovery Runbook

Firebase project: `pageloom-os-production`. This runbook assumes the reader has (or can regain) the Google account `iantebi5@gmail.com`, which is both the Firebase project owner and the PageLoom platform Owner (`platformRole: owner`).

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
Then re-establish credentials — see §8 (Firebase CLI login) and §8b (gcloud ADC), both interactive one-time browser sign-ins with the same Google account. No secrets need to be manually copied; `functions/.env.pageloom-os-production` and Secret Manager values are pulled by the CLI/emulator once authenticated.

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
Opens a browser for Google sign-in with `iantebi5@gmail.com`.

**8b. Re-establish gcloud Application Default Credentials** (needed for any Admin SDK script run outside the Functions emulator, and for direct Firestore/Cloud API access):
```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project pageloom-os-production
```

**8c. Lost the Owner Google account itself**: this is the actual single point of failure in the current design — `platformRole: owner` and the `systemAdministrators` registry both key off one Firebase Auth UID tied to one Google account. If that account is permanently lost, recovery requires Google Account recovery for `iantebi5@gmail.com` (Google's own account-recovery flow) — there is currently no second platform-owner account provisioned as a break-glass fallback. **Recommendation**: consider provisioning a second, rarely-used Owner account via `functions/scripts/provision-platform-owner.mjs` purely as a break-glass credential, stored securely offline.

## 9. Open backup decisions (not yet resolved)

As of 2026-08-29, verified directly against the live project:
- Firestore **Point-in-Time Recovery: disabled**. Enabling it adds ongoing storage cost proportional to write volume (Google bills PITR storage separately from normal document storage).
- Cloud Storage **Object Versioning: disabled**, no lifecycle policy. Enabling it adds ongoing storage cost for retained noncurrent object versions.
- Firestore **delete protection: enabled** (free, no cost — done).
- GitHub is the verified, working backup for source code (`origin/main` confirmed in sync).

Both cost-bearing items require an explicit owner decision on budget before enabling (see the accompanying report for the exact commands and cost model). This runbook should be updated once that decision is made, with the actual restore commands for whichever mechanism is chosen (`gcloud firestore backups restore` for scheduled exports, or the PITR restore-to-timestamp flow).

## 10. Restore verification policy

Never run a real restore against production merely to test this runbook. To verify a backup mechanism actually works once enabled, restore into a **separate, temporary Firestore database or GCP project**, confirm the data is intact and readable there, then delete the temporary target. Production is only ever the *source* of a verification restore, never the *destination*, outside of a genuine incident.
