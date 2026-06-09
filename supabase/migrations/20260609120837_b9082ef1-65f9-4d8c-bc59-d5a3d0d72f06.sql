
-- 1) Hide user_id on chapter_ratings from public reads via column-level grants
REVOKE SELECT ON public.chapter_ratings FROM anon, authenticated;
GRANT SELECT (id, chapter_id, rating, created_at, updated_at) ON public.chapter_ratings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chapter_ratings TO authenticated;
GRANT ALL ON public.chapter_ratings TO service_role;

-- 2) Prevent any future admin claims (admin already claimed) and enforce single-admin invariant
DROP POLICY IF EXISTS "First user can claim admin" ON public.user_roles;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_admin_idx
  ON public.user_roles ((1)) WHERE role = 'admin';

-- 3) Stop leaking block reason / admin identity to blocked users
DROP POLICY IF EXISTS "Users see own block" ON public.blocked_users;
