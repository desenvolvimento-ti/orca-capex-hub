CREATE OR REPLACE FUNCTION public.stage1_missing(p_project_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF p.study_start_date IS NOT NULL AND p.execution_start_date IS NOT NULL AND p.execution_start_date <= p.study_start_date THEN
    m := m || 'início da execução deve ser posterior ao início do estudo'; END IF;
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
END $function$;