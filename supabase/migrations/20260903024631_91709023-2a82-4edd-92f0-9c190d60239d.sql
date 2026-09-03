GRANT INSERT, UPDATE, DELETE ON public.chapter_translations TO authenticated;
CREATE POLICY "Admins can manage chapter translations" ON public.chapter_translations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));