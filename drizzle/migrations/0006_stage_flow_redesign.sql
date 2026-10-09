-- Projects: new structured fields
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS study_amount numeric,
  ADD COLUMN IF NOT EXISTS execution_amount numeric,
  ADD COLUMN IF NOT EXISTS study_start_date date,
  ADD COLUMN IF NOT EXISTS execution_months integer,
  ADD COLUMN IF NOT EXISTS payback_not_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payback_na_justification text,
  ADD COLUMN IF NOT EXISTS firm_study_amount numeric,
  ADD COLUMN IF NOT EXISTS firm_execution_amount numeric,
  ADD COLUMN IF NOT EXISTS firm_study_start_date date,
  ADD COLUMN IF NOT EXISTS firm_execution_start_date date,
  ADD COLUMN IF NOT EXISTS firm_execution_months integer,
  ADD COLUMN IF NOT EXISTS cost_center text,
  ADD COLUMN IF NOT EXISTS accounting_code text,
  ADD COLUMN IF NOT EXISTS baseline_frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS prioritization_result text,
  ADD COLUMN IF NOT EXISTS prioritization_justification text,
  ADD COLUMN IF NOT EXISTS prioritization_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_justification text;

COMMENT ON COLUMN public.projects.tir_pct IS 'DEPRECATED: TIR removida do processo';

UPDATE public.projects SET
  study_amount = COALESCE(study_amount, total_planning),
  execution_amount = COALESCE(execution_amount, total_execution, NULLIF(estimated_total,0)),
  study_start_date = COALESCE(study_start_date, est_start_date),
  execution_months = COALESCE(execution_months,
    CASE WHEN est_end_date IS NOT NULL AND COALESCE(execution_start_date, est_start_date) IS NOT NULL
      THEN GREATEST(1, ((EXTRACT(YEAR FROM age(est_end_date, COALESCE(execution_start_date, est_start_date)))*12
            + EXTRACT(MONTH FROM age(est_end_date, COALESCE(execution_start_date, est_start_date))))::int) + 1)
    END),
  execution_start_date = COALESCE(execution_start_date, est_start_date);

-- Disbursements: version (indicativo / firme)
ALTER TABLE public.disbursements ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT 'indicativo';
ALTER TABLE public.disbursements DROP CONSTRAINT IF EXISTS disbursements_project_id_phase_period_key;
ALTER TABLE public.disbursements ADD CONSTRAINT disbursements_project_version_phase_period_key UNIQUE (project_id, version, phase, period);

-- Keep legacy summary columns in sync
CREATE OR REPLACE FUNCTION public.sync_project_estimates()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.study_amount IS NOT NULL OR NEW.execution_amount IS NOT NULL THEN
    NEW.estimated_total := COALESCE(NEW.study_amount,0) + COALESCE(NEW.execution_amount,0);
    NEW.total_planning := NEW.study_amount;
    NEW.total_execution := NEW.execution_amount;
  END IF;
  IF NEW.study_start_date IS NOT NULL THEN NEW.est_start_date := NEW.study_start_date; END IF;
  IF NEW.execution_start_date IS NOT NULL AND NEW.execution_months IS NOT NULL AND NEW.execution_months > 0 THEN
    NEW.est_end_date := (date_trunc('month', NEW.execution_start_date) + make_interval(months => NEW.execution_months) - interval '1 day')::date;
    NEW.execution_end_date := NEW.est_end_date;
    NEW.planning_end_date := (NEW.execution_start_date - 1);
  END IF;
  IF NEW.firm_study_amount IS NOT NULL OR NEW.firm_execution_amount IS NOT NULL THEN
    NEW.confirmed_total := COALESCE(NEW.firm_study_amount,0) + COALESCE(NEW.firm_execution_amount,0);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_project_estimates ON public.projects;
CREATE TRIGGER trg_sync_project_estimates BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_estimates();

