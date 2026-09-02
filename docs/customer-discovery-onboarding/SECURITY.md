# Business Discovery — Security

Companion to [`PRD.md`](./PRD.md) and [`DATA-MODEL.md`](./DATA-MODEL.md). Written to the
repository's own `CLAUDE.md`-level standard: security is enforced server-side and in
Firestore/Storage rules, never by UI hiding alone.

## 1. Threat model

| Asset | Threat | Mitigation |
|---|---|---|
| A customer's Discovery answers (business facts, financials-adjacent info, trust/social proof material) | Cross-tenant read (Customer A reads Customer B's project) | `clientProject(orgId, projectId)` rule check on every collection, identical to existing `questionnaires`/`revisionRequests` pattern (§3) |
| Internal staff notes on a Discovery section | Customer reads staff notes | `discoveryNotes` is a wholly separate collection with a staff-only rule — never a field on a client-readable document (§3.3) |
| Uploaded files (logo, photos, testimonial screenshots, price lists) | Cross-tenant read, unauthorized write, oversized/malicious upload | Storage path scoped to `{orgId}/{projectId}`, `safeUpload()`/`safeUploadShape()` size+MIME allowlist reused verbatim, same-uid write constraint (§5) |
| Discovery submission state (`discoveryProgress`) | Client forges `status: "submitted"` or `completedSectionIds` to skip validation | Client writes are `allow write: if false` everywhere; only `discovery-api.ts` (Admin SDK, server-side `missingRequiredDiscoveryFields` check) can transition status (§4) |
| Notification content | Customer reads an owner-audience notification, or vice versa | Reuses the existing `notifications` collection's staff-only rule and existing audience-filtering convention; no change to that rule (§6) |
| Analytics / logs | Questionnaire answer content leaking into logs, exception messages, or analytics events | `PRD.md` §31 — event names + ids only, never `responses` content; server error responses never include field values (§7) |

## 2. Tenant isolation — how every new endpoint is checked

Every `discovery-api.ts` route calls `requireProjectAccess(req, res, organizationId,
projectId, roles)` before touching Firestore, exactly like `onboarding-journey-api.ts`'s
existing routes. For a `client` member this transitively enforces: `member.customerId ===
project.customerId`, and (if the member has a non-empty `projectIds` allowlist) `projectId
∈ member.projectIds`. **The client never supplies `organizationId`/`projectId` as a trust
boundary** — they're path/body parameters validated against the server-resolved member
record on every single request, never assumed valid from a prior request or from the URL
alone.

## 3. Firestore rules — exact blocks to add to `firestore.rules`

Placed alongside the existing `questionnaires`/`revisionRequests`/`launchChecklist`/
`handover` blocks (same `match /organizations/{orgId}/projects/{projectId}/...` scope),
reusing the file's existing helper functions without modification.

### 3.1 `discovery/{sectionId}` — staff + assigned client, read-only

```
match /discovery/{sectionId} {
  allow read: if staff(orgId) || clientProject(orgId, projectId);
  allow write: if false;
}
```

Matches the `questionnaires`/`revisionRequests`/`handover` precedent exactly — customer
needs to read their own in-progress answers to resume; nothing here needs the
list-safe `resource.data` variant since the client always reads by known section id
(`get()`, never a collection `list()` query, per `DATA-MODEL.md` §5).

### 3.2 `discoveryProgress/{docId}` — staff + assigned client

```
match /discoveryProgress/{docId} {
  allow read: if staff(orgId) || clientProject(orgId, projectId);
  allow write: if false;
}
```

### 3.3 `discoveryNotes/{noteId}` — staff only, no client clause, ever

```
match /discoveryNotes/{noteId} {
  allow read: if staff(orgId);
  allow write: if false;
}
```

This is the load-bearing rule for "customer must never see internal notes" — deliberately
has **no** `|| clientProject(...)` clause, unlike every other Discovery collection. A
reviewer checking this PRD's implementation should treat any future PR that adds a
client-read clause to this specific match block as a regression requiring explicit
product sign-off, not a routine change.

### 3.4 `businessProfile/{docId}` — staff only at launch

```
match /businessProfile/{docId} {
  allow read: if staff(orgId);
  allow write: if false;
}
```

Staff-only for now because the document is unpopulated (§`DATA-MODEL.md` §4) and its
eventual content (AI-derived positioning/recommendations) is explicitly the kind of
"internal AI analysis" the mission says customers should not see unless intentionally
exposed. Revisit this rule only alongside the future AI-synthesis feature's own PRD.

## 4. API-level authorization matrix

