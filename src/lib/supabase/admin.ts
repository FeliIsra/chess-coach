import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client. RLS is bypassed — only call from
// trusted server code (route handlers running with NEXT_RUNTIME=nodejs).
//
// We prefer NEXT_PUBLIC_SUPABASE_URL (the spec for WT-I.a) and fall
// back to SUPABASE_URL (already used by src/lib/supabase/server.ts) so
// existing local setups keep working without a new env var.

let cachedClient: SupabaseClient | null = null;

function readSupabaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)",
    );
  }
  return url;
}

function readServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return key;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient(readSupabaseUrl(), readServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

/** Test-only helper to clear the memoized client between tests. */
export function __resetSupabaseAdminForTests(): void {
  cachedClient = null;
}
