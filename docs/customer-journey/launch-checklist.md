# Customer Journey — Launch Checklist

`packages/core/src/launch-checklist.ts`. Mirrors the existing
`onboardingChecklist()` pattern in `closing-system.ts` (same
`{id, label, required, complete}` shape) so it reuses the same UI/API idioms rather
than inventing a new checklist model.

## Items

| id | Label | Required |
|---|---|---|
| `domain` | Domain connected | ✓ |
| `ssl` | SSL certificate active | ✓ |
| `forms` | Forms tested and delivering | ✓ |
| `phone` | Phone number correct and clickable | ✓ |
| `whatsapp` | WhatsApp link working | |
| `email` | Contact email correct | ✓ |
| `mobile` | Reviewed on mobile | ✓ |
| `desktop` | Reviewed on desktop | ✓ |
| `favicon` | Favicon set | |
| `seo` | Basic SEO (titles, descriptions) set | ✓ |
| `analytics` | Analytics installed (if included) | |
| `privacy` | Privacy / cookie notice in place (if applicable) | |
| `accessibility` | Basic accessibility checklist reviewed | ✓ |

## What this does — and does not — authorize

This checklist is **purely a visibility/readiness aid** for Owner. It does not itself
authorize a deployment. The existing CEO-approval gates
(`ceo_approval` and `final_deployment` workflow stages, both `approval: "ceo"`,
unchanged) remain the only thing that can move a project into production —
consistent with the mission's explicit instruction: "Do not automatically publish
without the existing authorization rules."

`GET /api/projects/:id/launch-checklist` auto-creates the checklist (all items
incomplete) the first time it's requested for a project. `PATCH
/api/projects/:id/launch-checklist/:itemId` (owner/admin/operator) toggles one item.
Read access is staff-only (`firestore.rules`) — a customer never sees the raw
checklist, matching how technical launch detail is handled elsewhere in the product.
