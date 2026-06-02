-- Lock down SECURITY DEFINER functions: revoke from PUBLIC and anon
-- has_role is needed by RLS policies for authenticated users only
-- user_chapters_rated_count is called from the app by authenticated users only

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.user_chapters_rated_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_chapters_rated_count(uuid) TO authenticated, service_role;
