CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY branches_select ON public.branches FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(),'fpa'));
CREATE POLICY branches_fpa_write ON public.branches FOR ALL TO authenticated USING (public.has_role(auth.uid(),'fpa')) WITH CHECK (public.has_role(auth.uid(),'fpa'));

CREATE TABLE public.business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_units TO authenticated;
GRANT ALL ON public.business_units TO service_role;
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY bu_select ON public.business_units FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(),'fpa'));
CREATE POLICY bu_fpa_write ON public.business_units FOR ALL TO authenticated USING (public.has_role(auth.uid(),'fpa')) WITH CHECK (public.has_role(auth.uid(),'fpa'));

CREATE TABLE public.directorates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  director_name text NOT NULL,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.directorates TO authenticated;
GRANT ALL ON public.directorates TO service_role;
ALTER TABLE public.directorates ENABLE ROW LEVEL SECURITY;
CREATE POLICY dir_select ON public.directorates FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(),'fpa'));
CREATE POLICY dir_fpa_write ON public.directorates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'fpa')) WITH CHECK (public.has_role(auth.uid(),'fpa'));

CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_bu_updated BEFORE UPDATE ON public.business_units FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_dir_updated BEFORE UPDATE ON public.directorates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.allowed_emails ADD COLUMN directorate_id uuid REFERENCES public.directorates(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN directorate_id uuid REFERENCES public.directorates(id) ON DELETE SET NULL;
ALTER TABLE public.areas ADD COLUMN can_execute_for_others boolean NOT NULL DEFAULT false;

ALTER TABLE public.projects ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT;
ALTER TABLE public.projects ADD COLUMN business_unit_id uuid REFERENCES public.business_units(id) ON DELETE RESTRICT;
ALTER TABLE public.projects ADD COLUMN executor_area_id uuid REFERENCES public.areas(id);
UPDATE public.projects SET executor_area_id = area_id WHERE executor_area_id IS NULL;

-- Helpers
CREATE OR REPLACE FUNCTION public.is_project_executor(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id AND p.executor_area_id IS NOT NULL AND p.executor_area_id <> p.area_id
      AND p.executor_area_id = public.current_user_area() AND p.owner_id <> auth.uid())
$$;

CREATE POLICY projects_select_executor ON public.projects FOR SELECT TO authenticated
  USING (executor_area_id IS NOT NULL AND executor_area_id <> area_id AND executor_area_id = public.current_user_area());
CREATE POLICY projects_update_executor ON public.projects FOR UPDATE TO authenticated
  USING (executor_area_id IS NOT NULL AND executor_area_id <> area_id AND executor_area_id = public.current_user_area())
  WITH CHECK (executor_area_id IS NOT NULL AND executor_area_id <> area_id AND executor_area_id = public.current_user_area());
CREATE POLICY disb_select_executor ON public.disbursements FOR SELECT TO authenticated USING (public.is_project_executor(project_id));
CREATE POLICY disb_write_executor ON public.disbursements FOR ALL TO authenticated
  USING (public.is_project_executor(project_id)) WITH CHECK (public.is_project_executor(project_id));
CREATE POLICY docs_select_executor ON public.project_documents FOR SELECT TO authenticated USING (public.is_project_executor(project_id));

-- Edit lock with executor split; cost_center no longer part of stage 1
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
    NEW.executor_area_id IS DISTINCT FROM OLD.executor_area_id;
  IF NOT s1 AND (fin_changed OR req_changed) THEN
    RAISE EXCEPTION 'A proposta indicativa está congelada após a submissão. Ela só volta a ser editável se o Admin devolver o projeto.';
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

CREATE OR REPLACE FUNCTION public.enforce_disbursement_lock()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_status project_status; v_version text; v_pid uuid; v_area uuid; v_exec uuid; v_owner uuid;
BEGIN
  IF has_role(auth.uid(),'fpa'::app_role) OR auth.uid() IS NULL OR current_setting('app.allow_reforecast', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  v_pid := COALESCE(NEW.project_id, OLD.project_id);
  v_version := COALESCE(NEW.version, OLD.version);
  IF v_version = 'realizado' THEN RAISE EXCEPTION 'Somente a Administração pode lançar valores realizados.'; END IF;
  SELECT status, area_id, executor_area_id, owner_id INTO v_status, v_area, v_exec, v_owner FROM public.projects WHERE id = v_pid;
  IF TG_OP = 'UPDATE' AND NEW.amount IS NOT DISTINCT FROM OLD.amount AND NEW.period = OLD.period AND NEW.phase = OLD.phase THEN RETURN NEW; END IF;
  IF v_version = 'indicativo' AND v_status NOT IN ('no_hub','rascunho','devolvido_pre','no_ciclo','retornado_backlog') THEN
    RAISE EXCEPTION 'O cronograma indicativo está congelado após a submissão.';
  END IF;
  IF v_version = 'indicativo' AND v_exec IS NOT NULL AND v_exec <> v_area THEN
    IF NOT (v_owner <> auth.uid() AND current_user_area() = v_exec) THEN
      RAISE EXCEPTION 'O cronograma indicativo é preenchido pela área executora designada.';
    END IF;
  ELSIF public.is_project_executor(v_pid) THEN
    RAISE EXCEPTION 'A área executora só pode editar o cronograma indicativo.';
  END IF;
  IF v_version = 'firme' AND v_status NOT IN ('em_projeto_firme','devolvido_orc') THEN
    RAISE EXCEPTION 'O cronograma planejado não está aberto para edição nesta situação.';
  END IF;
  RETURN COALESCE(NEW, OLD);
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
GRANT EXECUTE ON FUNCTION public.stage1_missing_split(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.stage1_missing(p_project_id uuid)
 RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE j jsonb;
BEGIN
  j := public.stage1_missing_split(p_project_id);
  RETURN ARRAY(SELECT jsonb_array_elements_text(j->'requester')) || ARRAY(SELECT jsonb_array_elements_text(j->'executor'));
END $function$;

CREATE OR REPLACE FUNCTION public.submeter_projeto(p_project_id uuid)
 RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.projects; v_from project_status; j jsonb;
BEGIN
  SELECT * INTO v FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF v.owner_id <> auth.uid() AND NOT has_role(auth.uid(),'fpa'::app_role) THEN
    RAISE EXCEPTION 'Apenas a área solicitante pode submeter este projeto'; END IF;
  IF v.status NOT IN ('no_hub','rascunho','devolvido_pre','no_ciclo','retornado_backlog') THEN
    RAISE EXCEPTION 'Este projeto já foi submetido'; END IF;
  j := public.stage1_missing_split(p_project_id);
  IF jsonb_array_length(j->'requester') > 0 THEN
    RAISE EXCEPTION 'Pendências antes de submeter: %', (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(j->'requester') x); END IF;
  IF jsonb_array_length(j->'executor') > 0 THEN
    RAISE EXCEPTION 'A proposta ainda não pode ser submetida porque existem informações pendentes da área executora.'; END IF;
  PERFORM set_config('app.rpc','1',true);
  v_from := v.status;
  INSERT INTO public.project_baselines (project_id, kind, snapshot, created_by)
  VALUES (p_project_id, 'indicativo', jsonb_build_object(
    'study_amount', v.study_amount, 'execution_amount', v.execution_amount,
    'total', COALESCE(v.study_amount,0)+COALESCE(v.execution_amount,0),
    'study_start_date', v.study_start_date, 'execution_start_date', v.execution_start_date,
    'execution_months', v.execution_months, 'execution_end_date', v.est_end_date,
    'payback_months', v.payback_months, 'payback_not_applicable', v.payback_not_applicable,
    'branch_id', v.branch_id, 'business_unit_id', v.business_unit_id, 'executor_area_id', v.executor_area_id,
    'schedule', COALESCE((SELECT jsonb_agg(jsonb_build_object('period', period, 'phase', phase, 'amount', amount) ORDER BY period)
       FROM public.disbursements WHERE project_id = p_project_id AND version = 'indicativo'), '[]'::jsonb)
  ), auth.uid());
  UPDATE public.projects SET status = 'em_pre_analise_fpa', baseline_frozen_at = now(),
    submitted_at = COALESCE(submitted_at, now()) WHERE id = p_project_id RETURNING * INTO v;
  INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES (p_project_id, v_from, 'em_pre_analise_fpa', auth.uid(),
    CASE WHEN has_role(auth.uid(),'fpa'::app_role) THEN 'fpa'::app_role ELSE 'manager'::app_role END,
    CASE WHEN v_from = 'devolvido_pre' THEN 'Reenviado ao Admin após ajuste' ELSE 'Submetido para pré-análise do Admin' END);
  RETURN v;
END $function$;