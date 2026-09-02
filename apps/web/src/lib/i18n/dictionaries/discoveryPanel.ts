// Staff-facing Business Discovery panel copy — the Backend Master review surface. Mirrors
// onboardingJourneyPanel.ts's dictionary shape/scope.

const he = {
  title: "אפיון העסק",
  statusNotStarted: "טרם התחיל", statusInProgress: "בתהליך", statusSubmitted: "הוגש", statusReviewed: "נבדק", statusReopened: "הוחזר לעריכה",
  submittedAgo: (when: string) => `הוגש ${when}`,
  sectionCompleted: "הושלם", sectionDraft: "בתהליך", sectionNotStarted: "טרם התחיל",
  reopenAction: "פתחו מחדש", markReviewed: "סמנו כנבדק", viewFullAnswers: "הצגת תשובות מלאה", hideFullAnswers: "הסתרת תשובות",
  addNote: "הוספת הערה פנימית", notePlaceholder: "הערה פנימית — לא תוצג ללקוח…", saveNote: "שמירת הערה", noNotes: "אין הערות פנימיות עדיין",
  reopenDialogTitle: "פתיחה מחדש של שלב",
  reopenReasonLabel: "מדוע נדרש מידע נוסף?", reopenReasonPlaceholder: "לדוגמה: הלוגו שהועלה ברזולוציה נמוכה מדי",
  reopenSubmit: "שליחת בקשה ללקוח", reopenCancel: "ביטול",
  notApplicable: "לא רלוונטי", noAnswer: "ללא תשובה",
  loading: "טוען…", loadError: "לא הצלחנו לטעון את אפיון העסק",
  cancel: "ביטול",
} as const;

const en = {
  title: "Business Discovery",
  statusNotStarted: "Not started", statusInProgress: "In progress", statusSubmitted: "Submitted", statusReviewed: "Reviewed", statusReopened: "Reopened",
  submittedAgo: (when: string) => `Submitted ${when}`,
  sectionCompleted: "Completed", sectionDraft: "In progress", sectionNotStarted: "Not started",
  reopenAction: "Reopen", markReviewed: "Mark reviewed", viewFullAnswers: "View full answers", hideFullAnswers: "Hide answers",
  addNote: "Add internal note", notePlaceholder: "Internal note — never shown to the customer…", saveNote: "Save note", noNotes: "No internal notes yet",
  reopenDialogTitle: "Reopen a stage",
  reopenReasonLabel: "Why is more information needed?", reopenReasonPlaceholder: "e.g. the uploaded logo is too low-resolution",
  reopenSubmit: "Send request to customer", reopenCancel: "Cancel",
  notApplicable: "Not applicable", noAnswer: "No answer",
  loading: "Loading…", loadError: "We couldn't load Business Discovery",
  cancel: "Cancel",
} as const;

export const discoveryPanel = { he, en } as const;
