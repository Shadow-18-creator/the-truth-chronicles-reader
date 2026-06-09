CREATE TABLE public.novel_meta (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  summary text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.novel_meta TO anon, authenticated;
GRANT INSERT, UPDATE ON public.novel_meta TO authenticated;
GRANT ALL ON public.novel_meta TO service_role;

ALTER TABLE public.novel_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read novel meta"
  ON public.novel_meta FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert novel meta"
  ON public.novel_meta FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update novel meta"
  ON public.novel_meta FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER novel_meta_set_updated_at
  BEFORE UPDATE ON public.novel_meta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.novel_meta (id, summary, tags) VALUES (true, '', '{}');
