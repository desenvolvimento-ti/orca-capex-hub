
CREATE TABLE public.deviation_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pct numeric NOT NULL DEFAULT 20,
  min_amount numeric NOT NULL DEFAULT 5000,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.deviation_settings TO authenticated;
GRANT ALL ON public.deviation_settings TO service_role;
ALTER TABLE public.deviation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read settings" ON public.deviation_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "fpa insert settings" ON public.deviation_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'fpa'));
CREATE POLICY "fpa update settings" ON public.deviation_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'fpa'));

CREATE TABLE public.actuals_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  competencia date NOT NULL,
  imported_by uuid,
  total_rows integer NOT NULL DEFAULT 0,
  matched_rows integer NOT NULL DEFAULT 0,
  unmatched_rows integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.actuals_imports TO authenticated;
GRANT ALL ON public.actuals_imports TO service_role;
ALTER TABLE public.actuals_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpa read imports" ON public.actuals_imports FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'fpa'));

CREATE TABLE public.actual_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.actuals_imports(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  project_code text NOT NULL,
  cost_center text,
  competencia date NOT NULL,
  amount numeric NOT NULL,
  phase phase_type,
  source text NOT NULL DEFAULT 'manual',
  cc_mismatch boolean NOT NULL DEFAULT false,
  description text,
  supplier text,
  doc_number text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX actual_entries_project_idx ON public.actual_entries(project_id, competencia);
CREATE INDEX actual_entries_code_idx ON public.actual_entries(project_code, cost_center) WHERE project_id IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.actual_entries TO authenticated;
GRANT ALL ON public.actual_entries TO service_role;
ALTER TABLE public.actual_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpa all entries" ON public.actual_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'fpa')) WITH CHECK (public.has_role(auth.uid(),'fpa'));
CREATE POLICY "owner read entries" ON public.actual_entries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE TABLE public.unmatched_actuals_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL,
  cost_center text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'aberto',
  assigned_manager_id uuid,
  resolution text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_code, cost_center)
);
GRANT SELECT ON public.unmatched_actuals_queue TO authenticated;
GRANT ALL ON public.unmatched_actuals_queue TO service_role;
ALTER TABLE public.unmatched_actuals_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpa read queue" ON public.unmatched_actuals_queue FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'fpa'));

CREATE TABLE public.project_deviations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  planned numeric NOT NULL DEFAULT 0,
  actual numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente_gestor',
  response_kind text,
  response text,
  responded_by uuid,
  responded_at timestamptz,
  treated_by uuid,
  treated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, competencia)
);
GRANT SELECT ON public.project_deviations TO authenticated;
GRANT ALL ON public.project_deviations TO service_role;
ALTER TABLE public.project_deviations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read deviations" ON public.project_deviations FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'fpa') OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

COMMENT ON COLUMN public.disbursements.realized_amount IS 'DEPRECATED: realizado passa a vir de actual_entries';

-- classificação e divergência de centro de custo
CREATE OR REPLACE FUNCTION public.classify_actual_entry() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE p public.projects; v_start date;
BEGIN
  NEW.competencia := date_trunc('month', NEW.competencia)::date;
  NEW.project_code := upper(trim(NEW.project_code));
  NEW.cost_center := nullif(trim(coalesce(NEW.cost_center,'')),'');
  IF NEW.project_id IS NULL THEN
    SELECT * INTO p FROM public.projects WHERE upper(trim(code)) = NEW.project_code LIMIT 1;
    IF FOUND THEN NEW.project_id := p.id; END IF;
  ELSE
    SELECT * INTO p FROM public.projects WHERE id = NEW.project_id;
  END IF;
  IF NEW.project_id IS NOT NULL THEN
    v_start := date_trunc('month', coalesce(p.firm_execution_start_date, p.execution_start_date))::date;
    NEW.phase := CASE WHEN v_start IS NOT NULL AND NEW.competencia < v_start THEN 'planejamento'::phase_type ELSE 'execucao'::phase_type END;
    NEW.cc_mismatch := p.cost_center IS NOT NULL AND NEW.cost_center IS NOT NULL
      AND upper(trim(p.cost_center)) <> upper(NEW.cost_center);
  ELSE
    NEW.phase := NULL; NEW.cc_mismatch := false;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_classify_actual BEFORE INSERT OR UPDATE ON public.actual_entries FOR EACH ROW EXECUTE FUNCTION public.classify_actual_entry();