-- Code from creation
CREATE OR REPLACE FUNCTION public.gen_project_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE y int; n int;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    y := EXTRACT(YEAR FROM now())::int;
    SELECT COALESCE(MAX(NULLIF(split_part(code,'-',3),'')::int),0) + 1 INTO n
      FROM public.projects WHERE code ~ ('^CAP-' || y::text || '-[0-9]+$');
    NEW.code := 'CAP-' || y::text || '-' || LPAD(n::text, 3, '0');
  END IF;
  RETURN NEW;
END $$;

-- Edit lock by stage
CREATE OR REPLACE FUNCTION public.enforce_project_edit_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
    NEW.payback_not_applicable IS DISTINCT FROM OLD.payback_not_applicable OR NEW.payback_na_justification IS DISTINCT FROM OLD.payback_na_justification) THEN
    RAISE EXCEPTION 'A proposta indicativa está congelada após a submissão. Ela só volta a ser editável se o FP&A devolver o projeto.';
  END IF;
  IF NOT s2 AND (
    NEW.firm_study_amount IS DISTINCT FROM OLD.firm_study_amount OR NEW.firm_execution_amount IS DISTINCT FROM OLD.firm_execution_amount OR
    NEW.firm_study_start_date IS DISTINCT FROM OLD.firm_study_start_date OR NEW.firm_execution_start_date IS DISTINCT FROM OLD.firm_execution_start_date OR
    NEW.firm_execution_months IS DISTINCT FROM OLD.firm_execution_months OR NEW.cost_center IS DISTINCT FROM OLD.cost_center) THEN
    RAISE EXCEPTION 'O projeto firme não está aberto para edição nesta situação.';
  END IF;
  IF NEW.prioritization_result IS DISTINCT FROM OLD.prioritization_result OR NEW.baseline_frozen_at IS DISTINCT FROM OLD.baseline_frozen_at
     OR NEW.prioritization_published_at IS DISTINCT FROM OLD.prioritization_published_at THEN
    IF current_setting('app.rpc', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'Campo controlado pelo FP&A.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enforce_project_edit_lock ON public.projects;
CREATE TRIGGER trg_enforce_project_edit_lock BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_project_edit_lock();

-- Log edits made after a return
CREATE OR REPLACE FUNCTION public.log_edits_after_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f text[] := '{}';
BEGIN
  IF NEW.status <> OLD.status OR OLD.status NOT IN ('devolvido_pre','devolvido_orc') THEN RETURN NEW; END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN f := f || 'nome'; END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN f := f || 'descrição'; END IF;
  IF NEW.justification IS DISTINCT FROM OLD.justification THEN f := f || 'justificativa'; END IF;
  IF NEW.study_amount IS DISTINCT FROM OLD.study_amount THEN f := f || format('verba de estudo (%s → %s)', OLD.study_amount, NEW.study_amount); END IF;
  IF NEW.execution_amount IS DISTINCT FROM OLD.execution_amount THEN f := f || format('valor de execução (%s → %s)', OLD.execution_amount, NEW.execution_amount); END IF;
  IF NEW.study_start_date IS DISTINCT FROM OLD.study_start_date THEN f := f || 'início do estudo'; END IF;
  IF NEW.execution_start_date IS DISTINCT FROM OLD.execution_start_date THEN f := f || 'início da execução'; END IF;
  IF NEW.execution_months IS DISTINCT FROM OLD.execution_months THEN f := f || 'prazo de execução'; END IF;
  IF NEW.payback_months IS DISTINCT FROM OLD.payback_months OR NEW.payback_not_applicable IS DISTINCT FROM OLD.payback_not_applicable THEN f := f || 'payback'; END IF;
  IF NEW.firm_study_amount IS DISTINCT FROM OLD.firm_study_amount THEN f := f || 'verba de estudo firme'; END IF;
  IF NEW.firm_execution_amount IS DISTINCT FROM OLD.firm_execution_amount THEN f := f || 'valor de execução firme'; END IF;
  IF array_length(f,1) > 0 THEN
    INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NULL, 'Cadastro alterado após devolução: ' || array_to_string(f, '; '));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_edits_after_return ON public.projects;
