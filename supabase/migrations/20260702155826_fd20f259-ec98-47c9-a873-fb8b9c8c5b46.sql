
CREATE OR REPLACE FUNCTION public.notify_project_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_code text;
  v_director uuid;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  v_code := COALESCE(NEW.code, NEW.name);
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
END $function$;

CREATE OR REPLACE FUNCTION public.notify_change_request_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proj public.projects;
  v_url text;
  v_director uuid;
  v_code text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT * INTO v_proj FROM public.projects WHERE id = NEW.project_id;
  v_code := COALESCE(v_proj.code, v_proj.name);
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
END $function$;