-- recálculo de desvios
CREATE OR REPLACE FUNCTION public.recalc_deviations(p_project_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.deviation_settings; p public.projects; v_version text; r record; v_new integer := 0; v_diff numeric; v_ex public.project_deviations;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT * INTO s FROM public.deviation_settings WHERE id = 1;
  IF NOT FOUND THEN s.pct := 20; s.min_amount := 5000; END IF;
  v_version := CASE WHEN EXISTS (SELECT 1 FROM public.disbursements WHERE project_id = p_project_id AND version = 'firme') THEN 'firme' ELSE 'indicativo' END;
  FOR r IN
    WITH pl AS (SELECT date_trunc('month', period)::date m, sum(amount) v FROM public.disbursements WHERE project_id = p_project_id AND version = v_version GROUP BY 1),
         ac AS (SELECT competencia m, sum(amount) v FROM public.actual_entries WHERE project_id = p_project_id GROUP BY 1)
    SELECT coalesce(pl.m, ac.m) m, coalesce(pl.v,0) planned, coalesce(ac.v,0) actual
    FROM pl FULL JOIN ac ON pl.m = ac.m
    WHERE coalesce(pl.m, ac.m) <= date_trunc('month', now())::date AND ac.m IS NOT NULL
  LOOP
    v_diff := abs(r.actual - r.planned);
    SELECT * INTO v_ex FROM public.project_deviations WHERE project_id = p_project_id AND competencia = r.m;
    IF v_diff >= s.min_amount AND (r.planned = 0 OR v_diff / r.planned * 100 >= s.pct) THEN
      IF v_ex.id IS NULL THEN
        INSERT INTO public.project_deviations(project_id, competencia, planned, actual) VALUES (p_project_id, r.m, r.planned, r.actual);
        v_new := v_new + 1;
        IF auth.uid() IS NOT NULL THEN
          INSERT INTO public.project_comments(project_id, author_id, author_role, body) VALUES (p_project_id, auth.uid(), 'fpa',
            'Desvio relevante em ' || to_char(r.m,'MM/YYYY') || ': previsto R$ ' || to_char(r.planned,'FM999G999G990D00') ||
            ', realizado R$ ' || to_char(r.actual,'FM999G999G990D00') || '. Ajuste a previsão ou justifique o desvio na seção de acompanhamento.');
        END IF;
        PERFORM public.notify_users(ARRAY[p.owner_id], 'desvio', 'Desvio no projeto ' || coalesce(p.code, p.name),
          'Competência ' || to_char(r.m,'MM/YYYY') || ': ajuste a previsão ou justifique.', p.id, NULL, '/app/projects/' || p.id::text);
      ELSE
        UPDATE public.project_deviations SET planned = r.planned, actual = r.actual WHERE id = v_ex.id;
      END IF;
    ELSIF v_ex.id IS NOT NULL THEN
      UPDATE public.project_deviations SET planned = r.planned, actual = r.actual,
        status = CASE WHEN status = 'pendente_gestor' THEN 'tratado' ELSE status END,
        response = CASE WHEN status = 'pendente_gestor' THEN coalesce(response, 'Desvio deixou de ser relevante após recálculo.') ELSE response END
      WHERE id = v_ex.id;
    END IF;
  END LOOP;
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.import_actuals(p_file_name text, p_competencia date, p_rows jsonb) RETURNS public.actuals_imports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_imp public.actuals_imports; r jsonb; v_pid uuid;
BEGIN
  IF NOT has_role(auth.uid(),'fpa') THEN RAISE EXCEPTION 'Apenas o FP&A importa o realizado.'; END IF;
  DELETE FROM public.actuals_imports WHERE competencia = date_trunc('month', p_competencia)::date;
  INSERT INTO public.actuals_imports(file_name, competencia, imported_by) VALUES (p_file_name, date_trunc('month', p_competencia)::date, auth.uid()) RETURNING * INTO v_imp;
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO public.actual_entries(import_id, project_code, cost_center, competencia, amount, source, description, supplier, doc_number, created_by)
    VALUES (v_imp.id, r->>'project_code', r->>'cost_center', (r->>'competencia')::date, (r->>'amount')::numeric, 'importacao',
      r->>'description', r->>'supplier', r->>'doc_number', auth.uid());
  END LOOP;
  INSERT INTO public.unmatched_actuals_queue(project_code, cost_center)
    SELECT DISTINCT project_code, coalesce(cost_center,'') FROM public.actual_entries WHERE import_id = v_imp.id AND project_id IS NULL
  ON CONFLICT (project_code, cost_center) DO UPDATE SET status = CASE WHEN unmatched_actuals_queue.status = 'resolvido' THEN 'aberto' ELSE unmatched_actuals_queue.status END, updated_at = now();
  UPDATE public.actuals_imports SET
    total_rows = (SELECT count(*) FROM public.actual_entries WHERE import_id = v_imp.id),
    matched_rows = (SELECT count(*) FROM public.actual_entries WHERE import_id = v_imp.id AND project_id IS NOT NULL),
    unmatched_rows = (SELECT count(*) FROM public.actual_entries WHERE import_id = v_imp.id AND project_id IS NULL),
    total_amount = coalesce((SELECT sum(amount) FROM public.actual_entries WHERE import_id = v_imp.id),0)
  WHERE id = v_imp.id RETURNING * INTO v_imp;
  FOR v_pid IN SELECT DISTINCT project_id FROM public.actual_entries WHERE project_id IS NOT NULL
    AND (import_id = v_imp.id OR competencia = v_imp.competencia) LOOP
    PERFORM public.recalc_deviations(v_pid);
  END LOOP;
  RETURN v_imp;
END $$;

CREATE OR REPLACE FUNCTION public.after_manual_actual() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.source, OLD.source) = 'manual' AND coalesce(NEW.project_id, OLD.project_id) IS NOT NULL THEN
    PERFORM public.recalc_deviations(coalesce(NEW.project_id, OLD.project_id));
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_after_manual_actual AFTER INSERT OR UPDATE OR DELETE ON public.actual_entries FOR EACH ROW EXECUTE FUNCTION public.after_manual_actual();

