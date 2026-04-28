-- Per-user analysis history. Stores the full result JSON so the detail page
-- can re-render the existing ResultsView from DB instead of re-running the
-- analysis pipeline.

CREATE TABLE IF NOT EXISTS public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chess_username text NOT NULL,
  time_class text,
  result_json jsonb NOT NULL,
  summary_metrics jsonb,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analyses_user_created_idx
  ON public.analyses (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analyses_user_class_idx
  ON public.analyses (user_id, time_class);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analyses_owner_select" ON public.analyses;
CREATE POLICY "analyses_owner_select"
  ON public.analyses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "analyses_public_select" ON public.analyses;
CREATE POLICY "analyses_public_select"
  ON public.analyses FOR SELECT
  USING (is_public = true);

DROP POLICY IF EXISTS "analyses_owner_insert" ON public.analyses;
CREATE POLICY "analyses_owner_insert"
  ON public.analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "analyses_owner_update" ON public.analyses;
CREATE POLICY "analyses_owner_update"
  ON public.analyses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "analyses_owner_delete" ON public.analyses;
CREATE POLICY "analyses_owner_delete"
  ON public.analyses FOR DELETE
  USING (auth.uid() = user_id);
