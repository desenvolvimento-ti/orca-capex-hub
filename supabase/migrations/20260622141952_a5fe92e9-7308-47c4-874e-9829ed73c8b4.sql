
-- ============= NOTIFICATIONS TABLE =============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  change_request_id uuid REFERENCES public.project_change_requests(id) ON DELETE CASCADE,
  url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id, read_at, created_at DESC);
CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê suas notificações"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Usuário marca/remove suas notificações"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuário deleta suas notificações"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============= HELPERS =============
CREATE OR REPLACE FUNCTION public.notify_users(
  p_user_ids uuid[], p_kind text, p_title text, p_body text,
  p_project_id uuid, p_change_request_id uuid, p_url text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid;
BEGIN
  IF p_user_ids IS NULL THEN RETURN; END IF;
  FOREACH u IN ARRAY p_user_ids LOOP
    IF u IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.notifications (user_id, kind, title, body, project_id, change_request_id, url)
    VALUES (u, p_kind, p_title, p_body, p_project_id, p_change_request_id, p_url);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fpa_user_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[])
  FROM public.user_roles WHERE role = 'fpa'::app_role
$$;

CREATE OR REPLACE FUNCTION public.ceo_user_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[])
  FROM public.user_roles WHERE role = 'ceo'::app_role
$$;

-- ============= TRIGGER: PROJECT STATUS =============
CREATE OR REPLACE FUNCTION public.notify_project_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_url text;
  v_code text;
  v_director uuid;
  v_title text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  v_code := COALESCE(NEW.code, NEW.title);
  v_url := '/app/projects/' || NEW.id::text;

  IF NEW.status = 'submetido_intake' THEN
    PERFORM public.notify_users(public.fpa_user_ids(), 'intake_novo',
      'Novo projeto no intake', v_code || ' aguarda análise', NEW.id, NULL, v_url);

  ELSIF NEW.status = 'aguardando_diretor' THEN
    SELECT director_id INTO v_director FROM public.areas WHERE id = NEW.area_id;
    IF v_director IS NOT NULL THEN
      PERFORM public.notify_users(ARRAY[v_director], 'aguardando_diretor',
        'Projeto aguarda sua decisão', v_code, NEW.id, NULL, v_url);
    END IF;

  ELSIF NEW.status = 'aguardando_ceo' THEN
    PERFORM public.notify_users(public.ceo_user_ids(), 'aguardando_ceo',
      'Projeto aguarda decisão do CEO', v_code, NEW.id, NULL, v_url);

  ELSIF NEW.status = 'devolvido_revisao' THEN
    IF NEW.owner_id IS NOT NULL THEN
      PERFORM public.notify_users(ARRAY[NEW.owner_id], 'devolvido',
        'Projeto devolvido para revisão', v_code, NEW.id, NULL, v_url);
    END IF;

  ELSIF NEW.status = 'reprovado' THEN
    IF NEW.owner_id IS NOT NULL THEN
      PERFORM public.notify_users(ARRAY[NEW.owner_id], 'reprovado',
        'Projeto reprovado', v_code, NEW.id, NULL, v_url);
    END IF;

  ELSIF NEW.status IN ('liberado','liberado_parcial') THEN
    IF NEW.owner_id IS NOT NULL THEN
      PERFORM public.notify_users(ARRAY[NEW.owner_id], 'liberado',
        'Projeto liberado!', v_code, NEW.id, NULL, v_url);
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_project_status ON public.projects;
CREATE TRIGGER trg_notify_project_status
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_status_change();

-- ============= TRIGGER: CHANGE REQUEST STATUS =============
CREATE OR REPLACE FUNCTION public.notify_change_request_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proj public.projects;
  v_url text;
  v_director uuid;
  v_code text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT * INTO v_proj FROM public.projects WHERE id = NEW.project_id;
  v_code := COALESCE(v_proj.code, v_proj.title);
  v_url := '/app/projects/' || NEW.project_id::text;

  IF TG_OP = 'INSERT' OR NEW.status = 'pendente_fpa' THEN
    PERFORM public.notify_users(public.fpa_user_ids(), 'cr_pendente_fpa',
      'Nova solicitação de alteração', v_code, NEW.project_id, NEW.id, v_url);
  ELSIF NEW.status = 'aguardando_diretor' THEN
    SELECT director_id INTO v_director FROM public.areas WHERE id = v_proj.area_id;
    IF v_director IS NOT NULL THEN
      PERFORM public.notify_users(ARRAY[v_director], 'cr_aguardando_diretor',
        'Alteração aguarda sua decisão', v_code, NEW.project_id, NEW.id, v_url);
    END IF;
  ELSIF NEW.status = 'aguardando_ceo' THEN
    PERFORM public.notify_users(public.ceo_user_ids(), 'cr_aguardando_ceo',
      'Alteração aguarda decisão do CEO', v_code, NEW.project_id, NEW.id, v_url);
  ELSIF NEW.status IN ('devolvido_revisao','reprovado','aprovado') THEN
    IF NEW.requested_by IS NOT NULL THEN
      PERFORM public.notify_users(ARRAY[NEW.requested_by], 'cr_' || NEW.status::text,
        'Solicitação ' || NEW.status::text, v_code, NEW.project_id, NEW.id, v_url);
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_cr_status ON public.project_change_requests;
CREATE TRIGGER trg_notify_cr_status
  AFTER INSERT OR UPDATE OF status ON public.project_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_change_request_status();

-- ============= FUNIL / HEATMAP HELPERS =============
CREATE OR REPLACE FUNCTION public.cycle_funnel(p_cycle_id uuid)
RETURNS TABLE(status text, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT status::text, count(*)::bigint
    FROM public.projects
   WHERE cycle_id = p_cycle_id
   GROUP BY status
$$;

CREATE OR REPLACE FUNCTION public.status_avg_days(p_cycle_id uuid)
RETURNS TABLE(status text, avg_days numeric, samples bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH events AS (
    SELECT h.project_id, h.to_status::text AS status, h.created_at,
           LEAD(h.created_at) OVER (PARTITION BY h.project_id ORDER BY h.created_at) AS next_at
      FROM public.project_status_history h
      JOIN public.projects p ON p.id = h.project_id
     WHERE p_cycle_id IS NULL OR p.cycle_id = p_cycle_id
  )
  SELECT status,
         ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(next_at, now()) - created_at)) / 86400.0)::numeric, 2),
         count(*)::bigint
    FROM events
   GROUP BY status
$$;
