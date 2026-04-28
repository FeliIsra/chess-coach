-- Cache for AI-translated outputs (LLM coach summaries, glossary blurbs, etc).
-- Keyed by sha256 hash of (prompt-template + content_kind + source content)
-- so we avoid re-hitting OpenAI for repeated content in the same locale.

CREATE TABLE IF NOT EXISTS public.translation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_hash text NOT NULL,
  locale text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS translation_cache_hash_locale_uidx
  ON public.translation_cache (source_hash, locale);

ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "translation_cache_public_select" ON public.translation_cache;
CREATE POLICY "translation_cache_public_select"
  ON public.translation_cache FOR SELECT
  USING (true);

-- Writes are service-role only. Anon/users have no INSERT/UPDATE/DELETE policy
-- so RLS will reject those.
