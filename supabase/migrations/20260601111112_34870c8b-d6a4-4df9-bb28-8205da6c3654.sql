
-- Add foreign keys so PostgREST can resolve profile joins (fixes lounge messages)
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Likes on chat messages
CREATE TABLE public.message_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  liker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, liker_id)
);

GRANT SELECT ON public.message_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.message_likes TO authenticated;
GRANT ALL ON public.message_likes TO service_role;

ALTER TABLE public.message_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes readable" ON public.message_likes FOR SELECT USING (true);
CREATE POLICY "Users like messages" ON public.message_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = liker_id AND liker_id <> recipient_id);
CREATE POLICY "Users unlike own likes" ON public.message_likes FOR DELETE TO authenticated
  USING (auth.uid() = liker_id);

CREATE INDEX idx_message_likes_recipient ON public.message_likes(recipient_id);
CREATE INDEX idx_message_likes_message ON public.message_likes(message_id);

-- Chapter ratings (1-5 stars)
CREATE TABLE public.chapter_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, user_id)
);

GRANT SELECT ON public.chapter_ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_ratings TO authenticated;
GRANT ALL ON public.chapter_ratings TO service_role;

ALTER TABLE public.chapter_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings readable" ON public.chapter_ratings FOR SELECT USING (true);
CREATE POLICY "Users rate" ON public.chapter_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own rating" ON public.chapter_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own rating" ON public.chapter_ratings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER chapter_ratings_updated_at
  BEFORE UPDATE ON public.chapter_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime for likes
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_likes;