| Route | Method | Roles | Notes |
|---|---|---|---|
| `/projects/:id/discovery` | GET | staff broad + `client` (own project) | Resolves template + all section docs + progress in one read |
| `/projects/:id/discovery/sections/:sectionId` | PATCH | staff (owner/admin/operator/member) + `client` (own project) | Autosave; upserts the section doc |
| `/projects/:id/discovery/sections/:sectionId/complete` | POST | same as PATCH | Server-side `missingRequiredDiscoveryFields` check; 422 with the exact missing question ids if incomplete |
| `/projects/:id/discovery/submit` | POST | staff broad + `client` | Validates all 9 sections; emits `QuestionnaireCompleted`; writes `discovery_submitted` notification |
| `/projects/:id/discovery/sections/:sectionId/reopen` | POST | owner/admin/operator only | Requires a `reason` string (shown to customer); writes `discovery_information_requested` notification |
| `/projects/:id/discovery/notes` | POST | owner/admin/operator only | Writes to `discoveryNotes`; never accepts a customer-authenticated request even if project-scoped correctly (role check alone, no client bypass) |
| `/organizations/:id/onboarding-overview` (extended) | GET | staff broad (existing route, existing role set) | Adds `discoveryStatus`/`discoveryPercent`/`discoverySubmittedAt` fields only |

No route accepts `client` role for the `reopen`/`notes` endpoints even if
`requireProjectAccess` would technically resolve them as project-authorized — the role
array passed to `requireRole`/`requireProjectAccess` for those two routes deliberately
excludes `client`, matching how `onboarding-journey-api.ts`'s launch-checklist mutation
route excludes it today.

## 5. Storage rules — exact block to add to `storage.rules`

```
match /organizations/{orgId}/discovery/{projectId}/{sectionId}/{fieldId}/{userId}/{allPaths=**} {
  allow read: if staff(orgId) || clientProject(orgId, projectId);
  allow write: if safeUpload(orgId, userId) && clientProject(orgId, projectId);
}
```

Directly mirrors the existing `questionnaires/{projectId}/{questionnaireId}/{fieldId}/
{userId}/...` block, with `sectionId` in place of `questionnaireId`. Reuses
`safeUpload()`'s existing same-uid + `safeUploadShape()` (25MB ceiling,
image/pdf/text/zip/vnd.* content-type allowlist) global guard — Discovery's own
per-question limits (§`PRD.md` §14: 10MB images/PDFs) are enforced **client-side before
upload** as a UX courtesy (fail fast, clear message) and **can additionally be tightened
at the rule level** with a Discovery-specific `safeDiscoveryUpload()` helper if staff
wants a hard 10MB server-side ceiling rather than inheriting the global 25MB one —
recommended for Phase 5, not strictly required for correctness since the global ceiling
already bounds worst-case abuse.

No rule change is needed for the existing `questionnaires/...` or `uploads/...` prefixes
— both stay exactly as they are for the Website Brief path and the loose
`uploads/{userId}/{projectId}/` "materials" upload (which itself is flagged as a
pre-existing loose end in `DATA-MODEL.md`'s sibling audit, not something Discovery
introduces or is responsible for fixing).

## 6. Notifications — no rule change

