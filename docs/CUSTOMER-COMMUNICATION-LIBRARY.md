# Customer communication library

Owner: Sales/CX · Locale: `he` / `rtl` throughout, matching every existing customer-facing artifact. All content below is a **draft**. Per `ISRAEL-LOCALIZATION.md`: *"Template rendering does not send a message. Existing authorization policy still requires owner approval before any external email or WhatsApp transmission."* Nothing here is wired to send automatically, and none of it should be, per the standing "no AI selling" / human-first sales policy (`workflows/customer-journey.v1.json`).

## Already exists — do not recreate

Five templates already ship in `packages/core/src/israel-localization.ts` (`renderCustomerMessage`), each with an email subject+body and a WhatsApp variant, `{name}`/`{link}` placeholders, and a "צוות PageLoom" sign-off: **`onboarding_started`, `questionnaire_ready`, `approval_required`, `revision_received`, `website_published`**. These cover Questionnaire invitation, final Website launch/approval, and Revision-request acknowledgment from the requested list. They are not repeated below.

## Format and voice, matched to the existing five

- Greeting: `שלום {שם},`
- Short paragraphs, plain Hebrew, no jargon, no exclamation-mark overuse (existing set uses at most one, for genuinely good news).
- Sign-off: `צוות PageLoom` (kept consistent with the existing five — see Phase 3 of the sprint report for the named-contact option as a separate owner decision, not applied here).
- Email = subject + short body. WhatsApp = one shortened paragraph, no subject. Portal = a one-line in-app status message, matching the existing tone already used in `portal/page.tsx` (e.g. "השאלון התקבל בהצלחה...").
- Every message that references a number (response time, revision rounds, backup retention) uses the figure already defined in `business-rules.ts` / `SUPPORT-PLAYBOOK.md` — never a new figure.
- Maintenance/support scope lines use bracketed placeholders `[...]` where the owner has not yet finalized public wording — do not fill these in without that approval.

---

## 1. Lead follow-up

**Email**
Subject: `תודה שפניתם ל-PageLoom`
Body: `שלום {שם},\n\nתודה שפניתם ל-PageLoom. קיבלנו את הפנייה שלכם ונחזור אליכם בהקדם לתיאום שיחת היכרות קצרה.\n\nצוות PageLoom`

**WhatsApp**
`שלום {שם}, תודה שפניתם ל-PageLoom. נחזור אליכם בהקדם לתיאום שיחת היכרות קצרה.`

**Portal** (n/a — pre-account stage; no portal touchpoint exists before Closed Won)

---

## 2. Discovery call scheduling

**Email**
Subject: `בואו נתאם שיחת היכרות`
Body: `שלום {שם},\n\nנשמח לשמוע על העסק והאתר שאתם מחפשים. אפשר לתאם שיחה קצרה בקישור הבא: {link}\n\nצוות PageLoom`

**WhatsApp**
`שלום {שם}, אפשר לתאם שיחת היכרות קצרה כאן: {link}`

**Portal** (n/a — pre-account stage)

---

## 3. Proposal delivery

**Email**
Subject: `ההצעה שלכם מ-PageLoom מוכנה`
Body: `שלום {שם},\n\nהיה נעים לדבר איתכם. מצורפת ההצעה שסיכמנו, כולל היקף העבודה, לוחות הזמנים וההנחות שעליהן היא מבוססת.\n\nיש שאלות? נשמח לחזור ולדבר לפני שתחליטו.\n\nצוות PageLoom`

**WhatsApp**
`שלום {שם}, ההצעה שסיכמנו מוכנה: {link}. נשמח לענות על כל שאלה.`

**Portal**
`ההצעה עבור הפרויקט זמינה לצפייה במרכז המסמכים.` *(reuses the existing `DocumentCenter` surface — no new UI implied)*

---

## 4. Contract request

**Email**
Subject: `ההסכם שלכם מוכן לחתימה`
Body: `שלום {שם},\n\nתודה שבחרתם ב-PageLoom. ההסכם מוכן לחתימה דרך פורטל הלקוחות. לאחר החתימה נתחיל מיד בשלב הבא של הפרויקט.\n\nצוות PageLoom`

**WhatsApp**
`שלום {שם}, ההסכם מוכן לחתימה בפורטל הלקוחות: {link}`

**Portal**
`ההסכם ממתין לחתימתכם.` *(the signing action itself is flagged in the sprint report as needing a UI fix, and its exact wording as legally gated — this line only announces availability)*

> **Legal caveat, repeated deliberately:** the contract's actual legal content is not owner/counsel-approved yet. This cover message announces availability only; it contains no legal terms itself.

---

## 5. Upload reminder

**Email**
Subject: `עדיין ממתינים לחומרים מכם`
Body: `שלום {שם},\n\nכדי להמשיך בקצב טוב בפרויקט, נשמח לקבל את החומרים החסרים (לוגו, תמונות, טקסטים) דרך פורטל הלקוחות. יש להעלות רק חומרים שבבעלותכם או שקיבלתם רשות להשתמש בהם.\n\nצוות PageLoom`

**WhatsApp**
`שלום {שם}, תזכורת קצרה להעלאת החומרים החסרים לפרויקט דרך הפורטל: {link}`

**Portal**
`חסרים חומרים להמשך הפרויקט. ניתן להעלות אותם כאן.`

---

## 6. Design check-in (discretionary — no formal gate exists for this in the workflow model; use only if the team wants an informal touchpoint)

**Email**
Subject: `כיוון העיצוב לפרויקט שלכם`
Body: `שלום {שם},\n\nהתחלנו לעבוד על כיוון העיצוב לאתר שלכם. נעדכן אתכם כשתהיה גרסה לצפייה ולהערות.\n\nצוות PageLoom`

