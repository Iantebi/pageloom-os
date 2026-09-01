# Customer Journey — Website Brief Questionnaire

The Website Brief is **not** a new content system. It is a fixed, predefined list of
`questionnaireFieldSchema` fields (`packages/core/src/website-brief.ts`) auto-created
via the existing generic questionnaire mechanism
(`createQuestionnaireSchema` → `POST /projects/:id/questionnaires`) the moment Owner
confirms payment. The customer fills it out in the existing Customer Portal
questionnaire UI (`apps/web/src/app/(product)/portal/page.tsx`'s
`CustomerQuestionnaire`/`QuestionnaireForm`) — no new form UI was built for this.

## Field list

| Field id | Type | Required | Notes |
|---|---|---|---|
| `businessName` | short_text | ✓ | |
| `businessPhone` | phone | ✓ | |
| `businessEmail` | email | ✓ | |
| `businessAddress` | short_text | | |
| `websiteGoal` | long_text | ✓ | main goal of the website |
| `targetAudience` | long_text | ✓ | |
| `services` | long_text | ✓ | one service/product per line |
| `businessDescription` | long_text | ✓ | |
| `advantages` | long_text | | what makes the business different |
| `testimonials` | long_text | | pasted testimonials, one per line |
| `faqs` | long_text | | questions and answers, one per line |
| `brandingNotes` | long_text | | desired style/feel |
| `brandColors` | short_text | | hex codes if known |
| `logo` | file | | |
| `inspirationSites` | long_text | | links, one per line |
| `introPhoto` | file | | bulk photos go through Materials instead |
| `introVideo` | url | | |
| `socialLinks` | long_text | | links, one per line |
| `googleBusinessUrl` | url | | |
| `whatsappNumber` | phone | | |
| `existingDomain` | short_text | | |
| `existingWebsiteUrl` | url | | |
| `additionalNotes` | long_text | | |

## Why these types

`questionnaireFieldSchema` supports `short_text | long_text | email | phone | url |
select | multi_select | boolean | file`. It does **not** have true repeater/array
types (unlike the separate, richer `website-content.ts` field system used for the
*live* published site, which has `services`/`testimonials`/`faq` as structured
arrays). Rather than inventing a new field-type system for the brief, sections that
are conceptually "a list of things" (services, testimonials, FAQs, inspiration sites,
social links) are collected as a single `long_text` field with `helpText` instructing
"one per line" — a deliberate reuse trade-off, not an oversight. If a richer, editable
version of this data is later needed, it already exists downstream in
`website-content.ts`'s field system once the site is live.

## Draft / save-and-continue / secure uploads

All for free, from the existing questionnaire mechanism:

- **Save draft, continue later**: the existing `Questionnaire.responses` are simply
  whatever the customer has typed so far; nothing is discarded until `.../complete`
  is called.
- **Upload media securely**: file-type fields already upload to
  `organizations/{orgId}/questionnaires/{projectId}/{questionnaireId}/{fieldId}/{userId}/…`,
  already covered by the existing `storage.rules` tenant-isolation rule for that exact
  path — no rule changes were needed for this feature.
- **Submit final brief**: the existing
  `POST /projects/:id/questionnaires/:id/complete` endpoint, unchanged.
