
DROP VIEW IF EXISTS public.chapter_ratings_public;

CREATE OR REPLACE FUNCTION public.get_chapter_rating_stats()
RETURNS TABLE(chapter_id uuid, avg_rating numeric, rating_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT chapter_id, AVG(rating)::numeric, COUNT(*)::bigint
  FROM public.chapter_ratings
  GROUP BY chapter_id
$$;

CREATE OR REPLACE FUNCTION public.get_chapter_rating_stat(_chapter_id uuid)
RETURNS TABLE(avg_rating numeric, rating_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT AVG(rating)::numeric, COUNT(*)::bigint
  FROM public.chapter_ratings
  WHERE chapter_id = _chapter_id
$$;

REVOKE ALL ON FUNCTION public.get_chapter_rating_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_chapter_rating_stat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chapter_rating_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chapter_rating_stat(uuid) TO anon, authenticated;
