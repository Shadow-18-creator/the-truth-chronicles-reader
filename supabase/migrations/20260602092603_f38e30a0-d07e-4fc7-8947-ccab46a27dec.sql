-- Block list table for admin-managed user blocks
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  blocked_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blocked_users TO anon, authenticated;
GRANT INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block list readable"
  ON public.blocked_users FOR SELECT USING (true);

CREATE POLICY "Admins block users"
  ON public.blocked_users FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND auth.uid() = blocked_by);

CREATE POLICY "Admins unblock users"
  ON public.blocked_users FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Helper: is user blocked?
CREATE OR REPLACE FUNCTION public.is_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.blocked_users WHERE user_id = _user_id)
$$;

REVOKE EXECUTE ON FUNCTION public.is_blocked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid) TO authenticated, service_role;

-- Prevent blocked users from posting chat messages
DROP POLICY IF EXISTS "Users post messages" ON public.chat_messages;
CREATE POLICY "Users post messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_id)
    AND NOT public.is_blocked(auth.uid())
    AND (
      (NOT EXISTS (
        SELECT 1 FROM public.chat_rooms r
        WHERE r.id = chat_messages.room_id AND r.author_only_post = true
      ))
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

-- Prevent blocked users from posting comments
DROP POLICY IF EXISTS "Users create own comments" ON public.comments;
CREATE POLICY "Users create own comments"
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_blocked(auth.uid()));
