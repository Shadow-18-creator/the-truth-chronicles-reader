BEGIN;

DROP POLICY IF EXISTS "Public can read Watcher basics" ON public.watcher_config;
DROP POLICY IF EXISTS "Admins read watcher config" ON public.watcher_config;
CREATE POLICY "Public can read Watcher basics"
ON public.watcher_config
FOR SELECT
TO anon
USING (id = true);
CREATE POLICY "Admins read watcher config"
ON public.watcher_config
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE SELECT ON TABLE public.watcher_config FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, name, tagline, avatar_url, voice_id)
ON TABLE public.watcher_config TO anon;
GRANT SELECT, UPDATE ON TABLE public.watcher_config TO authenticated;

COMMIT;