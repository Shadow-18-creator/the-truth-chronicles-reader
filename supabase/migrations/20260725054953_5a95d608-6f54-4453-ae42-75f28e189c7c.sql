
CREATE TABLE public.watcher_training_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  voice_id text NOT NULL DEFAULT '',
  system_prompt text NOT NULL DEFAULT '',
  lore text NOT NULL DEFAULT '',
  include_chapters boolean NOT NULL DEFAULT true,
  avatar_url text,
  training_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  chapter_count int NOT NULL DEFAULT 0,
  note text
);

GRANT SELECT, INSERT ON public.watcher_training_history TO authenticated;
GRANT ALL ON public.watcher_training_history TO service_role;

ALTER TABLE public.watcher_training_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view watcher history"
  ON public.watcher_training_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert watcher history"
  ON public.watcher_training_history FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX watcher_training_history_created_at_idx
  ON public.watcher_training_history (created_at DESC);

CREATE OR REPLACE FUNCTION public.snapshot_watcher_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ch_count int;
BEGIN
  SELECT COUNT(*)::int INTO ch_count
  FROM public.chapters
  WHERE published_at IS NOT NULL;

  INSERT INTO public.watcher_training_history (
    created_by, name, tagline, voice_id, system_prompt, lore,
    include_chapters, avatar_url, training_images, chapter_count
  ) VALUES (
    auth.uid(), NEW.name, NEW.tagline, NEW.voice_id, NEW.system_prompt, NEW.lore,
    NEW.include_chapters, NEW.avatar_url, to_jsonb(NEW.training_images), ch_count
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER watcher_config_snapshot
  AFTER INSERT OR UPDATE ON public.watcher_config
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_watcher_config();

-- Seed one row from current config
INSERT INTO public.watcher_training_history (
  name, tagline, voice_id, system_prompt, lore, include_chapters,
  avatar_url, training_images, chapter_count, note
)
SELECT wc.name, wc.tagline, wc.voice_id, wc.system_prompt, wc.lore,
       wc.include_chapters, wc.avatar_url, to_jsonb(wc.training_images),
       (SELECT COUNT(*)::int FROM public.chapters WHERE published_at IS NOT NULL),
       'Initial snapshot'
FROM public.watcher_config wc;
