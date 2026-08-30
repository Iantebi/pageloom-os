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

- **Single document/collection accidentally deleted**: recoverable only if Point-in-Time Recovery (PITR) is enabled (see the open decision in §9 — **not yet enabled at the time of writing**) or from the most recent scheduled export (see the restore procedure below). Without either, a client-level accidental delete is **not recoverable** — Firestore rules already block all direct client writes (`allow write: if false` everywhere), so this specific risk is mitigated architecturally: only server-side Cloud Functions code can delete anything, and a grep of `functions/src` for `.delete()` calls should be re-run periodically to confirm no route allows an unscoped/bulk delete without strong authorization.
- **Whole database accidentally deleted**: Firestore delete protection is **enabled** (confirmed 2026-08-29) — deleting the entire `(default)` database now requires first explicitly disabling protection via the Console or `gcloud firestore databases update --delete-protection=DISABLED`, then deleting — a deliberate two-step action, not an accidental one.

**Firestore restore procedure** (works today, does not depend on PITR being enabled): a full daily export already exists in `gs://pageloom-os-production-backups/firestore/{YYYY-MM-DD}/` for every day going back to 2026-08-12 (auto-deleted after 90 days — see §9). To restore:
```bash
# Never restore directly into the live production database - see §10. Restore into a fresh,
# temporary database first, verify the data, then decide how to reconcile it back into production.
gcloud firestore import gs://pageloom-os-production-backups/firestore/<YYYY-MM-DD> \
  --database=<temporary-database-id> \
  --project=pageloom-os-production
```
Google Cloud Console → Firestore → Import/Export offers the same operation without the CLI. A full-database import only restores documents present in that day's export snapshot — any writes made *after* that export ran are not recoverable without PITR (see §9 for that tradeoff), so the more recent the incident is noticed, the more same-day data loss a restore-from-export accepts.

## 6. Corrupted customer content / lost media

- **Website content**: every field change is recorded as an immutable revision (`organizations/{orgId}/websites/{websiteId}/contentRevisions`) before being applied — the existing in-app "Rollback" action in the Website Content Editor restores a prior published snapshot without needing any infrastructure-level restore.
- **Media (Cloud Storage)**: no object versioning is enabled yet (see §9) — an overwritten or deleted media file is **not currently recoverable** today. Until Storage versioning is enabled, treat media uploads as append-only in practice (avoid overwriting a file path with different content) where possible.

