import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export function hashSource(parts: ReadonlyArray<string>): string {
  return createHash("sha256").update(parts.join("")).digest("hex");
}

interface CachedRow {
  content: string;
}

export async function getCachedOrCompute(
  sourceHash: string,
  locale: string,
  compute: () => Promise<string>
): Promise<string> {
  let supabase: ReturnType<typeof getSupabaseAdminClient> | null = null;
  try {
    supabase = getSupabaseAdminClient();
  } catch {
    // Service role not configured (local dev, tests). Fall through to compute.
    return compute();
  }

  try {
    const { data } = await supabase
      .from("translation_cache")
      .select("content")
      .eq("source_hash", sourceHash)
      .eq("locale", locale)
      .maybeSingle<CachedRow>();
    if (data?.content) return data.content;
  } catch {
    // Read failure is best-effort; fall through to compute.
  }

  const computed = await compute();

  try {
    await supabase
      .from("translation_cache")
      .insert({ source_hash: sourceHash, locale, content: computed });
  } catch {
    // Insert failure is best-effort; computed value is still usable.
  }

  return computed;
}
