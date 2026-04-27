import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "es", "pt"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normaliseLocale(input?: string | null): SupportedLocale {
  if (!input) return DEFAULT_LOCALE;
  return isSupportedLocale(input) ? input : DEFAULT_LOCALE;
}

/**
 * Returns the currently authenticated Supabase user, or `null` if there is
 * no active session. Safe to call from server components, route handlers,
 * and server actions.
 */
export async function getUser(): Promise<User | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user ?? null;
  } catch {
    // Missing env vars or transport errors should not crash a server component
    // — surface as "no user" so the protected guard redirects to sign-in.
    return null;
  }
}

/**
 * Returns the current user or redirects to `/<locale>/sign-in` if no
 * session is present. Use in protected server components / pages.
 */
export async function requireUser(
  locale: string = DEFAULT_LOCALE,
  redirectTo?: string
): Promise<User> {
  const user = await getUser();
  if (user) return user;

  const safeLocale = normaliseLocale(locale);
  const target = redirectTo
    ? `/${safeLocale}/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`
    : `/${safeLocale}/sign-in`;
  redirect(target);
}
