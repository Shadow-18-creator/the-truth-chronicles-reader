CREATE TABLE public.chapter_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  translated_title TEXT NOT NULL,
  translated_summary TEXT,
  translated_paragraphs JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  model TEXT NOT NULL DEFAULT 'openai/gpt-5.6-sol',
  reviewed BOOLEAN NOT NULL DEFAULT false,
  review_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, language_code)
);
GRANT SELECT ON public.chapter_translations TO anon, authenticated;
GRANT ALL ON public.chapter_translations TO service_role;
ALTER TABLE public.chapter_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published chapter translations are readable" ON public.chapter_translations
  FOR SELECT TO anon, authenticated
  USING (
    status = 'ready'
    AND EXISTS (
      SELECT 1 FROM public.chapters
      WHERE chapters.id = chapter_translations.chapter_id
        AND chapters.published_at IS NOT NULL
    )
  );
CREATE INDEX chapter_translations_lookup_idx ON public.chapter_translations (chapter_id, language_code, status);
CREATE INDEX chapter_translations_review_idx ON public.chapter_translations (status, updated_at DESC);
CREATE TRIGGER set_chapter_translations_updated_at
  BEFORE UPDATE ON public.chapter_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();