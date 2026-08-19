CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  bucket timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, action, bucket)
);

GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON public.chat_messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_chapter_created ON public.comments(chapter_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chapter_ratings_chapter ON public.chapter_ratings(chapter_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_watcher_chunks_source ON public.watcher_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_watcher_sources_creator_created ON public.watcher_sources(created_by, created_at);
CREATE INDEX IF NOT EXISTS idx_line_bookmarks_chapter_user ON public.line_bookmarks(chapter_id, user_id);