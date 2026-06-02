
-- Drop the views (flagged as security definer views)
DROP VIEW IF EXISTS public.chapter_rating_stats;
DROP VIEW IF EXISTS public.user_rating_counts;

-- Restore public SELECT but hide user_id via column grants
DROP POLICY IF EXISTS "Own rating readable" ON public.chapter_ratings;
CREATE POLICY "Ratings readable" ON public.chapter_ratings
  FOR SELECT USING (true);

REVOKE SELECT ON public.chapter_ratings FROM anon, authenticated;
GRANT SELECT (id, chapter_id, rating, created_at, updated_at) ON public.chapter_ratings TO anon, authenticated;
-- Owners still need to see their own rating fully; allow user_id select via a separate self-only policy effect:
-- Column grants are role-wide, so to let a user see their own user_id we expose it via a helper function.

-- Helper: get current user's rating for a chapter (returns rating or null)
CREATE OR REPLACE FUNCTION public.my_chapter_rating(_chapter_id uuid)
RETURNS smallint
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT rating FROM public.chapter_ratings
  WHERE chapter_id = _chapter_id AND user_id = auth.uid()
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.my_chapter_rating(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_chapter_rating(uuid) TO authenticated;

-- Helper: count of chapters a given user has rated (public, aggregate only)
CREATE OR REPLACE FUNCTION public.user_chapters_rated_count(_user_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.chapter_ratings WHERE user_id = _user_id
$$;
REVOKE EXECUTE ON FUNCTION public.user_chapters_rated_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_chapters_rated_count(uuid) TO anon, authenticated;
