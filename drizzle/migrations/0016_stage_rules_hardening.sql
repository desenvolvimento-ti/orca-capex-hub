CREATE OR REPLACE FUNCTION public.enforce_project_edit_lock()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE s1 boolean; s2 boolean;
BEGIN
  IF has_role(auth.uid(),'fpa'::app_role) OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  s1 := OLD.status IN ('no_hub','rascunho','devolvido_pre','no_ciclo','retornado_backlog');
  s2 := OLD.status IN ('em_projeto_firme','devolvido_orc');
  IF NOT s1 AND (
    NEW.name IS DISTINCT FROM OLD.name OR NEW.category IS DISTINCT FROM OLD.category OR
    NEW.priority IS DISTINCT FROM OLD.priority OR NEW.description IS DISTINCT FROM OLD.description OR
    NEW.justification IS DISTINCT FROM OLD.justification OR NEW.study_amount IS DISTINCT FROM OLD.study_amount OR
    NEW.execution_amount IS DISTINCT FROM OLD.execution_amount OR NEW.study_start_date IS DISTINCT FROM OLD.study_start_date OR
    NEW.execution_start_date IS DISTINCT FROM OLD.execution_start_date OR NEW.execution_months IS DISTINCT FROM OLD.execution_months OR
    NEW.payback_months IS DISTINCT FROM OLD.payback_months OR NEW.viability_summary IS DISTINCT FROM OLD.viability_summary OR
    NEW.payback_not_applicable IS DISTINCT FROM OLD.payback_not_applicable OR NEW.payback_na_justification IS DISTINCT FROM OLD.payback_na_justification OR
    NEW.cost_center IS DISTINCT FROM OLD.cost_center) THEN
    RAISE EXCEPTION 'A proposta indicativa está congelada após a submissão. Ela só volta a ser editável se o FP&A devolver o projeto.';
  END IF;
  IF NOT s2 AND (
    NEW.firm_study_amount IS DISTINCT FROM OLD.firm_study_amount OR NEW.firm_execution_amount IS DISTINCT FROM OLD.firm_execution_amount OR
    NEW.firm_study_start_date IS DISTINCT FROM OLD.firm_study_start_date OR NEW.firm_execution_start_date IS DISTINCT FROM OLD.firm_execution_start_date OR
    NEW.firm_execution_months IS DISTINCT FROM OLD.firm_execution_months) THEN
    RAISE EXCEPTION 'O planejamento não está aberto para edição nesta situação.';
  END IF;
  IF NEW.prioritization_result IS DISTINCT FROM OLD.prioritization_result OR NEW.baseline_frozen_at IS DISTINCT FROM OLD.baseline_frozen_at
     OR NEW.prioritization_published_at IS DISTINCT FROM OLD.prioritization_published_at THEN
    IF current_setting('app.rpc', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'Campo controlado pelo FP&A.';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.stage1_missing(p_project_id uuid)
 RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.projects; m text[] := '{}'::text[]; s_study numeric; s_exec numeric;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project_id;
  IF COALESCE(btrim(p.name),'') = '' THEN m := array_append(m, 'Nome'); END IF;
  IF COALESCE(btrim(p.description),'') = '' THEN m := array_append(m, 'Descrição'); END IF;
  IF COALESCE(btrim(p.justification),'') = '' THEN m := array_append(m, 'Justificativa'); END IF;
  IF p.study_amount IS NULL OR p.study_amount < 0 THEN m := array_append(m, 'Verba de planejamento'); END IF;
  IF p.execution_amount IS NULL OR p.execution_amount <= 0 THEN m := array_append(m, 'Verba de execução'); END IF;
  IF p.study_start_date IS NULL THEN m := array_append(m, 'Início do planejamento'); END IF;
  IF p.execution_start_date IS NULL THEN m := array_append(m, 'Início da execução'); END IF;
  IF p.study_start_date IS NOT NULL AND p.execution_start_date IS NOT NULL AND p.execution_start_date <= p.study_start_date THEN
    m := array_append(m, 'Início da execução deve ser posterior ao início do planejamento'); END IF;
  IF p.execution_months IS NULL OR p.execution_months < 1 THEN m := array_append(m, 'Prazo de execução'); END IF;
  IF COALESCE(btrim(p.cost_center),'') !~ '^[0-9]{6}$' THEN m := array_append(m, 'Centro de custo (6 dígitos numéricos)'); END IF;
  IF p.payback_not_applicable THEN
    IF COALESCE(btrim(p.payback_na_justification),'') = '' THEN m := array_append(m, 'Justificativa de payback não aplicável'); END IF;
  ELSE
    IF p.payback_months IS NULL OR p.payback_months <= 0 THEN m := array_append(m, 'Payback estimado'); END IF;
    IF COALESCE(btrim(p.viability_summary),'') = '' THEN m := array_append(m, 'Premissas do payback'); END IF;
  END IF;
  SELECT COALESCE(SUM(amount) FILTER (WHERE phase='planejamento'),0), COALESCE(SUM(amount) FILTER (WHERE phase='execucao'),0)
    INTO s_study, s_exec FROM public.disbursements WHERE project_id = p.id AND version = 'indicativo';
  IF abs(s_study - COALESCE(p.study_amount,0)) > 0.01 THEN m := array_append(m, 'Cronograma de planejamento diferente da verba de planejamento'); END IF;
  IF abs(s_exec - COALESCE(p.execution_amount,0)) > 0.01 THEN m := array_append(m, 'Cronograma de execução diferente da verba de execução'); END IF;
  m := array_cat(m, public.missing_active_required_docs(p.id, 1));
  RETURN m;
END $function$;

CREATE OR REPLACE FUNCTION public.stage2_missing(p_project_id uuid)
 RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.projects; m text[] := '{}'::text[]; s_exec numeric; v_start date;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project_id;
  v_start := COALESCE(p.firm_study_start_date, p.study_start_date);
  IF p.firm_execution_amount IS NULL OR p.firm_execution_amount <= 0 THEN m := array_append(m, 'Verba de execução'); END IF;
  IF p.firm_execution_start_date IS NULL THEN m := array_append(m, 'Início da execução'); END IF;
  IF v_start IS NOT NULL AND p.firm_execution_start_date IS NOT NULL AND p.firm_execution_start_date <= v_start THEN
    m := array_append(m, 'Início da execução deve ser posterior ao início do planejamento'); END IF;
  IF p.firm_execution_months IS NULL OR p.firm_execution_months < 1 THEN m := array_append(m, 'Prazo de execução'); END IF;
  m := array_cat(m, public.missing_active_required_docs(p.id, 2));
  SELECT COALESCE(SUM(amount) FILTER (WHERE phase='execucao'),0)
    INTO s_exec FROM public.disbursements WHERE project_id = p.id AND version = 'firme';
  IF abs(s_exec - COALESCE(p.firm_execution_amount,0)) > 0.01 THEN m := array_append(m, 'Cronograma de execução diferente da verba de execução'); END IF;
  RETURN m;
END $function$;

CREATE OR REPLACE FUNCTION public.submeter_projeto_firme(p_project_id uuid)
 RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.projects; v_missing text[]; v_from project_status; v_sched jsonb;
BEGIN
  SELECT * INTO v FROM public.projects WHERE id = p_project_id;
  IF v.owner_id <> auth.uid() AND NOT has_role(auth.uid(),'fpa'::app_role) THEN RAISE EXCEPTION 'Apenas o gestor responsável pode submeter'; END IF;
  IF v.status NOT IN ('em_projeto_firme','devolvido_orc') THEN RAISE EXCEPTION 'O planejamento não está aberto para submissão'; END IF;
  v_missing := public.stage2_missing(p_project_id);
  IF array_length(v_missing,1) > 0 THEN RAISE EXCEPTION 'Pendências antes de submeter: %', array_to_string(v_missing, ', '); END IF;
  v_from := v.status;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('period', period, 'phase', phase, 'amount', amount) ORDER BY period, phase), '[]'::jsonb)
    INTO v_sched FROM public.disbursements WHERE project_id = p_project_id AND version = 'firme';
  INSERT INTO public.project_baselines (project_id, kind, snapshot, created_by)
  VALUES (p_project_id, 'firme', jsonb_build_object(
    'firm_study_amount', COALESCE(v.firm_study_amount, v.study_amount),
    'firm_execution_amount', v.firm_execution_amount,
    'total_planejado', COALESCE(v.firm_study_amount, v.study_amount, 0) + COALESCE(v.firm_execution_amount, 0),
    'firm_study_start_date', COALESCE(v.firm_study_start_date, v.study_start_date),
    'firm_execution_start_date', v.firm_execution_start_date,
    'firm_execution_months', v.firm_execution_months,
    'disbursements', v_sched), auth.uid());
  UPDATE public.projects SET status = 'em_validacao_execucao' WHERE id = p_project_id RETURNING * INTO v;
  INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES (p_project_id, v_from, 'em_validacao_execucao', auth.uid(),
    CASE WHEN has_role(auth.uid(),'fpa'::app_role) THEN 'fpa'::app_role ELSE 'manager'::app_role END,
    'Planejamento submetido para validação de execução');
  PERFORM public.notify_users(public.fpa_user_ids(), 'validacao_execucao', 'Planejamento aguarda validação para execução',
    COALESCE(v.code, v.name), v.id, NULL, '/app/projects/' || v.id::text);
  RETURN v;
END $function$;