CREATE OR REPLACE FUNCTION public.responder_desvio(p_deviation_id uuid, p_kind text, p_texto text) RETURNS public.project_deviations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.project_deviations; p public.projects;
BEGIN
  SELECT * INTO d FROM public.project_deviations WHERE id = p_deviation_id;
  SELECT * INTO p FROM public.projects WHERE id = d.project_id;
  IF p.owner_id <> auth.uid() AND NOT has_role(auth.uid(),'fpa') THEN RAISE EXCEPTION 'Apenas o gestor responsável responde ao desvio.'; END IF;
  IF p_kind NOT IN ('ajuste','justificativa') THEN RAISE EXCEPTION 'Tipo de resposta inválido.'; END IF;
  IF coalesce(trim(p_texto),'') = '' THEN RAISE EXCEPTION 'Descreva o ajuste ou a justificativa.'; END IF;
  UPDATE public.project_deviations SET status = 'respondido', response_kind = p_kind, response = p_texto, responded_by = auth.uid(), responded_at = now()
    WHERE id = d.id RETURNING * INTO d;
  INSERT INTO public.project_comments(project_id, author_id, author_role, body) VALUES (p.id, auth.uid(), 'manager',
    CASE WHEN p_kind = 'ajuste' THEN 'Previsão ajustada' ELSE 'Justificativa do desvio' END || ' (' || to_char(d.competencia,'MM/YYYY') || '): ' || p_texto);
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.tratar_desvio(p_deviation_id uuid, p_acao text, p_comentario text) RETURNS public.project_deviations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.project_deviations;
BEGIN
  IF NOT has_role(auth.uid(),'fpa') THEN RAISE EXCEPTION 'Apenas o FP&A trata desvios.'; END IF;
  IF p_acao NOT IN ('tratado','nova_acao') THEN RAISE EXCEPTION 'Ação inválida.'; END IF;
  UPDATE public.project_deviations SET status = CASE WHEN p_acao = 'tratado' THEN 'tratado' ELSE 'pendente_gestor' END,
    treated_by = auth.uid(), treated_at = now() WHERE id = p_deviation_id RETURNING * INTO d;
  IF coalesce(trim(p_comentario),'') <> '' OR p_acao = 'nova_acao' THEN
    INSERT INTO public.project_comments(project_id, author_id, author_role, body) VALUES (d.project_id, auth.uid(), 'fpa',
      CASE WHEN p_acao = 'tratado' THEN 'Desvio de ' || to_char(d.competencia,'MM/YYYY') || ' dado por tratado. ' ELSE 'Nova ação solicitada sobre o desvio de ' || to_char(d.competencia,'MM/YYYY') || '. ' END || coalesce(p_comentario,''));
  END IF;
  RETURN d;
END $$;

