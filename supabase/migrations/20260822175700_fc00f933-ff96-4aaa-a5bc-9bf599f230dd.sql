CREATE OR REPLACE VIEW public.chapter_rating_stats AS
SELECT
  chapter_id,
  COALESCE(AVG(rating), 0)::numeric AS avg_rating,
  COUNT(*)::bigint AS rating_count
FROM public.chapter_ratings
GROUP BY chapter_id;

GRANT SELECT ON public.chapter_rating_stats TO anon;
GRANT SELECT ON public.chapter_rating_stats TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_chapter_rating_stats FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_chapter_rating_stat FROM anon;