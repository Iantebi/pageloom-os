export const mfaChallenge = {
  he: {
    title: "אימות דו-שלבי נדרש",
    description: "הזינו את הקוד בן 6 הספרות מאפליקציית האימות שלכם כדי להשלים את הכניסה.",
    codeFieldLabel: "קוד בן 6 ספרות",
    verifyButton: "אימות והמשך",
    verifyingButton: "מאמת…",
    cancelButton: "חזרה לכניסה",
    invalidCode: "הקוד שגוי או פג תוקף. נסו שוב עם הקוד העדכני ביותר.",
    genericError: "לא ניתן היה להשלים את האימות הדו-שלבי. נסו שוב.",
  },
  en: {
    title: "Multi-factor authentication required",
    description: "Enter the 6-digit code from your authenticator app to finish signing in.",
    codeFieldLabel: "6-digit code",
    verifyButton: "Verify and continue",
    verifyingButton: "Verifying…",
    cancelButton: "Back to sign-in",
    invalidCode: "That code was wrong or expired. Try again with the latest code.",
    genericError: "Could not complete multi-factor authentication. Try again.",
  },
} as const;
