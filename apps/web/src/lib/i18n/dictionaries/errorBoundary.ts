export const errorBoundary = {
  he: {
    pageTitle: "משהו השתבש בטעינת הדף",
    pageDescription: "אירעה שגיאה בלתי צפויה. אפשר לנסות שוב, ואם זה חוזר על עצמו — פנו לתמיכה.",
    widgetTitle: "רכיב זה לא נטען",
    widgetDescription: "פרטים מסוימים לא נטענו כראוי. שאר הדף פעיל כרגיל.",
    retry: "ניסיון חוזר",
  },
  en: {
    pageTitle: "Something went wrong loading this page",
    pageDescription: "An unexpected error occurred. Try again, and contact support if it keeps happening.",
    widgetTitle: "This widget couldn't load",
    widgetDescription: "Some details failed to load. The rest of the page is unaffected.",
    retry: "Try again",
  },
} as const;
