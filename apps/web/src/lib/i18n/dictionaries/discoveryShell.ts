// Shell/chrome copy for the Business Discovery flow — the stepper, autosave status words, task
// card, review screen, and completion screen. Question-specific copy lives in
// ./discoveryQuestions.ts; this file is everything around the questions.

const he = {
  // Dashboard / portal task card
  taskCardTitle: "אנחנו צריכים להכיר את העסק שלכם",
  taskCardBody: "כדי שנוכל לבנות פתרון שמדבר ללקוחות הנכונים ומציג את העסק בצורה הטובה ביותר.",
  taskCardCta: "התחילו את אפיון העסק",
  taskCardContinueCta: "המשיכו את אפיון העסק",
  taskCardProgress: (completed: number) => `הושלמו ${completed} מתוך 9 שלבים`,
  taskCardSubmitted: "אפיון העסק נשלח — אנחנו בודקים את הפרטים",
  taskCardReopened: "יש לעדכן כמה פרטים לפני שנמשיך",
  taskCardReopenedCta: "השלימו את הפרטים החסרים",

  // Shell chrome
  brandName: "PageLoom",
  backToProjectCenter: "חזרה למרכז הפרויקט",
  stepLabel: (index: number, total: number) => `שלב ${index} מתוך ${total}`,
  percentComplete: (percent: number) => `${percent}% הושלם`,
  stagesMenuLabel: "שלבים",
  previous: "הקודם",
  next: "הבא",
  finishSection: "השלימו שלב זה",
  reviewAndSubmit: "סקירה ושליחה",

  // Autosave status
  savingStatus: "שומר…",
  savedStatus: "נשמר",
  savedJustNow: "לפני רגע",
  saveErrorStatus: "שגיאה בשמירה — נסו שוב",
  retry: "נסו שוב",

  // "Why we ask"
  whyWeAskToggle: "למה אנחנו שואלים?",

  // Validation
  missingRequiredTitle: (count: number) => `נותרו ${count} שדות חובה למילוי בשלב זה`,

  // Review screen
  reviewTitle: "סקירת התשובות שלכם",
  reviewDescription: "בדקו הכול לפני השליחה. אפשר לחזור ולערוך כל שלב.",
  reviewEdit: "עריכה",
  reviewNotApplicable: "לא רלוונטי",
  reviewEmpty: "טרם מולא",
  submitDiscovery: "שליחת אפיון העסק",
  submitting: "שולח…",
  submitError: "לא הצלחנו לשלוח את אפיון העסק. נסו שוב.",

  // Completion screen
  completionTitle: "סיימתם את אפיון העסק",
  completionBody: "קיבלנו את כל המידע הדרוש כדי להתחיל לנתח את העסק ולבנות את הכיוון לפרויקט שלכם.",
  completionSectionsTitle: "השלבים שהושלמו",
  completionBackCta: "חזרה למרכז הפרויקט",

  // "Needs more info" banner
  needsMoreInfoTitle: "דרוש מידע נוסף",
  needsMoreInfoCta: "עברו לשלב",

  // Errors
  loadError: "לא הצלחנו לטעון את אפיון העסק. רעננו את הדף ונסו שוב.",
  networkOffline: "אין חיבור לאינטרנט כרגע. התשובות שלכם נשמרות איתכם ברגע שהחיבור יחזור.",
  sessionExpired: "החיבור פג. יש להתחבר מחדש כדי להמשיך.",
  permissionDenied: "אין לכם גישה לפרויקט הזה.",

  // Multi-select / repeater controls
  yesLabel: "כן", noLabel: "לא",
  addItem: "הוספה", removeItem: "הסרה",
  uploadFile: "בחרו קובץ", uploading: (percent: number) => `מעלה… ${percent}%`, uploadFailed: "ההעלאה נכשלה", uploadRetry: "נסו שוב", uploadRemove: "הסרה",
  uploadTooLarge: "הקובץ גדול מדי — עד 10MB", uploadWrongType: "סוג קובץ לא נתמך — JPG, PNG או PDF",
  addressLine1: "כתובת", addressCity: "עיר", addressServiceAreas: "אזורי שירות (לא חובה)",
} as const;

const en = {
  taskCardTitle: "We need to get to know your business",
  taskCardBody: "So we can build a solution that speaks to the right customers and presents your business at its best.",
  taskCardCta: "Start Business Discovery",
  taskCardContinueCta: "Continue Business Discovery",
  taskCardProgress: (completed: number) => `${completed} of 9 stages completed`,
  taskCardSubmitted: "Business Discovery submitted — we're reviewing the details",
  taskCardReopened: "A few details need updating before we continue",
  taskCardReopenedCta: "Complete the missing details",

  brandName: "PageLoom",
  backToProjectCenter: "Back to project center",
  stepLabel: (index: number, total: number) => `Step ${index} of ${total}`,
  percentComplete: (percent: number) => `${percent}% complete`,
  stagesMenuLabel: "Stages",
  previous: "Previous",
  next: "Next",
  finishSection: "Complete this stage",
  reviewAndSubmit: "Review & submit",

  savingStatus: "Saving…",
  savedStatus: "Saved",
  savedJustNow: "just now",
  saveErrorStatus: "Save failed — try again",
  retry: "Try again",

  whyWeAskToggle: "Why do we ask?",

  missingRequiredTitle: (count: number) => `${count} required field(s) remaining in this stage`,

  reviewTitle: "Review your answers",
  reviewDescription: "Check everything before submitting. You can go back and edit any stage.",
  reviewEdit: "Edit",
  reviewNotApplicable: "Not applicable",
  reviewEmpty: "Not yet answered",
  submitDiscovery: "Submit Business Discovery",
  submitting: "Submitting…",
  submitError: "We couldn't submit your Business Discovery. Please try again.",

  completionTitle: "You've finished Business Discovery",
  completionBody: "We've received everything we need to start analyzing your business and shaping the direction for your project.",
  completionSectionsTitle: "Completed stages",
  completionBackCta: "Back to project center",

  needsMoreInfoTitle: "More information needed",
  needsMoreInfoCta: "Go to stage",

  loadError: "We couldn't load Business Discovery. Refresh the page and try again.",
  networkOffline: "No internet connection right now. Your answers are kept locally until the connection returns.",
  sessionExpired: "Your session expired. Please sign in again to continue.",
  permissionDenied: "You don't have access to this project.",

  yesLabel: "Yes", noLabel: "No",
  addItem: "Add", removeItem: "Remove",
  uploadFile: "Choose a file", uploading: (percent: number) => `Uploading… ${percent}%`, uploadFailed: "Upload failed", uploadRetry: "Try again", uploadRemove: "Remove",
  uploadTooLarge: "File is too large — up to 10MB", uploadWrongType: "Unsupported file type — JPG, PNG, or PDF",
  addressLine1: "Address", addressCity: "City", addressServiceAreas: "Service areas (optional)",
} as const;

export const discoveryShell = { he, en } as const;
