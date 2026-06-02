
-- 1) Restrict raw chapter_ratings SELECT to owner; expose aggregates via views
DROP POLICY IF EXISTS "Ratings readable" ON public.chapter_ratings;
CREATE POLICY "Own rating readable" ON public.chapter_ratings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.chapter_rating_stats
WITH (security_invoker = false) AS
SELECT chapter_id,
       AVG(rating)::numeric(4,2) AS avg_rating,
       COUNT(*)::int AS rating_count
FROM public.chapter_ratings
GROUP BY chapter_id;

GRANT SELECT ON public.chapter_rating_stats TO anon, authenticated;

CREATE OR REPLACE VIEW public.user_rating_counts
WITH (security_invoker = false) AS
SELECT user_id, COUNT(*)::int AS rating_count
FROM public.chapter_ratings
GROUP BY user_id;

GRANT SELECT ON public.user_rating_counts TO anon, authenticated;

-- 2) Tighten user_roles: only admins can manage; keep bootstrap for first admin
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) Lock down SECURITY DEFINER functions that should not be callable via API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_chapter_room() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 4) Storage: stop listing of avatars bucket; public URLs still serve files
DROP POLICY IF EXISTS "Avatars are publicly viewable" ON storage.objects;
-- Bucket is public so direct URLs still work; no SELECT policy = no listing.
