BEGIN;

-- Community and profile data are available only to signed-in readers.
DROP POLICY IF EXISTS "Profiles readable by everyone" ON public.profiles;
CREATE POLICY "Signed-in readers can browse profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Rooms readable" ON public.chat_rooms;
CREATE POLICY "Signed-in readers can browse rooms"
ON public.chat_rooms
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON TABLE public.chat_rooms FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.chat_rooms TO authenticated;

DROP POLICY IF EXISTS "Messages readable" ON public.chat_messages;
CREATE POLICY "Signed-in readers can browse messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON TABLE public.chat_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.chat_messages TO authenticated;

DROP POLICY IF EXISTS "Comments readable" ON public.comments;
CREATE POLICY "Signed-in readers can browse comments"
ON public.comments
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON TABLE public.comments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.comments TO authenticated;

DROP POLICY IF EXISTS "Likes readable" ON public.message_likes;
CREATE POLICY "Signed-in readers can browse message likes"
ON public.message_likes
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON TABLE public.message_likes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.message_likes TO authenticated;

-- The Watcher's public profile is deliberately limited to non-training fields.
DROP POLICY IF EXISTS "Anyone can read watcher config" ON public.watcher_config;
CREATE POLICY "Public can read Watcher basics"
ON public.watcher_config
FOR SELECT
TO anon, authenticated
USING (id = true);
REVOKE SELECT ON TABLE public.watcher_config FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, name, tagline, avatar_url, voice_id)
ON TABLE public.watcher_config TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.watcher_config TO service_role;

-- The one-row novel metadata contains only deliberately public story details.
DROP POLICY IF EXISTS "Anyone can read novel meta" ON public.novel_meta;
CREATE POLICY "Public can read novel details"
ON public.novel_meta
FOR SELECT
TO anon, authenticated
USING (id = true);
REVOKE SELECT ON TABLE public.novel_meta FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.novel_meta TO anon, authenticated;

COMMIT;