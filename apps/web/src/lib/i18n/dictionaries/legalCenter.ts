export const legalCenter = {
  he: {
    title: "מרכז המסמכים המשפטיים",
    subtitle: "הסכמים, פרטיות, נגישות ותנאי עיבוד מידע לפי גרסה מאושרת",
    loadError: "לא הצלחנו לטעון את המסמכים המשפטיים. נסו לרענן את העמוד.",
    versionMeta: (version: string, date: string) => `גרסה ${version} · בתוקף מ־${date}`,
    loadingTitle: "טוענים מסמכים משפטיים…",
    emptyTitle: "עדיין אין מסמכים שפורסמו",
    emptyDescription: "בפורטל מוצגות רק גרסאות מאושרות ובלתי ניתנות לשינוי.",
  },
  en: {
    title: "Legal documents center",
    subtitle: "Agreements, privacy, accessibility, and data processing terms by approved version",
    loadError: "We couldn't load the legal documents. Try refreshing the page.",
    versionMeta: (version: string, date: string) => `Version ${version} · effective from ${date}`,
    loadingTitle: "Loading legal documents…",
    emptyTitle: "No documents published yet",
    emptyDescription: "The portal only shows approved, immutable versions.",
  },
} as const;