`notifications` stays staff-only-readable in `firestore.rules` (existing rule, unchanged)
— this is consistent with every other notification type today, not a Discovery-specific
gap. If a future feature wants a true customer-facing live notification feed (as opposed
to today's polling/API-mediated access), that is a cross-cutting change out of this
PRD's scope (flagged, not solved, by the underlying audit).

## 7. Audit / activity events

Appended to the existing organization-wide `activity` collection (same collection every
other router writes to — see `functions/src/api.ts`'s existing `activity.add()` call
sites for the exact shape to match):

```ts
{
  eventType: "discovery_started" | "discovery_section_completed" | "discovery_submitted"
    | "discovery_section_reopened" | "discovery_note_added",
  actorUserId: string,
  actorRole: string,
  organizationId: string,
  projectId: string,
  targetType: "discoverySection" | "discoveryProgress" | "discoveryNote",
  targetId: string,
  timestamp: string,           // server timestamp
  metadata: { sectionId?: DiscoverySectionId },   // NEVER responses content
}
```

**Mandatory constraint, restated from `PRD.md` §31**: `metadata` never includes
`responses`, a raw answer, or a file name that could contain personal data (e.g. a
customer might name an uploaded file after a client's name). This matches the mission's
explicit "do not store full questionnaire content in logs/analytics/audit metadata."

## 8. Soft delete / archive — Discovery-specific application of the platform-wide policy

**Correction (post-audit)**: an earlier version of this section said a project could be
"archived" via an "existing project-level archive mechanism." A dedicated audit of the
whole codebase found **no such mechanism exists anywhere in PageLoom today** — no
`isArchived`/`archivedAt` field, no archive/restore endpoint, and no `"archived"` value
in any status enum, for customers, projects, or any other entity. The paragraph below is
corrected to describe what is actually true.

**No permanent deletion endpoint exists for any Discovery document, full stop** —
verified by an exhaustive grep of every `functions/src/*.ts` route for `.delete()`/
`deleteDoc`/`batch.delete`/`recursiveDelete`: the only hard-delete route in the entire
API is `website-content-api.ts`'s scoped, guarded deletion of an *unused* media Storage
object (never referenced by draft/published content) — nothing ever calls `.delete()`
on a Firestore document anywhere in this codebase. This is consistent with `CLAUDE.md`'s
platform-wide "no casual one-click irreversible deletion" rule and is *stronger* than
"Owner-controlled deletion": there is no deletion path for Discovery data at all today,
by any role, through any route.

The one real precedent for "disabling" something in this codebase — a portal user's
`disabled: true` flag (`customer-admin-api.ts`) — is purely additive and non-cascading:
it flips one boolean on the member document and touches nothing else. Every other
document that member could previously read (including every Discovery collection)
remains fully intact in Firestore; it merely becomes inaccessible to *that specific
member* via the existing `staff()`/`client()` rule checks, and immediately becomes
accessible again if `disabled` is flipped back to `false`. Staff (a different role)
retain full read access throughout. This is proven directly by a behavioral emulator
test (`firestore-rules.behavioral.test.ts`, "disabling and re-enabling a client
preserves Discovery data, it only gates access") — see `TEST-PLAN.md` for the exact
assertion.

"Reopen" (`DATA-MODEL.md` §2.1) is the only state-reversal operation Discovery itself
defines, and it is additive (preserves prior `responses`), not destructive.

**Open item, explicitly not built here**: a real project/customer-level archive feature
(the kind the earlier draft of this section assumed already existed) would be a
legitimate future need, but it is a **platform-wide** concern — it would touch
customers, projects, websites, and every other project subcollection, not just
Discovery — and is exactly the kind of change `CLAUDE.md`'s safety rules say should not
be invented unilaterally inside a single feature's scope. If PageLoom wants one, it
needs its own scoped product decision (what "archived" means for a project, who can
restore it, what stays queryable) rather than being backed into here. Until then,
Discovery's actual protection is what's described above (no delete path) plus the
platform's existing backup/restore safety net (§9 below).

## 9. Backups & recovery

Business Discovery's Firestore documents are covered by the existing
`dailyFirestoreBackup` scheduled export (documented in
`docs/disaster-recovery-runbook.md` §9) with no changes needed — the export is a
whole-database daily snapshot, not per-collection configured. Uploaded Discovery files
are covered by the existing Cloud Storage Object Versioning + weekly Storage Transfer
backup job on the production bucket, also with no changes needed. This PRD does **not**
introduce a new backup mechanism and does not need one — see
`docs/disaster-recovery-runbook.md` for the authoritative, already-tested (2026-08-31
restore drill) recovery procedure. Restore testing for Discovery specifically should be
folded into that runbook's existing quarterly drill, not stood up as a separate process.

## 10. Rate limiting

`discovery-api.ts`'s mutating routes (`PATCH .../sections/:id`, `POST .../complete`,
`POST .../submit`) should use the existing `rate-limit.ts` wiring, matching how
`POST /customers/:customerId/invitations` and `POST /support-tickets` are already
rate-limited — autosave in particular is a legitimate high-frequency route (debounced to
~1 request per 1.5s of active typing per user) and needs a per-user limit generous enough
not to trip during normal use but tight enough to bound abuse (e.g. a compromised or
scripted client hammering the endpoint). Exact threshold is an implementation-time
tuning decision, not a product decision — default to the same order of magnitude as the
existing `rate-limit.ts` defaults used elsewhere in the file.

## 11. Definition of done — security

Matches `PRD.md` §37 verbatim for the security-specific subset: new rules pass the
existing `firestore-rules.behavioral.test.ts`/`storage-rules.behavioral.test.ts` emulator
suites (extended with new fixtures, not new files); a rules test explicitly proves
`discoveryNotes` is unreadable by a `client`-role test identity; a rules test explicitly
proves Customer A cannot read Customer B's `discovery/*` documents; no secret, credential,
or raw questionnaire content appears in any activity/log/analytics write path.
