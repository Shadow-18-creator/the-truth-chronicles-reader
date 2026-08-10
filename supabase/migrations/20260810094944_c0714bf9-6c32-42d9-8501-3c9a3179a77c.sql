CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.watcher_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  source_url text,
  raw_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  chunk_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watcher_sources TO authenticated;
GRANT ALL ON public.watcher_sources TO service_role;

ALTER TABLE public.watcher_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read watcher sources" ON public.watcher_sources
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert watcher sources" ON public.watcher_sources
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update watcher sources" ON public.watcher_sources
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete watcher sources" ON public.watcher_sources
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER watcher_sources_updated_at BEFORE UPDATE ON public.watcher_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.watcher_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.watcher_sources(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(3072),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.watcher_chunks TO authenticated;
GRANT ALL ON public.watcher_chunks TO service_role;

ALTER TABLE public.watcher_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read watcher chunks" ON public.watcher_chunks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX watcher_chunks_source_idx ON public.watcher_chunks(source_id);
CREATE INDEX watcher_chunks_embedding_idx
  ON public.watcher_chunks USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_watcher_chunks(query_embedding vector(3072), match_count int DEFAULT 8)
RETURNS TABLE(content text, title text, similarity float)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.content, s.title, 1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.watcher_chunks c
  JOIN public.watcher_sources s ON s.id = c.source_id
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count
$$;

REVOKE EXECUTE ON FUNCTION public.match_watcher_chunks(vector, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_watcher_chunks(vector, int) TO service_role;