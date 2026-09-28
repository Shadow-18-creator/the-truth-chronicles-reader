DROP POLICY IF EXISTS "Published chapters readable" ON public.chapters;
CREATE POLICY "Published chapters readable"
ON public.chapters
FOR SELECT
TO anon, authenticated
USING (published_at IS NOT NULL);

GRANT SELECT ON public.chapters TO anon, authenticated;
GRANT ALL ON public.chapters TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;