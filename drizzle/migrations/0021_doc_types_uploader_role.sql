ALTER TABLE public.required_document_types ADD COLUMN IF NOT EXISTS uploader_role text NOT NULL DEFAULT 'ambos' CHECK (uploader_role IN ('solicitante','executora','ambos'));

CREATE OR REPLACE FUNCTION public.stage1_missing_split(p_project_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.projects; r text[] := '{}'; e text[] := '{}'; s_study numeric; s_exec numeric; deleg boolean;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project_id;
  deleg := p.executor_area_id IS NOT NULL AND p.executor_area_id <> p.area_id;
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
  r := array_cat(r, COALESCE((SELECT array_agg('Documento: ' || t.label ORDER BY t.sort_order, t.label)
    FROM public.required_document_types t
    WHERE t.active AND t.is_required AND t.required_for_stage = 1 AND (NOT deleg OR t.uploader_role <> 'executora')
      AND NOT EXISTS (SELECT 1 FROM public.project_documents d WHERE d.project_id = p.id AND d.doc_type_id = t.id)), '{}'));
  IF deleg THEN
    e := array_cat(e, COALESCE((SELECT array_agg('Documento: ' || t.label ORDER BY t.sort_order, t.label)
      FROM public.required_document_types t
      WHERE t.active AND t.is_required AND t.required_for_stage = 1 AND t.uploader_role = 'executora'
        AND NOT EXISTS (SELECT 1 FROM public.project_documents d WHERE d.project_id = p.id AND d.doc_type_id = t.id)), '{}'));
  END IF;
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

CREATE OR REPLACE FUNCTION public.enforce_document_uploader_role()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE rec record; p public.projects; role_ text; my_area uuid;
BEGIN
  rec := COALESCE(NEW, OLD);
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'fpa') OR rec.doc_type_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT * INTO p FROM public.projects WHERE id = rec.project_id;
  IF p.executor_area_id IS NULL OR p.executor_area_id = p.area_id THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT uploader_role INTO role_ FROM public.required_document_types WHERE id = rec.doc_type_id;
  my_area := public.current_user_area();
  IF role_ = 'solicitante' AND p.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Envio restrito à Área Solicitante.';
  ELSIF role_ = 'executora' AND my_area IS DISTINCT FROM p.executor_area_id THEN
    RAISE EXCEPTION 'Envio restrito à Área Executora.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $function$;

DROP TRIGGER IF EXISTS trg_enforce_document_uploader_role ON public.project_documents;
CREATE TRIGGER trg_enforce_document_uploader_role BEFORE INSERT OR DELETE ON public.project_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_document_uploader_role();

DROP POLICY IF EXISTS docs_delete_executor ON public.project_documents;
CREATE POLICY docs_delete_executor ON public.project_documents FOR DELETE TO authenticated
  USING (public.is_project_executor(project_id) AND uploaded_by = auth.uid());