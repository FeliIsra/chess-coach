-- Rating snapshots per (user, chess.com handle, time class).
-- One row is captured for each time class found in an analysis batch, so
-- /history/elo can plot a real progress curve over time.

CREATE TABLE IF NOT EXISTS public.elo_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chess_username text NOT NULL,
  time_class text NOT NULL,
  rating integer NOT NULL,
  analysis_id uuid REFERENCES public.analyses(id) ON DELETE SET NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS elo_snapshots_user_class_at_idx
  ON public.elo_snapshots (user_id, time_class, captured_at);

CREATE INDEX IF NOT EXISTS elo_snapshots_analysis_idx
  ON public.elo_snapshots (analysis_id);

ALTER TABLE public.elo_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "elo_snapshots_owner_select" ON public.elo_snapshots;
CREATE POLICY "elo_snapshots_owner_select"
  ON public.elo_snapshots FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "elo_snapshots_owner_insert" ON public.elo_snapshots;
CREATE POLICY "elo_snapshots_owner_insert"
  ON public.elo_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);