CREATE TRIGGER trg_log_edits_after_return AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_edits_after_return();

-- Disbursement lock
CREATE OR REPLACE FUNCTION public.enforce_disbursement_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_status project_status; v_version text; v_pid uuid;
BEGIN
  IF has_role(auth.uid(),'fpa'::app_role) OR auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  v_pid := COALESCE(NEW.project_id, OLD.project_id);
  v_version := COALESCE(NEW.version, OLD.version);
  SELECT status INTO v_status FROM public.projects WHERE id = v_pid;
  IF TG_OP = 'UPDATE' AND NEW.amount IS NOT DISTINCT FROM OLD.amount AND NEW.period = OLD.period AND NEW.phase = OLD.phase THEN
    RETURN NEW;
  END IF;
  IF v_version = 'indicativo' AND v_status NOT IN ('no_hub','rascunho','devolvido_pre','no_ciclo','retornado_backlog') THEN
    RAISE EXCEPTION 'O cronograma indicativo está congelado após a submissão.';
  END IF;
  IF v_version = 'firme' AND v_status NOT IN ('em_projeto_firme','devolvido_orc') THEN
    RAISE EXCEPTION 'O cronograma firme não está aberto para edição nesta situação.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_enforce_disbursement_lock ON public.disbursements;
CREATE TRIGGER trg_enforce_disbursement_lock BEFORE INSERT OR UPDATE OR DELETE ON public.disbursements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_disbursement_lock();

-- Baselines
CREATE TABLE IF NOT EXISTS public.project_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'indicativo',
  snapshot jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_baselines TO authenticated;
GRANT ALL ON public.project_baselines TO service_role;
ALTER TABLE public.project_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY baselines_select_via_project ON public.project_baselines FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_baselines.project_id AND (p.owner_id = auth.uid()
  OR has_role(auth.uid(),'fpa'::app_role) OR has_role(auth.uid(),'cfo'::app_role) OR has_role(auth.uid(),'ceo'::app_role)
  OR has_role(auth.uid(),'cco'::app_role) OR has_role(auth.uid(),'cmo'::app_role))));

-- Investment ceiling
CREATE TABLE IF NOT EXISTS public.investment_ceiling_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  reason text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.investment_ceiling_history TO authenticated;
GRANT ALL ON public.investment_ceiling_history TO service_role;
ALTER TABLE public.investment_ceiling_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY ceiling_select ON public.investment_ceiling_history FOR SELECT TO authenticated USING (true);
CREATE POLICY ceiling_insert_fpa ON public.investment_ceiling_history FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'fpa'::app_role) AND created_by = auth.uid());