**Proposed Storage backup design** (not yet implemented — requires an explicit go-ahead, see §9 for cost):
1. Enable **Object Versioning** on `pageloom-os-production.firebasestorage.app` — Google keeps prior versions of an object when it's overwritten or deleted, restorable via `gsutil cp gs://bucket/object#<generation> gs://bucket/object` or the Console's "Manage versions" view. This is the direct, minimal fix for "overwritten/deleted media is unrecoverable."
2. Pair it with a **lifecycle rule** that expires noncurrent versions after a bounded window (e.g. 30–90 days, mirroring the existing Firestore backup bucket's 90-day rule in §9), so versioning doesn't accumulate storage cost indefinitely.
3. Customer uploads currently go through `safeUpload()`/`safeWebsiteMedia()` in `storage.rules`, which already caps file size and content-type — versioning cost scales with how often files are *overwritten*, not just uploaded, and PageLoom's current usage pattern (mostly new uploads, infrequent overwrites of the same path) should keep the added cost modest, but the actual amount depends on real customer usage once onboarding starts (see Mission 6 in the accompanying report).

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

## 9. Backup inventory, retention, and open decisions

**What's backed up today, where, how often, and for how long:**

| What | Where | Frequency | Retention |
|---|---|---|---|
| Firestore (all data) | `gs://pageloom-os-production-backups/firestore/{date}/` | Daily, `30 2 * * *` agency-timezone via `dailyFirestoreBackup` | 90 days (bucket lifecycle rule, auto-delete; bucket has Object Versioning enabled) |
| Source code + all config (`firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, Functions/web source) | GitHub `origin/main` | Every commit | Indefinite (full git history) |
| Website content | Firestore `contentRevisions` subcollection | Every edit | Indefinite (no pruning implemented) |
| Cloud Storage / customer media | **Not backed up** | — | — (see the proposed design in §6) |
| `.env.pageloom-os-production`, Secret Manager values | Not separately backed up — recreated from source if lost | — | — |

**Verified 2026-08-30**: 19 consecutive daily Firestore export folders present with no gaps (2026-08-12 through 2026-08-30), each containing complete, non-empty export data.

**Historical reliability note (2026-08-30 investigation)**: Cloud Scheduler was observed retrying `dailyFirestoreBackup` and `monitorBusinessRisks` far more aggressively than their configured `retryCount:3`, producing misleading error-level log entries even on days the backup had already succeeded. Root-caused and fixed at the code level (not yet deployed — see the accompanying report): `monitorBusinessRisks` was silently exceeding its default 256MiB memory allocation (bumped to 512MiB); `dailyFirestoreBackup` now records a duplicate "already exists" retry as `already_completed` instead of throwing a failure. Backup data integrity was never actually at risk — every affected day still has a complete, valid export.

**How failures are currently detected: manually only.** There is no automated alerting on this project today — Cloud Monitoring has zero notification channels and zero alert policies configured (verified 2026-08-30). The only way to learn of a backup or scheduler failure right now is to check Cloud Logging directly, exactly as this investigation did. Recommended (not yet implemented, requires approval — see the accompanying report's cost model, though these specific features are free): a Cloud Monitoring alert policy on `dailyFirestoreBackup`'s error rate, and Essential Contacts entries for `pageloom.studio@gmail.com` (+ `iantebi5@gmail.com` fallback) so a real failure reaches a human without anyone needing to remember to check.

**Remaining open decisions**, both cost-bearing, both require an explicit owner decision before enabling:
- Firestore **Point-in-Time Recovery: disabled**. Adds ongoing storage cost proportional to write volume (Google bills PITR storage separately from normal document storage). Enabling it would let a restore target any point in the last 1–7 days, not just the most recent daily export.
- Cloud Storage **Object Versioning for customer media: disabled** (design proposed in §6). Adds ongoing storage cost for retained noncurrent object versions, bounded by a lifecycle rule once enabled.

Firestore **delete protection: enabled** (free, no cost — done). GitHub is the verified, working backup for source code (`origin/main` confirmed in sync).

## 10. Restore verification policy

Never run a real restore against production merely to test this runbook. To verify a backup mechanism actually works, restore into a **separate, temporary Firestore database or GCP project**, confirm the data is intact and readable there, then delete the temporary target. Production is only ever the *source* of a verification restore, never the *destination*, outside of a genuine incident.

**Recommended cadence**: perform one verification restore (per §5's restore procedure, into a temporary database) at least quarterly, and immediately after any change to the backup mechanism itself (e.g., the reliability fixes above, or if PITR/Storage versioning is later enabled) — a backup that has never been test-restored is unverified by definition.

## 11. Complete PageLoom recovery (worst case: everything is gone)

In order, assuming total loss of the laptop, both Owner accounts, and needing to rebuild from nothing but this GitHub repository and Google Account recovery:
1. Recover access to `pageloom.studio@gmail.com` or `iantebi5@gmail.com` via Google's own account-recovery flow (§8c) — at least one must be regained; there is no recovery path if both are permanently and simultaneously lost, since platform Owner status is keyed to these two Firebase Auth accounts.
2. Set up a new machine (§2): clone the repo, `npm install`, re-authenticate Firebase CLI + gcloud ADC (§8a/§8b).
3. Confirm the production Firebase project (`pageloom-os-production`) itself still exists and is intact — Firestore data, Cloud Storage buckets, and Cloud Functions are Google-side resources independent of any local machine or lost account, so this step should normally be a no-op unless the *project itself* was somehow also destroyed (not covered by this runbook — that scenario requires Google Cloud support).
4. If Firestore data is intact: nothing to restore, proceed to step 5. If Firestore data was lost/corrupted: follow §5's restore procedure from the most recent daily export.
5. Redeploy Functions, Hosting, and Rules from the current `main` branch (`npm run build && firebase deploy --only functions`, then `npm run deploy:hosting`, then `firebase deploy --only firestore:rules,storage` — always the safe deploy paths documented in `CLAUDE.md`, never a bare `firebase deploy --only hosting`).
6. Verify: sign in as the recovered Owner account, confirm `/master` loads, confirm a real customer portal loads, confirm a support ticket and content edit both work end-to-end before considering recovery complete.
