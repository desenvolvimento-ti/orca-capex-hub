
REVOKE EXECUTE ON FUNCTION public.notify_users(uuid[], text, text, text, uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fpa_user_ids() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ceo_user_ids() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_project_status_change() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_change_request_status() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cycle_funnel(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.status_avg_days(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cycle_funnel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.status_avg_days(uuid) TO authenticated;
