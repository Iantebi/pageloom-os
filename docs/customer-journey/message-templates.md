# Customer Journey — Message Templates

No real WhatsApp, SMS, or email is sent by this feature. Every template below renders
inside the existing in-app notification inbox
(`apps/web/src/components/notification-inbox.tsx`), formatted by
`apps/web/src/lib/i18n/dictionaries/notifications.ts`. This is the exact mechanism
already used for support tickets and website-content approvals — no new template
engine was built.

| Type | Hebrew | English |
|---|---|---|
| `payment_confirmed` | התשלום התקבל והפרויקט נפתח. ברוכים הבאים ל-PageLoom — יש למלא את שאלון האתר כדי להתחיל | Payment received and your project is open. Welcome to PageLoom — please complete your Website Brief to get started |
| `website_brief_received` | שאלון האתר עבור {project} התקבל | Website Brief received for {project} |
| `materials_missing` | חסרים {n} פרטים/קבצים להשלמת שאלון האתר | {n} item(s) are still missing to complete the Website Brief |
| `build_started` | התחלנו לבנות את האתר עבור {project} | We've started building the website for {project} |
| `preview_ready`* | תצוגה מקדימה של האתר {project} מוכנה לבדיקה | A preview of {project} is ready for review |
| `revision_received` | התקבלה בקשת שינוי חדשה ({area}) | A new revision request was received ({area}) |
| `revision_resolved` | בקשת השינוי שלכם טופלה | Your revision request was resolved |
| `final_approval_recorded` | האישור הסופי לאתר {project} נרשם | Final approval for {project} was recorded |
| `website_live` | האתר שלכם עלה לאוויר: {liveUrl} | Your website is live: {liveUrl} |
| `post_launch_follow_up`* | בדיקת מעקב לאחר ההשקה עבור {project} | Post-launch follow-up for {project} |

\* Template defined and ready; producer not yet wired — see `automation-events.md`
for why.

## Extending this later (real channels)

When/if real WhatsApp/SMS/email sending is approved, the integration point is
narrow: each notification document already carries a structured `{type, params}`
payload (see the table above), so a future sender just needs to read the same
`organizations/{orgId}/notifications` collection and format each type — the
formatting logic already exists in `notifications.ts` and would not need to be
rewritten, only reused from a different (server-side) context.
