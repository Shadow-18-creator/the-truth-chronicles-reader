DROP POLICY IF EXISTS "Block list readable" ON public.blocked_users;
CREATE POLICY "Admins read block list" ON public.blocked_users FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users see own block" ON public.blocked_users FOR SELECT TO authenticated USING (auth.uid() = user_id);