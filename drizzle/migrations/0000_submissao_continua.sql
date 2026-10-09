-- Submissão contínua: projetos são submetidos a qualquer momento, sem ciclo/janela.

CREATE OR REPLACE FUNCTION public.submeter_projeto(p_project_id uuid)
 RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_project public.projects;
  v_from project_status;
  v_year int;
  v_seq int;
  v_code text;
  v_missing text[] := '{}';
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  IF v_project.owner_id <> auth.uid() AND NOT has_role(auth.uid(), 'fpa'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão para submeter este projeto';
  END IF;

  IF v_project.status NOT IN ('no_hub'::project_status, 'no_ciclo'::project_status,
                              'rascunho'::project_status, 'retornado_backlog'::project_status) THEN
    RAISE EXCEPTION 'Este projeto já foi submetido';
  END IF;

  -- Campos mínimos obrigatórios para submissão
  IF v_project.estimated_total IS NULL OR v_project.estimated_total <= 0 THEN
    v_missing := v_missing || 'valor estimado';
  END IF;
  IF v_project.est_start_date IS NULL OR v_project.est_end_date IS NULL THEN
    v_missing := v_missing || 'datas estimadas de início e fim';
  END IF;
  IF v_project.category IS NULL THEN v_missing := v_missing || 'categoria'; END IF;
  IF v_project.priority IS NULL THEN v_missing := v_missing || 'prioridade'; END IF;
  IF COALESCE(btrim(v_project.description), '') = '' THEN v_missing := v_missing || 'descrição'; END IF;
  IF COALESCE(btrim(v_project.justification), '') = '' THEN v_missing := v_missing || 'justificativa'; END IF;
  IF COALESCE(btrim(v_project.viability_summary), '') = '' THEN v_missing := v_missing || 'resumo de viabilidade'; END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'Complete o cadastro antes de submeter: %', array_to_string(v_missing, ', ');
  END IF;

  v_year := EXTRACT(YEAR FROM now())::int;
  IF v_project.code IS NULL OR v_project.code = '' THEN
    SELECT COUNT(*) + 1 INTO v_seq FROM public.projects
      WHERE code LIKE 'CAP-' || v_year::text || '-%';
    v_code := 'CAP-' || v_year::text || '-' || LPAD(v_seq::text, 3, '0');
  ELSE
    v_code := v_project.code;
  END IF;

  v_from := v_project.status;
  UPDATE public.projects SET
    code = v_code,
    status = 'em_pre_analise_fpa'::project_status,
    submitted_at = COALESCE(submitted_at, now()),
    updated_at = now()
  WHERE id = p_project_id RETURNING * INTO v_project;

  INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES (p_project_id, v_from, 'em_pre_analise_fpa'::project_status, auth.uid(),
          CASE WHEN has_role(auth.uid(),'fpa'::app_role) THEN 'fpa'::app_role ELSE 'manager'::app_role END,
          'Submetido para pré-análise FP&A');

  RETURN v_project;
END; $function$;

GRANT EXECUTE ON FUNCTION public.submeter_projeto(uuid) TO authenticated;

COMMENT ON FUNCTION public.submit_project_to_cycle(uuid, uuid) IS 'DEPRECATED: substituída por submeter_projeto(uuid) — submissão contínua sem ciclos';
COMMENT ON TABLE public.cycles IS 'DEPRECATED: ciclos de investimento removidos do fluxo; consolidação passou a ser por período de submissão';
COMMENT ON TABLE public.windows IS 'DEPRECATED: janelas de submissão/análise removidas; gestores submetem continuamente';
COMMENT ON COLUMN public.projects.cycle_id IS 'DEPRECATED: não é mais preenchido; use submitted_at para agrupar por período';