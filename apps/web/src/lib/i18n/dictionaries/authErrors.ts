export const authErrors = {
  he: {
    unauthorizedDomain: "הכתובת הזו עדיין לא מורשית לכניסה דרך Firebase. ב-Firebase Console, עברו אל Authentication ← Settings ← Authorized domains והוסיפו את הכתובת המדויקת הזו (כולל הפורט בסביבת פיתוח מקומית).",
    popupBlocked: "חלון הכניסה נחסם על ידי הדפדפן. אפשרו חלונות קופצים לאתר זה ונסו שוב.",
    popupClosed: "חלון הכניסה נסגר לפני השלמת ההתחברות. נסו שוב.",
    networkError: "שגיאת רשת בתחילת ההתחברות. בדקו את החיבור לאינטרנט ונסו שוב.",
    operationNotAllowed: "הכניסה דרך Google עדיין לא מופעלת בפרויקט הזה. הפעילו את ספק Google תחת Authentication ← Sign-in method.",
    generic: "לא ניתן היה להתחיל את תהליך ההתחברות. נסו שוב.",
  },
  en: {
    unauthorizedDomain: "This domain is not authorized for Firebase sign-in yet. In Firebase Console, go to Authentication → Settings → Authorized domains and add this exact host (including the port for local development).",
    popupBlocked: "The sign-in popup was blocked by the browser. Allow popups for this site and try again.",
    popupClosed: "The sign-in window was closed before completing sign-in. Try again.",
    networkError: "Network error while starting sign-in. Check your connection and try again.",
    operationNotAllowed: "Google sign-in is not enabled for this Firebase project yet. Enable the Google provider in Authentication → Sign-in method.",
    generic: "Sign-in could not be started. Try again.",
  },
} as const;
