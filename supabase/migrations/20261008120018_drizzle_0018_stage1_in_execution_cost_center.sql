ALTER TABLE public.projects ADD COLUMN already_in_execution boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.enforce_project_edit_lock()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE s1 boolean; s2 boolean; delegated boolean; is_exec boolean; fin_changed boolean; req_changed boolean;
BEGIN
  IF has_role(auth.uid(),'fpa'::app_role) OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  s1 := OLD.status IN ('no_hub','rascunho','devolvido_pre','no_ciclo','retornado_backlog');
  s2 := OLD.status IN ('em_projeto_firme','devolvido_orc');
  fin_changed := NEW.study_amount IS DISTINCT FROM OLD.study_amount OR NEW.execution_amount IS DISTINCT FROM OLD.execution_amount
    OR NEW.study_start_date IS DISTINCT FROM OLD.study_start_date OR NEW.execution_start_date IS DISTINCT FROM OLD.execution_start_date
    OR NEW.execution_months IS DISTINCT FROM OLD.execution_months;
  req_changed := NEW.name IS DISTINCT FROM OLD.name OR NEW.category IS DISTINCT FROM OLD.category OR
    NEW.priority IS DISTINCT FROM OLD.priority OR NEW.description IS DISTINCT FROM OLD.description OR
    NEW.justification IS DISTINCT FROM OLD.justification OR
    NEW.payback_months IS DISTINCT FROM OLD.payback_months OR NEW.viability_summary IS DISTINCT FROM OLD.viability_summary OR
    NEW.payback_not_applicable IS DISTINCT FROM OLD.payback_not_applicable OR NEW.payback_na_justification IS DISTINCT FROM OLD.payback_na_justification OR
    NEW.branch_id IS DISTINCT FROM OLD.branch_id OR NEW.business_unit_id IS DISTINCT FROM OLD.business_unit_id OR
    NEW.executor_area_id IS DISTINCT FROM OLD.executor_area_id OR NEW.already_in_execution IS DISTINCT FROM OLD.already_in_execution;
  IF NOT s1 AND (fin_changed OR req_changed) THEN
    RAISE EXCEPTION 'A proposta indicativa está congelada após a submissão. Ela só volta a ser editável se o Admin devolver o projeto.';
  END IF;
  IF NOT s1 AND NOT s2 AND NEW.cost_center IS DISTINCT FROM OLD.cost_center THEN
    RAISE EXCEPTION 'O centro de custo não pode ser alterado nesta situação.';
  END IF;
  delegated := OLD.executor_area_id IS NOT NULL AND OLD.executor_area_id <> OLD.area_id;
  is_exec := delegated AND OLD.owner_id <> auth.uid() AND OLD.executor_area_id = current_user_area();
  IF is_exec THEN
    IF req_changed OR NEW.area_id IS DISTINCT FROM OLD.area_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.status IS DISTINCT FROM OLD.status OR NEW.cost_center IS DISTINCT FROM OLD.cost_center THEN
      RAISE EXCEPTION 'A área executora só pode editar verbas, datas e cronograma financeiro.';
    END IF;
  ELSIF delegated AND fin_changed THEN
    RAISE EXCEPTION 'Verbas e datas são preenchidas pela área executora designada.';
  END IF;
  IF NOT s2 AND (
    NEW.firm_study_amount IS DISTINCT FROM OLD.firm_study_amount OR NEW.firm_execution_amount IS DISTINCT FROM OLD.firm_execution_amount OR
    NEW.firm_study_start_date IS DISTINCT FROM OLD.firm_study_start_date OR NEW.firm_execution_start_date IS DISTINCT FROM OLD.firm_execution_start_date OR
    NEW.firm_execution_months IS DISTINCT FROM OLD.firm_execution_months) THEN
    RAISE EXCEPTION 'O planejamento não está aberto para edição nesta situação.';
  END IF;
  IF NEW.prioritization_result IS DISTINCT FROM OLD.prioritization_result OR NEW.baseline_frozen_at IS DISTINCT FROM OLD.baseline_frozen_at
     OR NEW.prioritization_published_at IS DISTINCT FROM OLD.prioritization_published_at THEN
    IF current_setting('app.rpc', true) IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'Campo controlado pelo Admin.'; END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.stage1_missing_split(p_project_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.projects; r text[] := '{}'; e text[] := '{}'; s_study numeric; s_exec numeric;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project_id;
  IF COALESCE(btrim(p.name),'') = '' THEN r := array_append(r, 'Nome'); END IF;
  IF p.branch_id IS NULL THEN r := array_append(r, 'Filial'); END IF;
  IF p.business_unit_id IS NULL THEN r := array_append(r, 'Unidade de negócio'); END IF;
  IF p.executor_area_id IS NULL THEN r := array_append(r, 'Área executora'); END IF;
  IF p.already_in_execution AND COALESCE(p.cost_center,'') !~ '^[0-9]{6}$' THEN r := array_append(r, 'Centro de custo (6 dígitos numéricos)'); END IF;
  IF COALESCE(btrim(p.description),'') = '' THEN r := array_append(r, 'Descrição'); END IF;
  IF COALESCE(btrim(p.justification),'') = '' THEN r := array_append(r, 'Justificativa'); END IF;
  IF p.payback_not_applicable THEN
    IF COALESCE(btrim(p.payback_na_justification),'') = '' THEN r := array_append(r, 'Justificativa de payback não aplicável'); END IF;
  ELSE
    IF p.payback_months IS NULL OR p.payback_months <= 0 THEN r := array_append(r, 'Payback estimado'); END IF;
    IF COALESCE(btrim(p.viability_summary),'') = '' THEN r := array_append(r, 'Premissas do payback'); END IF;
  END IF;
  r := array_cat(r, public.missing_active_required_docs(p.id, 1));
  IF p.study_amount IS NULL OR p.study_amount < 0 THEN e := array_append(e, 'Verba de planejamento'); END IF;
  IF p.execution_amount IS NULL OR p.execution_amount <= 0 THEN e := array_append(e, 'Verba de execução'); END IF;
  IF p.study_start_date IS NULL THEN e := array_append(e, 'Início do planejamento'); END IF;
  IF p.execution_start_date IS NULL THEN e := array_append(e, 'Início da execução'); END IF;
  IF p.study_start_date IS NOT NULL AND p.execution_start_date IS NOT NULL AND p.execution_start_date <= p.study_start_date THEN
    e := array_append(e, 'Início da execução deve ser posterior ao início do planejamento'); END IF;
  IF p.execution_months IS NULL OR p.execution_months < 1 THEN e := array_append(e, 'Prazo de execução'); END IF;
  SELECT COALESCE(SUM(amount) FILTER (WHERE phase='planejamento'),0), COALESCE(SUM(amount) FILTER (WHERE phase='execucao'),0)
    INTO s_study, s_exec FROM public.disbursements WHERE project_id = p.id AND version = 'indicativo';
  IF abs(s_study - COALESCE(p.study_amount,0)) > 0.01 THEN e := array_append(e, 'Cronograma de planejamento diferente da verba de planejamento'); END IF;
  IF abs(s_exec - COALESCE(p.execution_amount,0)) > 0.01 THEN e := array_append(e, 'Cronograma de execução diferente da verba de execução'); END IF;
  RETURN jsonb_build_object('requester', to_jsonb(r), 'executor', to_jsonb(e));
END $function$;

CREATE OR REPLACE FUNCTION public.stage2_missing(p_project_id uuid)
 RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.projects; m text[] := '{}'::text[]; s_exec numeric; v_start date;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project_id;
  v_start := COALESCE(p.firm_study_start_date, p.study_start_date);
  IF COALESCE(p.cost_center,'') !~ '^[0-9]{6}$' THEN m := array_append(m, 'Centro de custo (6 dígitos numéricos)'); END IF;
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