**WhatsApp**
`שלום {שם}, התחלנו לעבוד על כיוון העיצוב לאתר. נעדכן כשתהיה גרסה לצפייה.`

**Portal**
`השלב הנוכחי: עיצוב.` *(already shown via the existing stage label — no new portal text required if the team skips this touchpoint)*

---

## 7. Development update

**Email**
Subject: `עדכון התקדמות מ-PageLoom`
Body: `שלום {שם},\n\nהפרויקט שלכם מתקדם. ניתן לעקוב אחר האחוז המדויק בכל רגע בפורטל הלקוחות. נעדכן שוב כשנגיע לשלב הבדיקות.\n\nצוות PageLoom`

**WhatsApp**
`שלום {שם}, עדכון קצר — הפרויקט מתקדם, אפשר לעקוב בפורטל: {link}`

**Portal** (no new line needed — the existing progress bar and percentage already serve this purpose continuously; this template is only for an optional periodic push outside the portal)

---

## 8. QA completion → review handoff

**Email**
Subject: `האתר עבר בדיקות איכות — בקרוב לבדיקתכם`
Body: `שלום {שם},\n\nהאתר עבר את שלב בדיקות האיכות הפנימי שלנו. בקרוב תקבלו הודעה שהוא מוכן לבדיקה ולאישור מצדכם.\n\nצוות PageLoom`

**WhatsApp**
`שלום {שם}, האתר עבר בדיקות איכות פנימיות. בקרוב יהיה מוכן לבדיקתכם.`

**Portal**
`בדיקות האיכות הושלמו. האתר בדרך לבדיקתכם.`

---

## 9. Delivery (handoff package — distinct from "site is live")

**Email**
Subject: `מסירת הפרויקט — כל מה שצריך לדעת`
Body: `שלום {שם},\n\nהפרויקט נמסר במלואו. בפורטל הלקוחות תמצאו את תיעוד האתר, פרטי הגישה, מלאי הקבצים והחומרים, וערוץ התמיכה לפניות עתידיות.\n\nתודה שבחרתם ב-PageLoom.\n\nצוות PageLoom`

**WhatsApp**
`שלום {שם}, הפרויקט נמסר במלואו. כל התיעוד, הגישה והחומרים זמינים בפורטל: {link}`

**Portal**
`מסמכי המסירה זמינים במרכז המסמכים.`

> Support-channel and business-hours specifics use `[ערוץ התמיכה שאושר]` / `[שעות המענה שאושרו]` placeholders until the owner finalizes them (`SUPPORT-PLAYBOOK.md`) — do not state the draft 2-hour/1-business-day figures as final customer-facing commitments before that approval.

---

## 10. Support — ticket received / resolved

**Ticket received (Portal only — matches the existing pattern in `CustomerSupport` which already computes and shows a due date)**
`הפנייה התקבלה. יעד המענה הראשוני: {due_date}.` *(already implemented verbatim in `portal/page.tsx` — shown here only for completeness of the library)*

**Resolution message (Email + Portal, new — no resolution-drafting template existed before)**
Subject: `הפנייה שלכם טופלה`
Body: `שלום {שם},\n\nהפנייה שפתחתם טופלה. סיכום הפתרון: {resolution_summary}\n\nאם הנושא עדיין פתוח מבחינתכם, פשוט השיבו להודעה זו ונמשיך לטפל בו.\n\nצוות PageLoom`

**Portal**
`הפנייה טופלה. פרטי הפתרון זמינים בכרטיס הפנייה.`

---

## 11. Maintenance reminder / renewal

**Email**
Subject: `תזכורת שירות ותחזוקה`
Body: `שלום {שם},\n\nזוהי תזכורת לגבי שירות התחזוקה לאתר שלכם. ההיקף הנוכחי כולל [היקף שירות שאושר]. לשאלות או להרחבת ההיקף, נשמח לשמוע מכם.\n\nצוות PageLoom`

**WhatsApp**
`שלום {שם}, תזכורת קצרה לגבי שירות התחזוקה לאתר. לשאלות אנחנו כאן.`

**Portal**
`סטטוס התחזוקה והחידוש הקרוב זמינים במרכז המסמכים.`

> Scope/exclusion specifics stay bracketed until the owner finalizes maintenance policy, per the same open item noted in `SUPPORT-PLAYBOOK.md`.

---

## 12. Project completion

**Email**
Subject: `הפרויקט הושלם — תודה שבחרתם ב-PageLoom`
Body: `שלום {שם},\n\nהפרויקט הושלם בהצלחה. היה לנו כבוד לעבוד איתכם. נשמח לשמוע איך הייתה החוויה — כמה דקות של משוב יעזרו לנו להשתפר.\n\nצוות PageLoom`

**WhatsApp**
`שלום {שם}, הפרויקט הושלם! נשמח לשמוע איך הייתה החוויה שלכם.`

**Portal**
`הפרויקט הושלם. תודה שבחרתם ב-PageLoom.`

> This is an **internal satisfaction question**, not a testimonial request. `FIRST-CUSTOMER-RUNBOOK.md` is explicit: *"Request a testimonial only with owner-approved external communication."* If the owner later wants to convert positive feedback into a public testimonial ask, that is a separate, explicitly approved message — not an extension of this one.

---

## Open items for the owner (not resolved by this library)

- Approve or revise the "no named contact" convention across all templates (existing five and new twelve alike).
- Finalize support channel, business hours, and maintenance scope so the bracketed placeholders above can be filled in.
- Decide a development-update cadence (weekly suggested, not mandated).
- Decide whether the discretionary "design check-in" (template 6) is used at all, since no formal design-approval gate exists in the current workflow model.
