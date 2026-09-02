import { currentLocale, type Locale } from "./locale";

const intlLocale: Record<Locale, string> = { he: "he-IL", en: "en-US" };

export function money(value = 0, currency = "ILS") {
  return new Intl.NumberFormat(intlLocale[currentLocale()], { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

// `value` comes straight off a Firestore document field typed as `string`, but a malformed/legacy
// record can hold anything that isn't a parseable date - `Intl.DateTimeFormat.format()` throws
// RangeError on an Invalid Date, so this falls back to "—" instead of crashing the page around it.
export function dateTime(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat(intlLocale[currentLocale()], { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export function dateOnly(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat(intlLocale[currentLocale()], { dateStyle: "medium" }).format(parsed);
}

export function number(value = 0) {
  return new Intl.NumberFormat(intlLocale[currentLocale()]).format(value);
}
