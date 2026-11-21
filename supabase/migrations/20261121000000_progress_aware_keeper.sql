-- ========================================================
-- Reader Progress & Anti-Spoiler Keeper Migration
-- Scopes The Keeper's memory to each reader's unlocked chapters
-- ========================================================

CREATE TABLE IF NOT EXISTS public.reader_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  highest_unlocked_chapter INT NOT NULL DEFAULT 1,
  last_read_chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reader_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own reader progress" ON public.reader_progress;
CREATE POLICY "Users view own reader progress"
  ON public.reader_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own reader progress" ON public.reader_progress;
CREATE POLICY "Users update own reader progress"
  ON public.reader_progress FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.reader_progress TO authenticated;
GRANT ALL ON public.reader_progress TO service_role;
