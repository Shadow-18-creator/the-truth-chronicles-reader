
CREATE POLICY "Admin roles publicly readable"
ON public.user_roles FOR SELECT
TO anon, authenticated
USING (role = 'admin');

GRANT SELECT ON public.user_roles TO anon;
