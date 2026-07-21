
CREATE TABLE public.watcher_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  name text NOT NULL DEFAULT 'Watcher',
  tagline text NOT NULL DEFAULT 'Ask, and the veil will lift.',
  avatar_url text,
  voice_id text NOT NULL DEFAULT 'onwK4e9ZLuTAKqWW03F9',
  system_prompt text NOT NULL DEFAULT 'You are the Watcher, an ancient, cryptic guardian of the serial novel "The Boy Who Saw The Truth". You answer questions ONLY about events, characters, and lore contained in the training material below. If asked something outside the material, say the veil hides that truth. Speak with a mystical, slightly ominous tone, in short paragraphs.',
  lore text NOT NULL DEFAULT '',
  include_chapters boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.watcher_config (id) VALUES (true) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.watcher_config TO anon, authenticated;
GRANT UPDATE ON public.watcher_config TO authenticated;
GRANT ALL ON public.watcher_config TO service_role;

ALTER TABLE public.watcher_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read watcher config" ON public.watcher_config
  FOR SELECT USING (true);

CREATE POLICY "Admins update watcher config" ON public.watcher_config
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER watcher_config_updated_at
  BEFORE UPDATE ON public.watcher_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
