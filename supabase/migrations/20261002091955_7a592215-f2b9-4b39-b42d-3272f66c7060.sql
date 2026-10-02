DROP POLICY IF EXISTS "Admins manage chapters read" ON public.chapters;
CREATE POLICY "Admins manage chapters read"
ON public.chapters
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;