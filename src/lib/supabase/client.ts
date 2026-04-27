"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function readPublicEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local before running the app.`
    );
  }
  return value.trim();
}

/**
 * Browser-side Supabase client. Memoised so we only create one instance per tab.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }
  browserClient = createBrowserClient(
    readPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
  return browserClient;
}
