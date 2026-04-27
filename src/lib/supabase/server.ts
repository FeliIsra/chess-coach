import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getOptionalEnv(...names: string[]): string {
  for (const name of names) {
    const raw = process.env[name];
    if (raw && raw.trim()) return raw.trim();
  }
  throw new Error(
    `Missing required environment variable: one of ${names.join(", ")} must be set`
  );
}

/**
 * Service-role client used by trusted server-only code paths
 * (e.g. legacy /api/history admin writes). Bypasses RLS.
 *
 * NOTE: kept for backwards compatibility with WT-H's pre-auth flows.
 * For user-context reads/writes prefer `getSupabaseServerClient()`.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  adminClient = createClient(
    getOptionalEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return adminClient;
}

/**
 * SSR Supabase client wired to Next.js cookies for the current request.
 * Use in server components, route handlers, and server actions to honour
 * RLS as the logged-in user.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = getOptionalEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options as CookieOptions);
          }
        } catch {
          // setAll() may be called from a server component where mutating
          // cookies is not allowed. The middleware refresh handles that case.
        }
      },
    },
  });
}
