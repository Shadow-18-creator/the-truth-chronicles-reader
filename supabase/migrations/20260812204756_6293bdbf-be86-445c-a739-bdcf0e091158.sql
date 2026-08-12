REVOKE ALL ON FUNCTION public.snapshot_watcher_config() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_watcher_chunks(vector, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_watcher_chunks(vector, integer) TO service_role;
REVOKE ALL ON FUNCTION public.get_chapter_rating_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chapter_rating_stats() TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_chapter_rating_stat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chapter_rating_stat(uuid) TO anon, authenticated, service_role;