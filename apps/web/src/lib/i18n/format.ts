import { currentLocale, type Locale } from "./locale";

const intlLocale: Record<Locale, string> = { he: "he-IL", en: "en-US" };

export function money(value = 0, currency = "ILS") {
  return new Intl.NumberFormat(intlLocale[currentLocale()], { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function dateTime(value?: string) {
  return value ? new Intl.DateTimeFormat(intlLocale[currentLocale()], { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

export function dateOnly(value?: string) {
  return value ? new Intl.DateTimeFormat(intlLocale[currentLocale()], { dateStyle: "medium" }).format(new Date(value)) : "—";
}

export function number(value = 0) {
  return new Intl.NumberFormat(intlLocale[currentLocale()]).format(value);
}
