export type Locale = "he" | "en";

// PageLoom OS is Hebrew-first. This is the single place that decides the
// active locale — swap this for a cookie/context read later to support a
// live language switcher without touching any dictionary or component.
export const DEFAULT_LOCALE: Locale = "he";

export function currentLocale(): Locale {
  return DEFAULT_LOCALE;
}

export const isRtl = (locale: Locale) => locale === "he";
