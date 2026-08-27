export const apiErrors = {
  he: {
    workspaceLoadFailed: "לא הצלחנו לטעון את סביבת העבודה שלכם. בדקו את החיבור לאינטרנט ונסו שוב.",
    unexpectedResponse: (status: number, detail: string) => `PageLoom API החזיר תגובה לא צפויה (${status}) ${detail}`,
    withoutContentType: "ללא סוג תוכן",
    requestFailed: "הבקשה נכשלה",
    fileRequestFailed: "בקשת הקובץ נכשלה",
  },
  en: {
    workspaceLoadFailed: "We couldn't load your workspace. Check your connection and try again.",
    unexpectedResponse: (status: number, detail: string) => `PageLoom API returned ${status} ${detail}`,
    withoutContentType: "without a content type",
    requestFailed: "Request failed",
    fileRequestFailed: "File request failed",
  },
} as const;
