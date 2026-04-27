import { defineRouting } from "next-intl/routing";

/**
 * Locale routing configuration for next-intl.
 *
 * - English is the default locale.
 * - Spanish and Portuguese are also supported initial locales.
 * - We use `localePrefix: "always"` so URLs always carry the locale prefix
 *   (e.g. `/en/...`, `/es/...`). The root `/` is redirected to the default
 *   locale via a server-side redirect at `src/app/page.tsx`.
 */
export const routing = defineRouting({
  locales: ["en", "es", "pt"] as const,
  defaultLocale: "en",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

export const DEFAULT_LOCALE: AppLocale = routing.defaultLocale;

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  es: "Espanol",
  pt: "Portugues",
};
