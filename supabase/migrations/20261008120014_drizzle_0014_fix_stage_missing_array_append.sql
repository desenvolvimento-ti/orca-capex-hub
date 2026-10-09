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
DECLARE p public.projects; m text[] := '{}'::text[]; s_study numeric; s_exec numeric;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project_id;
  IF p.firm_study_amount IS NULL OR p.firm_study_amount < 0 THEN m := array_append(m, 'Verba de planejamento'); END IF;
  IF p.firm_execution_amount IS NULL OR p.firm_execution_amount <= 0 THEN m := array_append(m, 'Verba de execução'); END IF;
  IF p.firm_study_start_date IS NULL THEN m := array_append(m, 'Início do planejamento'); END IF;
  IF p.firm_execution_start_date IS NULL THEN m := array_append(m, 'Início da execução'); END IF;
  IF p.firm_execution_months IS NULL OR p.firm_execution_months < 1 THEN m := array_append(m, 'Prazo de execução'); END IF;
  IF COALESCE(btrim(p.cost_center),'') = '' THEN m := array_append(m, 'Centro de custo'); END IF;
  m := array_cat(m, public.missing_active_required_docs(p.id, 2));
  SELECT COALESCE(SUM(amount) FILTER (WHERE phase='planejamento'),0), COALESCE(SUM(amount) FILTER (WHERE phase='execucao'),0)
    INTO s_study, s_exec FROM public.disbursements WHERE project_id = p.id AND version = 'firme';
  IF abs(s_study - COALESCE(p.firm_study_amount,0)) > 0.01 THEN m := array_append(m, 'Cronograma de planejamento diferente da verba'); END IF;
  IF abs(s_exec - COALESCE(p.firm_execution_amount,0)) > 0.01 THEN m := array_append(m, 'Cronograma de execução diferente da verba'); END IF;
  RETURN m;
END $function$;