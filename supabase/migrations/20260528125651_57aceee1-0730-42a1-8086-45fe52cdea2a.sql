
-- Trigger-only functions: nobody should be able to call directly
REVOKE EXECUTE ON FUNCTION public.normalize_allowed_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_project_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- RLS-helper and RPC functions: revoke from anon + public, grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_user_area() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_area() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_cycle_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_cycle_period(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_project_to_cycle(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_project_to_cycle(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.decisao_diretor(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decisao_diretor(uuid, boolean, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.encaminhar_para_diretor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encaminhar_para_diretor(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.archive_cycle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_cycle(uuid) TO authenticated;