-- reprojeção de meses futuros no cronograma firme
CREATE OR REPLACE FUNCTION public.ajustar_previsao(p_project_id uuid, p_rows jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.projects; v_cur date := date_trunc('month', now())::date; r jsonb;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project_id;
  IF p.owner_id <> auth.uid() AND NOT has_role(auth.uid(),'fpa') THEN RAISE EXCEPTION 'Sem permissão para ajustar a previsão.'; END IF;
  IF p.status NOT IN ('aprovado_final','em_execucao') THEN RAISE EXCEPTION 'A previsão só pode ser ajustada durante a execução.'; END IF;
  PERFORM set_config('app.allow_reforecast','on', true);
  IF NOT EXISTS (SELECT 1 FROM public.disbursements WHERE project_id = p.id AND version = 'firme') THEN
    INSERT INTO public.disbursements(project_id, phase, period, amount, version)
      SELECT project_id, phase, period, amount, 'firme' FROM public.disbursements WHERE project_id = p.id AND version = 'indicativo';
  END IF;
  DELETE FROM public.disbursements WHERE project_id = p.id AND version = 'firme' AND period >= v_cur;
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    IF (r->>'period')::date >= v_cur AND coalesce((r->>'amount')::numeric,0) > 0 THEN
      INSERT INTO public.disbursements(project_id, phase, period, amount, version)
      VALUES (p.id, (r->>'phase')::phase_type, date_trunc('month',(r->>'period')::date)::date, (r->>'amount')::numeric, 'firme');
    END IF;
  END LOOP;
  INSERT INTO public.project_status_history(project_id, from_status, to_status, actor_id, comment)
    VALUES (p.id, p.status, p.status, auth.uid(), 'Previsão dos meses futuros reprojetada no acompanhamento.');
END $$;

CREATE OR REPLACE FUNCTION public.enforce_disbursement_lock()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE v_status project_status; v_version text; v_pid uuid;
BEGIN
  IF has_role(auth.uid(),'fpa'::app_role) OR auth.uid() IS NULL OR current_setting('app.allow_reforecast', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.resolver_fora_do_rito(p_queue_id uuid, p_acao text, p_project_id uuid, p_manager_id uuid, p_comentario text) RETURNS public.unmatched_actuals_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q public.unmatched_actuals_queue; v_pid uuid;
BEGIN
  IF NOT has_role(auth.uid(),'fpa') THEN RAISE EXCEPTION 'Apenas o FP&A trata a fila fora do rito.'; END IF;
  SELECT * INTO q FROM public.unmatched_actuals_queue WHERE id = p_queue_id;
  IF p_acao = 'vincular' THEN
    IF p_project_id IS NULL THEN RAISE EXCEPTION 'Escolha o projeto.'; END IF;
    UPDATE public.actual_entries SET project_id = p_project_id WHERE project_id IS NULL AND project_code = q.project_code AND coalesce(cost_center,'') = q.cost_center;
    PERFORM public.recalc_deviations(p_project_id);
    UPDATE public.unmatched_actuals_queue SET status = 'resolvido', resolution = coalesce(p_comentario, 'Vinculado a projeto do Hub'), updated_by = auth.uid(), updated_at = now() WHERE id = q.id RETURNING * INTO q;
  ELSIF p_acao = 'em_contato' THEN
    UPDATE public.unmatched_actuals_queue SET status = 'em_contato', assigned_manager_id = p_manager_id, resolution = p_comentario, updated_by = auth.uid(), updated_at = now() WHERE id = q.id RETURNING * INTO q;
    IF p_manager_id IS NOT NULL THEN
      PERFORM public.notify_users(ARRAY[p_manager_id], 'fora_do_rito', 'Gasto contábil sem projeto no Hub',
        'Código ' || q.project_code || coalesce(' / CC ' || nullif(q.cost_center,''),'') || ': cadastre o projeto no Hub ou fale com o FP&A.', NULL, NULL, '/app/projects/new');
    END IF;
  ELSIF p_acao = 'fora_escopo' THEN
    IF coalesce(trim(p_comentario),'') = '' THEN RAISE EXCEPTION 'Informe a justificativa.'; END IF;
    UPDATE public.unmatched_actuals_queue SET status = 'fora_escopo', resolution = p_comentario, updated_by = auth.uid(), updated_at = now() WHERE id = q.id RETURNING * INTO q;
  ELSIF p_acao = 'reabrir' THEN
    UPDATE public.unmatched_actuals_queue SET status = 'aberto', updated_by = auth.uid(), updated_at = now() WHERE id = q.id RETURNING * INTO q;
  ELSE RAISE EXCEPTION 'Ação inválida.'; END IF;
  RETURN q;
END $$;
