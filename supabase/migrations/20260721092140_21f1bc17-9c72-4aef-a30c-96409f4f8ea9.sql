
-- 1. chapter_ratings: restrict SELECT to owner; expose public aggregates via view
DROP POLICY IF EXISTS "Ratings readable" ON public.chapter_ratings;
CREATE POLICY "Users read own rating" ON public.chapter_ratings
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_ratings TO authenticated;
GRANT ALL ON public.chapter_ratings TO service_role;

CREATE OR REPLACE VIEW public.chapter_ratings_public
WITH (security_invoker = false) AS
  SELECT chapter_id, rating FROM public.chapter_ratings;

GRANT SELECT ON public.chapter_ratings_public TO anon, authenticated;

-- 2. chat_messages: explicit deny UPDATE
DROP POLICY IF EXISTS "No message edits" ON public.chat_messages;
CREATE POLICY "No message edits" ON public.chat_messages
  FOR UPDATE USING (false) WITH CHECK (false);

-- 3. is_blocked: prevent enumeration of other users
CREATE OR REPLACE FUNCTION public.is_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE user_id = _user_id
      AND (_user_id = auth.uid() OR auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role))
  )
$function$;