-- Stage 1 missing list (server side)
CREATE OR REPLACE FUNCTION public.stage1_missing(p_project_id uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.projects; m text[] := '{}'; s_study numeric; s_exec numeric;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project_id;
  IF COALESCE(btrim(p.name),'') = '' THEN m := m || 'nome'; END IF;
  IF COALESCE(btrim(p.description),'') = '' THEN m := m || 'descrição'; END IF;
  IF COALESCE(btrim(p.justification),'') = '' THEN m := m || 'justificativa'; END IF;
  IF p.study_amount IS NULL OR p.study_amount < 0 THEN m := m || 'verba de estudo/projeto'; END IF;
  IF p.execution_amount IS NULL OR p.execution_amount <= 0 THEN m := m || 'valor de execução'; END IF;
  IF p.study_start_date IS NULL THEN m := m || 'início do planejamento/estudo'; END IF;
  IF p.execution_start_date IS NULL THEN m := m || 'início da execução'; END IF;
  IF p.study_start_date IS NOT NULL AND p.execution_start_date IS NOT NULL AND p.execution_start_date < p.study_start_date THEN
    m := m || 'início da execução anterior ao início do estudo'; END IF;
  IF p.execution_months IS NULL OR p.execution_months < 1 THEN m := m || 'prazo de execução'; END IF;
  IF p.payback_not_applicable THEN
    IF COALESCE(btrim(p.payback_na_justification),'') = '' THEN m := m || 'justificativa de payback não aplicável'; END IF;
  ELSE
    IF p.payback_months IS NULL OR p.payback_months <= 0 THEN m := m || 'payback estimado'; END IF;
    IF COALESCE(btrim(p.viability_summary),'') = '' THEN m := m || 'premissas do payback'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.project_documents d JOIN public.required_document_types t ON t.id = d.doc_type_id
       WHERE d.project_id = p.id AND t.key = 'fundamentacao_payback') THEN m := m || 'anexo de fundamentação do payback'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_documents d JOIN public.required_document_types t ON t.id = d.doc_type_id
     WHERE d.project_id = p.id AND t.key = 'orcamento_detalhado') THEN m := m || 'anexo da base do orçamento indicativo'; END IF;
  SELECT COALESCE(SUM(amount) FILTER (WHERE phase='planejamento'),0), COALESCE(SUM(amount) FILTER (WHERE phase='execucao'),0)
    INTO s_study, s_exec FROM public.disbursements WHERE project_id = p.id AND version = 'indicativo';
  IF abs(s_study - COALESCE(p.study_amount,0)) > 0.01 THEN m := m || 'cronograma de estudo diferente da verba de estudo'; END IF;
  IF abs(s_exec - COALESCE(p.execution_amount,0)) > 0.01 THEN m := m || 'cronograma de execução diferente do valor de execução'; END IF;
  RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.submeter_projeto(p_project_id uuid)
RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.projects; v_from project_status; v_missing text[];
BEGIN
  SELECT * INTO v FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF v.owner_id <> auth.uid() AND NOT has_role(auth.uid(),'fpa'::app_role) THEN
    RAISE EXCEPTION 'Apenas o gestor responsável pode submeter este projeto'; END IF;
  IF v.status NOT IN ('no_hub','rascunho','devolvido_pre','no_ciclo','retornado_backlog') THEN
    RAISE EXCEPTION 'Este projeto já foi submetido'; END IF;
  v_missing := public.stage1_missing(p_project_id);
  IF array_length(v_missing,1) > 0 THEN
    RAISE EXCEPTION 'Pendências antes de submeter: %', array_to_string(v_missing, ', '); END IF;
  PERFORM set_config('app.rpc','1',true);
  v_from := v.status;
  INSERT INTO public.project_baselines (project_id, kind, snapshot, created_by)
  VALUES (p_project_id, 'indicativo', jsonb_build_object(
    'study_amount', v.study_amount, 'execution_amount', v.execution_amount,
    'total', COALESCE(v.study_amount,0)+COALESCE(v.execution_amount,0),
    'study_start_date', v.study_start_date, 'execution_start_date', v.execution_start_date,
    'execution_months', v.execution_months, 'execution_end_date', v.est_end_date,
    'payback_months', v.payback_months, 'payback_not_applicable', v.payback_not_applicable,
    'schedule', COALESCE((SELECT jsonb_agg(jsonb_build_object('period', period, 'phase', phase, 'amount', amount) ORDER BY period)
       FROM public.disbursements WHERE project_id = p_project_id AND version = 'indicativo'), '[]'::jsonb)
  ), auth.uid());
  UPDATE public.projects SET status = 'em_pre_analise_fpa', baseline_frozen_at = now(),
    submitted_at = COALESCE(submitted_at, now()) WHERE id = p_project_id RETURNING * INTO v;
  INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES (p_project_id, v_from, 'em_pre_analise_fpa', auth.uid(),
    CASE WHEN has_role(auth.uid(),'fpa'::app_role) THEN 'fpa'::app_role ELSE 'manager'::app_role END,
    CASE WHEN v_from = 'devolvido_pre' THEN 'Reenviado ao FP&A após ajuste' ELSE 'Submetido para pré-análise do FP&A' END);
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.fpa_pre_analise(p_project_id uuid, p_acao text, p_comentario text)
RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.projects; v_to project_status;
BEGIN
  IF NOT has_role(auth.uid(),'fpa'::app_role) THEN RAISE EXCEPTION 'Apenas o FP&A pode realizar a pré-análise'; END IF;
  SELECT * INTO v FROM public.projects WHERE id = p_project_id;
  IF v.status <> 'em_pre_analise_fpa' THEN RAISE EXCEPTION 'Projeto não está em pré-análise do FP&A'; END IF;
  IF p_acao = 'encaminhar' THEN v_to := 'aguardando_diretoria_prev';
  ELSIF p_acao = 'devolver' THEN
    IF COALESCE(btrim(p_comentario),'') = '' THEN RAISE EXCEPTION 'Informe o que o gestor precisa ajustar'; END IF;
    v_to := 'devolvido_pre';
  ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
  UPDATE public.projects SET status = v_to WHERE id = p_project_id RETURNING * INTO v;
  INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES (p_project_id, 'em_pre_analise_fpa', v_to, auth.uid(), 'fpa',
    COALESCE(NULLIF(btrim(p_comentario),''), CASE WHEN v_to='aguardando_diretoria_prev' THEN 'Encaminhado para priorização da diretoria' END));
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_priorizacao(p_project_id uuid, p_resultado text, p_justificativa text)
RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.projects;
BEGIN
  IF NOT has_role(auth.uid(),'fpa'::app_role) THEN RAISE EXCEPTION 'Apenas o FP&A registra a priorização'; END IF;
  IF p_resultado IS NOT NULL AND p_resultado NOT IN ('aprovado','estudo','nao_aprovado') THEN RAISE EXCEPTION 'Resultado inválido'; END IF;
  SELECT * INTO v FROM public.projects WHERE id = p_project_id;
  IF v.status <> 'aguardando_diretoria_prev' THEN RAISE EXCEPTION 'Projeto não está em priorização'; END IF;
  PERFORM set_config('app.rpc','1',true);
  UPDATE public.projects SET prioritization_result = p_resultado, prioritization_justification = NULLIF(btrim(p_justificativa),'')
    WHERE id = p_project_id RETURNING * INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.publicar_priorizacao(p_project_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.projects; v_to project_status; n int := 0; v_title text;
BEGIN
  IF NOT has_role(auth.uid(),'fpa'::app_role) THEN RAISE EXCEPTION 'Apenas o FP&A publica a priorização'; END IF;
  PERFORM set_config('app.rpc','1',true);
  FOR r IN SELECT * FROM public.projects WHERE id = ANY(p_project_ids)
     AND status = 'aguardando_diretoria_prev' AND prioritization_result IS NOT NULL LOOP
    v_to := CASE WHEN r.prioritization_result = 'nao_aprovado' THEN 'nao_aprovado_pre'::project_status ELSE 'em_projeto_firme'::project_status END;
    UPDATE public.projects SET status = v_to, prioritization_published_at = now(), decided_at = now(),
      firm_study_amount = COALESCE(firm_study_amount, study_amount),
      firm_execution_amount = COALESCE(firm_execution_amount, execution_amount),
      firm_study_start_date = COALESCE(firm_study_start_date, study_start_date),
      firm_execution_start_date = COALESCE(firm_execution_start_date, execution_start_date),
      firm_execution_months = COALESCE(firm_execution_months, execution_months)
      WHERE id = r.id;
    IF v_to = 'em_projeto_firme' THEN
      INSERT INTO public.disbursements (project_id, version, phase, period, amount)
      SELECT project_id, 'firme', phase, period, amount FROM public.disbursements
        WHERE project_id = r.id AND version = 'indicativo'
      ON CONFLICT (project_id, version, phase, period) DO NOTHING;
    END IF;
    INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
    VALUES (r.id, r.status, v_to, auth.uid(), 'fpa',
      CASE r.prioritization_result WHEN 'aprovado' THEN 'Priorização: aprovado'
        WHEN 'estudo' THEN 'Priorização: aprovada apenas a verba de estudo/projeto' ELSE 'Priorização: não aprovado' END
      || COALESCE(' — ' || r.prioritization_justification, ''));
    v_title := CASE r.prioritization_result WHEN 'aprovado' THEN 'Projeto pré-aprovado: apresente o projeto firme'
      WHEN 'estudo' THEN 'Verba de estudo aprovada: desenvolva o projeto firme' ELSE 'Projeto não aprovado na priorização' END;
    IF v_to = 'em_projeto_firme' THEN
      PERFORM public.notify_users(ARRAY[r.owner_id], 'priorizacao', v_title, COALESCE(r.code, r.name), r.id, NULL, '/app/projects/' || r.id::text);
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.stage2_missing(p_project_id uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.projects; m text[] := '{}'; s_study numeric; s_exec numeric; k text;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project_id;
  IF p.firm_study_amount IS NULL OR p.firm_study_amount < 0 THEN m := m || 'verba de estudo firme'; END IF;
  IF p.firm_execution_amount IS NULL OR p.firm_execution_amount <= 0 THEN m := m || 'valor de execução firme'; END IF;
  IF p.firm_study_start_date IS NULL THEN m := m || 'início do estudo (firme)'; END IF;
  IF p.firm_execution_start_date IS NULL THEN m := m || 'início da execução (firme)'; END IF;
  IF p.firm_execution_months IS NULL OR p.firm_execution_months < 1 THEN m := m || 'prazo de execução (firme)'; END IF;
  IF COALESCE(btrim(p.cost_center),'') = '' THEN m := m || 'centro de custo'; END IF;
  FOREACH k IN ARRAY ARRAY['escopo_tecnico','cotacoes','orcamento_firme','analise_risco','analise_impacto_retorno'] LOOP
    IF NOT EXISTS (SELECT 1 FROM public.project_documents d JOIN public.required_document_types t ON t.id = d.doc_type_id
       WHERE d.project_id = p.id AND t.key = k) THEN
      m := m || ('documento: ' || COALESCE((SELECT label FROM public.required_document_types WHERE key = k), k)); END IF;
  END LOOP;
  SELECT COALESCE(SUM(amount) FILTER (WHERE phase='planejamento'),0), COALESCE(SUM(amount) FILTER (WHERE phase='execucao'),0)
    INTO s_study, s_exec FROM public.disbursements WHERE project_id = p.id AND version = 'firme';
  IF abs(s_study - COALESCE(p.firm_study_amount,0)) > 0.01 THEN m := m || 'cronograma firme de estudo diferente da verba'; END IF;
  IF abs(s_exec - COALESCE(p.firm_execution_amount,0)) > 0.01 THEN m := m || 'cronograma firme de execução diferente do valor'; END IF;
  RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.submeter_projeto_firme(p_project_id uuid)
RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.projects; v_missing text[]; v_from project_status;
BEGIN
  SELECT * INTO v FROM public.projects WHERE id = p_project_id;
  IF v.owner_id <> auth.uid() AND NOT has_role(auth.uid(),'fpa'::app_role) THEN RAISE EXCEPTION 'Apenas o gestor responsável pode submeter'; END IF;
  IF v.status NOT IN ('em_projeto_firme','devolvido_orc') THEN RAISE EXCEPTION 'O projeto firme não está aberto para submissão'; END IF;
  v_missing := public.stage2_missing(p_project_id);
  IF array_length(v_missing,1) > 0 THEN RAISE EXCEPTION 'Pendências antes de submeter: %', array_to_string(v_missing, ', '); END IF;
  v_from := v.status;
  UPDATE public.projects SET status = 'em_validacao_execucao' WHERE id = p_project_id RETURNING * INTO v;
  INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES (p_project_id, v_from, 'em_validacao_execucao', auth.uid(),
    CASE WHEN has_role(auth.uid(),'fpa'::app_role) THEN 'fpa'::app_role ELSE 'manager'::app_role END,
    'Projeto firme submetido para validação de execução');
  PERFORM public.notify_users(public.fpa_user_ids(), 'validacao_execucao', 'Projeto firme aguarda validação para execução',
    COALESCE(v.code, v.name), v.id, NULL, '/app/projects/' || v.id::text);
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.decisao_validacao_execucao(p_project_id uuid, p_acao text, p_justificativa text)
RETURNS projects LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.projects; v_to project_status; v_title text;
BEGIN
  IF NOT has_role(auth.uid(),'fpa'::app_role) THEN RAISE EXCEPTION 'Apenas o FP&A registra a decisão da validação'; END IF;
  SELECT * INTO v FROM public.projects WHERE id = p_project_id;
  IF v.status <> 'em_validacao_execucao' THEN RAISE EXCEPTION 'Projeto não está em validação para execução'; END IF;
  IF p_acao IN ('devolver','nao_aprovar') AND COALESCE(btrim(p_justificativa),'') = '' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  v_to := CASE p_acao WHEN 'aprovar' THEN 'aprovado_final' WHEN 'devolver' THEN 'devolvido_orc'
    WHEN 'nao_aprovar' THEN 'reprovado_final' WHEN 'concluir_estudo' THEN 'estudo_concluido' END;
  IF v_to IS NULL THEN RAISE EXCEPTION 'Ação inválida'; END IF;
  UPDATE public.projects SET status = v_to, validation_justification = NULLIF(btrim(p_justificativa),''),
    fpa_approved_amount = CASE WHEN v_to = 'aprovado_final' THEN confirmed_total ELSE fpa_approved_amount END,
    decided_at = now() WHERE id = p_project_id RETURNING * INTO v;
  INSERT INTO public.project_status_history (project_id, from_status, to_status, actor_id, actor_role, comment)
  VALUES (p_project_id, 'em_validacao_execucao', v_to, auth.uid(), 'fpa', NULLIF(btrim(p_justificativa),''));
  v_title := CASE v_to WHEN 'aprovado_final' THEN 'Execução aprovada: projeto liberado para gastar'
    WHEN 'estudo_concluido' THEN 'Projeto firme registrado como concluído (execução não aprovada)'
    ELSE NULL END;
  IF v_title IS NOT NULL THEN
    PERFORM public.notify_users(ARRAY[v.owner_id], 'validacao', v_title, COALESCE(v.code, v.name), v.id, NULL, '/app/projects/' || v.id::text);
  END IF;
  RETURN v;
END $$;

GRANT EXECUTE ON FUNCTION public.stage1_missing(uuid), public.stage2_missing(uuid), public.fpa_pre_analise(uuid,text,text),
  public.registrar_priorizacao(uuid,text,text), public.publicar_priorizacao(uuid[]), public.submeter_projeto_firme(uuid),
  public.decisao_validacao_execucao(uuid,text,text) TO authenticated;

-- Chat notifications
CREATE OR REPLACE FUNCTION public.notify_project_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.projects; v_targets uuid[];
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = NEW.project_id;
  IF NEW.author_id = p.owner_id THEN v_targets := public.fpa_user_ids();
  ELSE v_targets := ARRAY[p.owner_id]; END IF;
  v_targets := array_remove(v_targets, NEW.author_id);
  IF array_length(v_targets,1) > 0 THEN
    PERFORM public.notify_users(v_targets, 'mensagem', 'Nova mensagem no projeto ' || COALESCE(p.code, p.name),
      left(NEW.body, 140), p.id, NULL, '/app/projects/' || p.id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_project_comment ON public.project_comments;
CREATE TRIGGER trg_notify_project_comment AFTER INSERT ON public.project_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_comment();