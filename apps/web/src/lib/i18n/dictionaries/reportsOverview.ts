const typeLabelsHe: Record<string, string> = {
  executive: "הנהלה", monthly: "חודשי", customer: "לקוחות", financial: "פיננסי",
  infrastructure: "תשתיות", support: "תמיכה", growth: "צמיחה",
};
const typeLabelsEn: Record<string, string> = {
  executive: "Executive", monthly: "Monthly", customer: "Customer", financial: "Financial",
  infrastructure: "Infrastructure", support: "Support", growth: "Growth",
};

export const reportsOverview = {
  he: {
    typeLabel: (value: string) => typeLabelsHe[value] ?? value.replaceAll("_", " "),
    title: "דוחות עסקיים",
    subtitle: "ייצוא בלתי ניתן לשינוי של דוחות הנהלה, לקוחות, כספים, תשתיות, תמיכה וצמיחה",
    generate: "יצירת דוח",
    noReportsTitle: "לא נוצרו דוחות",
    noReportsDescription: "צרו את הדוח העסקי הראשון עבור התקופה הנוכחית.",
  },
  en: {
    typeLabel: (value: string) => typeLabelsEn[value] ?? value.replaceAll("_", " "),
    title: "Business reports",
    subtitle: "Immutable executive, customer, financial, infrastructure, support and growth exports",
    generate: "Generate",
    noReportsTitle: "No generated reports",
    noReportsDescription: "Generate the first current-period business report.",
  },
} as const;
